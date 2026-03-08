"""
Session Manager for handling multiple concurrent game sessions.
Manages the lifecycle of all active GameSession instances.
"""

from typing import Dict, Optional, List, Union
from datetime import datetime, timedelta, timezone
from backend.services.game_session import GameSession, GameMode
import uuid

# Forward imports to avoid circular dependency
# GameSession and GameMode will be imported at runtime


class GameSessionManager:
    """
    Manages all active game sessions.
    Acts as a registry/factory for GameSession instances.
    
    Responsibilities:
    - Create and register new GameSession instances
    - Retrieve active sessions by ID
    - Handle session lifecycle (cleanup, timeout)
    - Monitor and manage concurrent games
    
    In future, this could be extended to:
    - Persist sessions to database
    - Handle session cleanup
    - Load sessions from storage
    """
    
    def __init__(self, session_timeout_minutes: int = 30):
        self.sessions: Dict[str, 'GameSession'] = {}
        self.session_timeout = timedelta(minutes=session_timeout_minutes)
    
    def create_session(
        self,
        player_ids: List[str],
        difficulty: str,
        board_size: int,
        game_mode: Optional[Union['GameMode', str]] = None
    ) -> str:
        """
        Create and register a new game session.
        
        Args:
            player_ids: List of player IDs participating
            difficulty: Difficulty level ('Leicht', 'Mittel', 'Schwer', 'None')
            board_size: Number of cards (16, 36, or 64)
            game_mode: Type of game (SINGLEPLAYER_TIME, SINGLEPLAYER_AI, MULTIPLAYER)
            
        Returns:
            session_id: Unique identifier for the created session
        """
        
        session_id = str(uuid.uuid4())

        # Convert string to GameMode enum if necessary
        if game_mode is None:
            game_mode = GameMode.SINGLEPLAYER_TIME
        elif isinstance(game_mode, str):
            try:
                game_mode = GameMode[game_mode.upper()]
            except KeyError as e:
                raise ValueError(f"Invalid game mode: {game_mode}") from e

        # For SINGLEPLAYER_AI, add bot as second player
        if game_mode == GameMode.SINGLEPLAYER_AI and len(player_ids) == 1:
            player_ids += ['bot']

        session = GameSession(
            session_id=session_id,
            player_ids=player_ids,
            difficulty=difficulty,
            board_size=board_size,
            game_mode=game_mode
        )
        # Initialize game (create and shuffle cards)
        session.initialize_game()

        self.sessions[session_id] = session
        # print(f"Created new session: {session.session_id}, mode: {session.game_mode}, players: {session.player_ids}")
        # print(f"Total active sessions: {len(self.sessions)}")
        return session_id
    
    def get_session(self, session_id: str) -> Optional['GameSession']:
        """
        Retrieve a session by ID.
        Checks if session has expired and removes it if necessary.
        
        Args:
            session_id: ID of session to retrieve
            
        Returns:
            GameSession if found and active, None otherwise
        """
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        
        # Check if session is expired
        if self._is_session_expired(session):
            self.delete_session(session_id)
            return None
        
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete/close a session by ID.
        
        Args:
            session_id: ID of session to delete
            
        Returns:
            True if session existed and was deleted, False otherwise
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False
    
    def cleanup_expired_sessions(self) -> int:
        """
        Remove all expired sessions.
        
        Returns:
            Count of sessions that were cleaned up
        """
        expired_ids = [
            sid for sid, session in self.sessions.items()
            if self._is_session_expired(session)
        ]
        
        for session_id in expired_ids:
            del self.sessions[session_id]
        
        return len(expired_ids)
    
    def _is_session_expired(self, session: 'GameSession') -> bool:
        """
        Check if a session has expired based on timeout.
        Finished sessions are kept available for viewing results.
        
        Args:
            session: GameSession to check
            
        Returns:
            True if session has expired, False otherwise
        """
        if session.finished:
            return False  # Keep finished sessions available for results
        
        # Check age against timeout using timezone-aware UTC
        age = datetime.now(tz=timezone.utc) - session.created_at
        return age > self.session_timeout
    
    def get_session_count(self) -> int:
        """Get number of active sessions"""
        return len(self.sessions)
    
    def get_session_summary(self, session_id: str) -> Optional[Dict]:
        """
        Get a summary of a session for inspection/debugging.
        
        Args:
            session_id: ID of session
            
        Returns:
            Dictionary with session information
        """
        if session := self.get_session(session_id):
            # Serialize created_at explicitly as UTC ISO-8601 format
            created_at_utc = session.created_at.astimezone(timezone.utc)
            return {
                'session_id': session.session_id,
                'status': session.status.value,
                'game_mode': session.game_mode.value,
                'difficulty': session.difficulty,
                'board_size': session.board_size,
                'pairs_found': session.pairs_found,
                'players': session.player_ids,
                'current_turn': session.current_player_turn,
                'created_at': created_at_utc.isoformat()
            }
        else:
            return None
    
    def close_session(self, session_id: str) -> None:
        """
        Close and remove a session (cleanup).
        
        Args:
            session_id: ID of session to close
        """
        from services.game_session import GameStatus
        
        if session_id in self.sessions:
            session = self.sessions[session_id]
            session.status = GameStatus.ABANDONED
            del self.sessions[session_id]
    
    def get_player_sessions(self, player_id: str) -> List['GameSession']:
        """
        Get all active sessions for a specific player.
        Useful for showing a player's active games.
        
        Args:
            player_id: ID of player
            
        Returns:
            List of GameSession instances the player is in
        """
        return [
            session for session in self.sessions.values()
            if player_id in session.player_ids
        ]
    
    def get_all_sessions(self) -> List['GameSession']:
        """
        Get all active sessions (for debugging/monitoring).
        
        Returns:
            List of all GameSession instances
        """
        return list(self.sessions.values())
    
    def cleanup_finished_sessions(self) -> int:
        """
        Remove all finished sessions from memory.
        Can be called periodically in production.
        
        Returns:
            Number of sessions cleaned up
        """
        finished_ids = [
            sid for sid, session in self.sessions.items()
            if session.finished
        ]
        for sid in finished_ids:
            del self.sessions[sid]
        return len(finished_ids)
