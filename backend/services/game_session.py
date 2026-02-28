"""
Game Session Management Module

Handles the state and logic for individual game sessions.
Supports singleplayer and multiplayer games modes.
This is the unified game logic module that combines all game mechanics.
"""

from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum
import uuid
import json
import os
import random
from dataclasses import dataclass, field
from services.bot import BotAI

# ==================== Card Images List ====================

CARD_IMAGES = [
    'assets/images-small/Memory_Card_01_Default.webp',
    'assets/images-small/Memory_Card_02_RTF_02.webp',
    'assets/images-small/Memory_Card_03_Application_Window.webp',
    'assets/images-small/Memory_Card_04_Folder_Opened.webp',
    'assets/images-small/Memory_Card_05_Floppy_Disk.webp',
    'assets/images-small/Memory_Card_06_Removable_Media.webp',
    'assets/images-small/Memory_Card_07_Optical_Drive.webp',
    'assets/images-small/Memory_Card_08_Chip.webp',
    'assets/images-small/Memory_Card_09_Entire_Network.webp',
    'assets/images-small/Memory_Card_10_My_Computer.webp',
    'assets/images-small/Memory_Card_11_Printer.webp',
    'assets/images-small/Memory_Card_12_Start_Menu_Programs.webp',
    'assets/images-small/Memory_Card_13_Recent_Documents.webp',
    'assets/images-small/Memory_Card_14_Control_Panel.webp',
    'assets/images-small/Memory_Card_15_Search.webp',
    'assets/images-small/Memory_Card_16_Help_and_Support.webp',
    'assets/images-small/Memory_Card_17_Run.webp',
    'assets/images-small/Memory_Card_18_2_Hibernate.webp',
    'assets/images-small/Memory_Card_19_Sharing_Hand.webp',
    'assets/images-small/Memory_Card_20_Recycle_Bin(full).webp',
    'assets/images-small/Memory_Card_21_Administrative_Tools.webp',
    'assets/images-small/Memory_Card_22_Audio_CD.webp',
    'assets/images-small/Memory_Card_23_Add.webp',
    'assets/images-small/Memory_Card_24_Favorites.webp',
    'assets/images-small/Memory_Card_25_Logout.webp',
    'assets/images-small/Memory_Card_26_Windows_Update.webp',
    'assets/images-small/Memory_Card_27_Padlock.webp',
    'assets/images-small/Memory_Card_28_Delete.webp',
    'assets/images-small/Memory_Card_29_CAB.webp',
    'assets/images-small/Memory_Card_30_BAT.webp',
    'assets/images-small/Memory_Card_31_Font.webp',
    'assets/images-small/Memory_Card_32_TrueType2.webp'
]


class GameStatus(str, Enum):
    """Current status of a game session"""
    WAITING = "waiting"
    ACTIVE = "active"
    PAUSED = "paused"
    FINISHED = "finished"
    ABANDONED = "abandoned"


class GameMode(str, Enum):
    """Type of game being played"""
    SINGLEPLAYER_TIME = "singleplayer_time"  # Player vs. Time (no bot)
    SINGLEPLAYER_AI = "singleplayer_ai"      # Player vs. Bot
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
    rank: Optional[str] = None  # For time-based ranking


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
    Unified game session management combining all game logic.
    
    Manages a complete game session with full state management.
    - Handles card initialization, shuffling, and matching
    - Manages player turns and scoring
    - Integrates bot AI for single-player games
    - Tracks move history for replays
    - Calculates rankings based on time
    
    This is the authoritative state holder for a game - all game logic
    validation and decisions happen here.
    """
    
    def __init__(
        self,
        session_id: str,
        player_ids: List[str],
        difficulty: str,
        board_size: int,
        game_mode: GameMode = GameMode.SINGLEPLAYER_TIME
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
        self.selected_images: List[str] = []  # Selected card images for this session
        
        # ==================== Game State ====================
        self.status = GameStatus.WAITING
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
        self.pairs_found = 0
        
        # ==================== Bot Integration ====================
        self.bot_ai: Optional[BotAI] = None
        if game_mode == GameMode.SINGLEPLAYER_AI:
            # Create bot instance for this session
            self.bot_ai = BotAI()
            self.bot_ai.set_difficulty(difficulty)
        
        # ==================== Timing ====================
        self.elapsed_time = 0
        self.time_limit: Optional[int] = None
        self.time_expired = False
        
        # ==================== Metadata ====================
        self.metadata: Dict[str, any] = {}
    
    # ==================== Card Initialization ====================
    
    def initialize_game(self) -> None:
        """
        Initialize game with specified board size.
        Creates and shuffles card deck.
        """
        if self.board_size not in [16, 36, 64]:
            raise ValueError(f"Invalid board size: {self.board_size}. Must be 16, 36, or 64.")
        
        # Select images for this session
        self.selected_images = CARD_IMAGES[:self.board_size // 2]
        
        # Create cards (two of each image)
        self.cards = []
        for index, image in enumerate(self.selected_images):
            self.cards.append(Card(id=index, image=image, position=len(self.cards)))
            self.cards.append(Card(id=index, image=image, position=len(self.cards)))
        
        # Shuffle cards
        self.shuffle_cards()
        
        # Reset game state
        self.selected_cards = []
        self.pairs_found = 0
        self.player_points = {pid: 0 for pid in self.player_ids}
        self.move_history = []
        self.matched_pairs = []
        
        # Initialize bot if needed
        if self.bot_ai:
            self.bot_ai.initialize(self.board_size)
        
        # Mark game as started
        self.status = GameStatus.ACTIVE
        self.started_at = datetime.now()
    
    def shuffle_cards(self) -> None:
        """Shuffle cards using Fisher-Yates algorithm"""
        for i in range(len(self.cards) - 1, 0, -1):
            j = random.randint(0, i)
            self.cards[i], self.cards[j] = self.cards[j], self.cards[i]
    
    # ==================== Core Game Methods ====================
    
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
        
        # Remember card for bot (only for 'Schwer' difficulty when player flips cards)
        if self.bot_ai and self.game_mode == GameMode.SINGLEPLAYER_AI:
            if self.difficulty == 'Schwer':  # Only remember player's cards on hard difficulty
                self.bot_ai.remember_card(card_index, card.id, seen_by='player')
        
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
            self.pairs_found += 1
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
            
            # Remove cards from bot memory
            if self.bot_ai:
                self.bot_ai.forget_card(pos1)
                self.bot_ai.forget_card(pos2)
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
            
            # Switch turn on mismatch (if multiplayer or AI mode)
            if self.game_mode == GameMode.SINGLEPLAYER_AI:
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
    
    # ==================== Bot Logic ====================
    
    def bot_move(self) -> Optional[Dict]:
        """
        Execute bot's move based on difficulty level.
        Each GameSession has its own bot instance with its own memory.
        
        Returns:
            Dictionary with move information or None if invalid state
        """
        if not self.bot_ai or self.game_mode != GameMode.SINGLEPLAYER_AI:
            return None
        
        if not self.cards:
            return None
        
        # Get available cards (not flipped, not matched)
        available_cards = [
            (i, card) for i, card in enumerate(self.cards)
            if not card.flipped and not card.matched
        ]
        
        if not available_cards or len(available_cards) < 2:
            return None
        
        if self.difficulty == 'Leicht':
            return self._random_bot_move(available_cards)
        else:  # 'Mittel' or 'Schwer'
            return self._bot_memory_move(available_cards)
    
    def _random_bot_move(self, available_cards: List[Tuple]) -> Dict:
        """Bot makes random moves"""
        # First card
        first_idx, first_card = random.choice(available_cards)
        self.flip_card(self.current_player_turn, first_idx)
        # Bot remembers its own cards
        if self.bot_ai and self.difficulty in ['Mittel', 'Schwer']:
            self.bot_ai.remember_card(first_idx, first_card.id, seen_by='bot')
        
        # Second card (remove first from available)
        remaining = [c for c in available_cards if c[0] != first_idx]
        if not remaining:
            return {'first_card': first_idx, 'second_card': None, 'type': 'random', 'is_pair': False}
        
        second_idx, second_card = random.choice(remaining)
        self.flip_card(self.current_player_turn, second_idx)
        # Bot remembers its own cards
        if self.bot_ai and self.difficulty in ['Mittel', 'Schwer']:
            self.bot_ai.remember_card(second_idx, second_card.id, seen_by='bot')
        
        return {
            'type': 'random',
            'first_card': first_idx,
            'second_card': second_idx,
            'is_pair': first_card.id == second_card.id
        }
    
    def _bot_memory_move(self, available_cards: List[Tuple]) -> Dict:
        """Bot uses memory to find pairs (for Mittel and Schwer difficulties)"""
        # Check if bot knows a pair
        pair = self.bot_ai.find_known_pair()
        
        if pair:
            first_idx, second_idx = pair
            # Check if cards are still available
            available_indices = [idx for idx, _ in available_cards]
            
            if first_idx in available_indices and second_idx in available_indices:
                self.flip_card(self.current_player_turn, first_idx)
                self.flip_card(self.current_player_turn, second_idx)
                
                # Bot remembers its own cards
                first_card = self.cards[first_idx]
                second_card = self.cards[second_idx]
                if self.bot_ai and self.difficulty in ['Mittel', 'Schwer']:
                    self.bot_ai.remember_card(first_idx, first_card.id, seen_by='bot')
                    self.bot_ai.remember_card(second_idx, second_card.id, seen_by='bot')
                
                return {
                    'type': 'memory',
                    'first_card': first_idx,
                    'second_card': second_idx,
                    'is_pair': first_card.id == second_card.id
                }
        
        # Fall back to random move if no known pair
        return self._random_bot_move(available_cards)
    
    # ==================== Scoring & Ranking ====================
    
    def calculate_rank(self, time_seconds: int) -> str:
        """
        Calculate rank based on time and board size.
        Used for singleplayer "Player vs. Time" mode.
        
        Args:
            time_seconds: Time elapsed in seconds
            
        Returns:
            Rank (A, B, C, D, E)
        """
        if self.board_size == 16:
            if time_seconds < 60:
                return 'A'
            elif time_seconds < 120:
                return 'B'
            elif time_seconds < 180:
                return 'C'
            elif time_seconds < 240:
                return 'D'
            else:
                return 'E'
        elif self.board_size == 36:
            if time_seconds < 120:
                return 'A'
            elif time_seconds < 240:
                return 'B'
            elif time_seconds < 360:
                return 'C'
            elif time_seconds < 480:
                return 'D'
            else:
                return 'E'
        elif self.board_size == 64:
            if time_seconds < 180:
                return 'A'
            elif time_seconds < 360:
                return 'B'
            elif time_seconds < 540:
                return 'C'
            elif time_seconds < 720:
                return 'D'
            else:
                return 'E'
        
        return 'E'
    
    # ==================== Win Condition & Finishing ====================
    
    def check_win_condition(self) -> bool:
        """
        Check if the game should end.
        Game ends when all cards are matched or time expires.
        
        Returns:
            True if game should end, False otherwise
        """
        all_matched = all(card.matched for card in self.cards)
        return all_matched or self.time_expired
    
    def finish_game(self) -> None:
        """
        Finish the game and determine winner(s).
        Builds final results for all players.
        Calculates rankings for time-based modes.
        """
        self.status = GameStatus.FINISHED
        self.finished = True
        self.ended_at = datetime.now()
        
        # Calculate elapsed time
        if self.started_at:
            self.elapsed_time = int((self.ended_at - self.started_at).total_seconds())
        
        # Determine winner(s)
        max_points = max(self.player_points.values()) if self.player_points else 0
        winners = [pid for pid, pts in self.player_points.items() if pts == max_points]
        
        # Single winner if there's a clear leader
        self.winner = winners[0] if len(winners) == 1 else None
        
        # Build final results for each player
        self.final_results = []
        for pid in self.player_ids:
            rank = None
            # Calculate rank for singleplayer time mode
            if self.game_mode == GameMode.SINGLEPLAYER_TIME and len(self.player_ids) == 1:
                rank = self.calculate_rank(self.elapsed_time)
            
            result = PlayerResult(
                player_id=pid,
                points=self.player_points[pid],
                is_winner=pid in winners,
                moves_count=sum(1 for m in self.move_history if m.player_id == pid),
                time_spent=self.elapsed_time,
                rank=rank
            )
            self.final_results.append(result)
    
    # ==================== Data Access Methods ====================
    
    def get_board_size_text(self) -> str:
        """Get human-readable deck size text"""
        if self.board_size == 16:
            return 'Klein (16 Karten)'
        elif self.board_size == 36:
            return 'Mittel (36 Karten)'
        elif self.board_size == 64:
            return 'Groß (64 Karten)'
        return ''
    
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
            "pairs_found": self.pairs_found,
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
                    "time_spent": r.time_spent,
                    "rank": r.rank
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
        game_mode: GameMode = GameMode.SINGLEPLAYER_TIME
    ) -> GameSession:
        """
        Create and register a new game session.
        
        Args:
            player_ids: List of player IDs participating
            difficulty: Difficulty level ('Leicht', 'Mittel', 'Schwer', 'None')
            board_size: Number of cards (16, 36, or 64)
            game_mode: Type of game (SINGLEPLAYER_TIME, SINGLEPLAYER_AI, MULTIPLAYER)
            
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

