"""
Game Session Management Module

Handles the state and logic for individual game sessions.
Supports singleplayer, multiplayer, and AI game modes.
"""

from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum
import uuid
from dataclasses import dataclass, field


class GameStatus(str, Enum):
    """Current status of a game session"""
    ACTIVE = "active"
    PAUSED = "paused"
    FINISHED = "finished"


class GameMode(str, Enum):
    """Type of game being played"""
    SINGLEPLAYER = "singleplayer"
    MULTIPLAYER = "multiplayer"


@dataclass
class Card:
    """Represents a single card on the board"""
    id: int
    image: str
    flipped: bool = False
    matched: bool = False
    position: int = 0


@dataclass
class Move:
    """Records a single move in the game"""
    player_id: str
    card_indices: List[int]
    is_match: bool
    timestamp: datetime
    move_number: int


@dataclass
class MatchedPair:
    """Records a successfully matched pair"""
    card_indices: Tuple[int, int]
    matched_by: str
    match_time: datetime


@dataclass
class PlayerResult:
    """Final results for a player after game ends"""
    player_id: str
    points: int
    is_winner: bool
    moves_count: int
    time_spent: int


@dataclass
class BotState:
    """Tracking state for bot in singleplayer mode 'Player vs. Bot'"""
    bot_id: str
    difficulty: str  # 'Leicht', 'Mittel', 'Schwer'
    card_memory: Dict[int, int] = field(default_factory=dict)  # position -> id
    known_pairs: List[Tuple[int, int]] = field(default_factory=list)
    last_seen_cards: List[int] = field(default_factory=list)


class GameSession:
    """
    Manages a complete game session with full state management.
    Can handle singleplayer and multiplayer.
    
    This is the authoritative state holder for a game - all game logic
    validation and decisions happen here.
    """
    
    def __init__(
        self,
        session_id: str,
        player_ids: List[str],
        difficulty: str,
        board_size: int,
        game_mode: GameMode = GameMode.SINGLEPLAYER
    ):
        # ==================== Session Management ====================
        self.session_id = session_id
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.ended_at: Optional[datetime] = None
        
        # ==================== Players ====================
        self.player_ids = player_ids
        self.current_player_turn = player_ids[0]
        self.turn_order = player_ids
        self.current_turn_index = 0
        
        # ==================== Game Configuration ====================
        self.game_mode = game_mode
        self.difficulty = difficulty
        self.board_size = board_size
        
        # ==================== Game State ====================
        self.status = GameStatus.ACTIVE
        self.finished = False
        self.winner: Optional[str] = None
        self.final_results: List[PlayerResult] = []
        
        # ==================== Cards & Game Logic ====================
        self.cards: List[Card] = []
        self.selected_cards: List[Card] = []
        self.matched_pairs: List[MatchedPair] = []
        self.move_history: List[Move] = []
        
        # ==================== Scoring ====================
        self.player_points: Dict[str, int] = {pid: 0 for pid in player_ids}
        self.bot_states: Dict[str, BotState] = {}
        
        # ==================== Timing ====================
        self.elapsed_time = 0
        self.time_limit: Optional[int] = None
        self.time_expired = False
        
        # ==================== Metadata ====================
        self.metadata: Dict[str, any] = {}
    
    # ==================== Core Game Methods ====================
    
    def start_game(self, cards: List[Card]) -> None:
        """
        Initialize and start the game session.
        
        Args:
            cards: List of Card objects to set up on the board
        """
        self.started_at = datetime.now()
        self.status = GameStatus.ACTIVE
        self.cards = cards
        self.elapsed_time = 0
    
    def flip_card(self, player_id: str, card_index: int) -> bool:
        """
        Flip a card and add to selected cards.
        Validates that it's the correct player's turn and move is legal.
        
        Args:
            player_id: ID of player making the move
            card_index: Index of card to flip
            
        Returns:
            True if card was flipped successfully, False if invalid move
        """
        # Validate it's this player's turn
        if player_id != self.current_player_turn:
            return False
        
        # Validate card index within bounds
        if card_index < 0 or card_index >= len(self.cards):
            return False
        
        card = self.cards[card_index]
        
        # Can't flip already flipped or matched cards
        if card.flipped or card.matched:
            return False
        
        # Can't select more than 2 cards per turn
        if len(self.selected_cards) >= 2:
            return False
        
        # Flip the card
        card.flipped = True
        self.selected_cards.append(card)
        
        return True
    
    def check_match(self) -> Tuple[bool, List[int]]:
        """
        Check if the two selected cards match.
        Handles scoring, flipping back non-matches, and turn switching.
        
        Returns:
            Tuple of (is_match: bool, card_positions: List[int])
        """
        if len(self.selected_cards) < 2:
            return False, []
        
        card1 = self.selected_cards[0]
        card2 = self.selected_cards[1]
        
        # Determine if cards match
        is_pair = card1.id == card2.id
        
        pos1 = self.cards.index(card1)
        pos2 = self.cards.index(card2)
        
        if is_pair:
            # Mark cards as matched
            card1.matched = True
            card2.matched = True
            
            # Award points to current player
            self.player_points[self.current_player_turn] += 1
            
            # Store matched pair record
            self.matched_pairs.append(
                MatchedPair(
                    card_indices=(pos1, pos2),
                    matched_by=self.current_player_turn,
                    match_time=datetime.now()
                )
            )
            
            # Record successful move
            self.record_move(
                self.current_player_turn,
                [pos1, pos2],
                is_pair=True
            )
        else:
            # Flip cards back if no match
            card1.flipped = False
            card2.flipped = False
            
            # Record unsuccessful move
            self.record_move(
                self.current_player_turn,
                [pos1, pos2],
                is_pair=False
            )
            
            # Switch turn on mismatch (for multiplayer or single-player with turns)
            if len(self.player_ids) > 1:
                self.next_turn()
        
        # Clear selected cards
        self.selected_cards = []
        
        return is_pair, [pos1, pos2]
    
    def next_turn(self) -> None:
        """
        Switch to the next player's turn.
        Updates current_player_turn and resets selected cards.
        """
        self.current_turn_index = (self.current_turn_index + 1) % len(self.turn_order)
        self.current_player_turn = self.turn_order[self.current_turn_index]
        self.selected_cards = []
    
    def record_move(self, player_id: str, card_indices: List[int], is_match: bool) -> None:
        """
        Record a move in the game history for replays and analytics.
        
        Args:
            player_id: ID of player who made the move
            card_indices: Indices of cards flipped
            is_match: Whether the move resulted in a match
        """
        move = Move(
            player_id=player_id,
            card_indices=card_indices,
            is_match=is_match,
            timestamp=datetime.now(),
            move_number=len(self.move_history) + 1
        )
        self.move_history.append(move)
    
    def add_points(self, player_id: str, points: int) -> None:
        """
        Add points to a player's score.
        
        Args:
            player_id: ID of player to award points
            points: Number of points to add
        """
        if player_id in self.player_points:
            self.player_points[player_id] += points
    
    def check_win_condition(self) -> bool:
        """
        Check if the game should end.
        This happens when all cards are matched or time expires.
        
        Returns:
            True if game should end, False otherwise
        """
        all_matched = all(card.matched for card in self.cards)
        return all_matched or self.time_expired
    
    def finish_game(self) -> None:
        """
        Finish the game and determine winner(s).
        Builds final results for all players.
        """
        self.status = GameStatus.FINISHED
        self.finished = True
        self.ended_at = datetime.now()
        
        # Determine winner(s)
        max_points = max(self.player_points.values()) if self.player_points else 0
        winners = [pid for pid, pts in self.player_points.items() if pts == max_points]
        
        # Single winner if there's a clear leader
        self.winner = winners[0] if len(winners) == 1 else None
        
        # Build final results for each player
        self.final_results = [
            PlayerResult(
                player_id=pid,
                points=self.player_points[pid],
                is_winner=pid in winners,
                moves_count=sum(1 for m in self.move_history if m.player_id == pid),
                time_spent=self.elapsed_time
            )
            for pid in self.player_ids
        ]
    
    # ==================== Serialization & Data Methods ====================
    
    def to_dict(self) -> Dict:
        """
        Convert session to dictionary for API responses.
        
        Returns:
            Dictionary representation of session state
        """
        return {
            "session_id": self.session_id,
            "status": self.status.value,
            "game_mode": self.game_mode.value,
            "difficulty": self.difficulty,
            "board_size": self.board_size,
            "current_player": self.current_player_turn,
            "player_ids": self.player_ids,
            "cards": [
                {
                    "id": card.id,
                    "image": card.image,
                    "flipped": card.flipped,
                    "matched": card.matched
                }
                for card in self.cards
            ],
            "matched_pairs_count": len(self.matched_pairs),
            "player_points": self.player_points,
            "elapsed_time": self.elapsed_time,
            "finished": self.finished,
            "winner": self.winner,
            "final_results": [
                {
                    "player_id": r.player_id,
                    "points": r.points,
                    "is_winner": r.is_winner,
                    "moves_count": r.moves_count,
                    "time_spent": r.time_spent
                }
                for r in self.final_results
            ] if self.final_results else []
        }
    
    def get_player_view(self, player_id: str) -> Dict:
        """
        Get session state filtered for a specific player.
        Adds information about whose turn it is.
        
        Args:
            player_id: ID of player requesting the view
            
        Returns:
            Dictionary with player-specific game state
        """
        session_dict = self.to_dict()
        session_dict["is_your_turn"] = self.current_player_turn == player_id
        return session_dict
    
    def get_move_history(self) -> List[Dict]:
        """
        Get complete move history for replays or analysis.
        
        Returns:
            List of move records
        """
        return [
            {
                "move_number": move.move_number,
                "player_id": move.player_id,
                "card_indices": move.card_indices,
                "is_match": move.is_match,
                "timestamp": move.timestamp.isoformat()
            }
            for move in self.move_history
        ]


class GameSessionManager:
    """
    Manages all active game sessions.
    Acts as a registry/factory for GameSession instances.
    
    In future, this could be extended to:
    - Persist sessions to database
    - Handle session cleanup
    - Load sessions from storage
    """
    
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
    
    def create_session(
        self,
        player_ids: List[str],
        difficulty: str,
        board_size: int,
        game_mode: GameMode = GameMode.SINGLEPLAYER
    ) -> GameSession:
        """
        Create and register a new game session.
        
        Args:
            player_ids: List of player IDs participating
            difficulty: Difficulty level ('Leicht', 'Mittel', 'Schwer', 'None')
            board_size: Number of cards (16, 36, or 64)
            game_mode: Type of game (SINGLEPLAYER, MULTIPLAYER, AI)
            
        Returns:
            The newly created GameSession instance
        """
        session_id = str(uuid.uuid4())
        session = GameSession(
            session_id=session_id,
            player_ids=player_ids,
            difficulty=difficulty,
            board_size=board_size,
            game_mode=game_mode
        )
        self.sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[GameSession]:
        """
        Retrieve a session by ID.
        
        Args:
            session_id: ID of session to retrieve
            
        Returns:
            GameSession if found, None otherwise
        """
        return self.sessions.get(session_id)
    
    def close_session(self, session_id: str) -> None:
        """
        Close and remove a session (cleanup).
        
        Args:
            session_id: ID of session to close
        """
        if session_id in self.sessions:
            session = self.sessions[session_id]
            session.status = GameStatus.ABANDONED
            del self.sessions[session_id]
    
    def get_player_sessions(self, player_id: str) -> List[GameSession]:
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
    
    def get_all_sessions(self) -> List[GameSession]:
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
