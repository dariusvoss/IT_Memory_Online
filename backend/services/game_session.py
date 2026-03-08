"""
Game Session Management Module

Handles the state and logic for individual game sessions.
Supports singleplayer and multiplayer games modes.
This is the unified game logic module that combines all game mechanics.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import random
from services.bot import BotAI
from config import CARD_IMAGES, RANK_THRESHOLDS
from utils import validate_card_count, format_time
from models import (
    GameStatus, GameMode, Card, Move, MatchedPair, 
    PlayerResult
)


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
        self.created_at = datetime.now(tz=timezone.utc)
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
        self.selected_cards: List[Tuple[int, Card]] = []  # Store (card_index, card) tuples
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
        
        # ==================== Move Finalization ====================
        self.last_unmatched_cards: List[int] = []  # Cards that need to be flipped back when finalized
    
    # ==================== Card Initialization ====================
    
    def initialize_game(self) -> None:
        """
        Initialize game with specified board size.
        Creates and shuffles card deck.
        """
        if not validate_card_count(self.board_size):
            raise ValueError(f"Invalid board size: {self.board_size}. Must be 16, 36, or 64.")
        
        # Validate that we have enough card images
        required_images = self.board_size // 2
        if len(CARD_IMAGES) < required_images:
            raise ValueError(
                f"Insufficient card images: need {required_images} unique images for board size {self.board_size}, "
                f"but only {len(CARD_IMAGES)} are configured."
            )
        
        # Select images for this session
        self.selected_images = CARD_IMAGES[:required_images]
        
        # Create cards (two of each image)
        self.cards = []
        for index, image in enumerate(self.selected_images):
            self.cards.append(Card(id=index, image=image, position=len(self.cards)))
            self.cards.append(Card(id=index, image=image, position=len(self.cards)))
        
        # Shuffle cards
        self.shuffle_cards()
        
        # Reset game state
        self.status = GameStatus.WAITING  # Ensure status is WAITING when initializing
        self.finished = False
        self.selected_cards = []
        self.pairs_found = 0
        self.player_points = {pid: 0 for pid in self.player_ids}
        self.move_history = []
        self.matched_pairs = []
        self.started_at = None
        self.ended_at = None
        
        # Initialize bot if needed
        if self.bot_ai:
            self.bot_ai.initialize(self.board_size)
    
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
        # Store card with its index for later reference in check_match
        self.selected_cards.append((card_index, card))
        
        # Remember card for bot (only for 'Schwer' difficulty when player flips cards)
        if self.bot_ai and self.game_mode == GameMode.SINGLEPLAYER_AI and self.difficulty == 'Schwer':
            self.bot_ai.remember_card(card_index, card.id, seen_by='player')
        
        return True
    
    def check_match(self) -> Tuple[bool, List[int]]:
        """
        Check if the two selected cards match.
        Handles scoring and turn switching.
        NOTE: Does NOT flip cards back on mismatch - Frontend handles card flipping animation.
        
        Returns:
            Tuple of (is_match: bool, card_positions: List[int])
        """
        if len(self.selected_cards) < 2:
            return False, []

        # Extract card index and card from tuples
        idx1, card1 = self.selected_cards[0]
        idx2, card2 = self.selected_cards[1]

        # Determine if cards match
        is_pair = card1.id == card2.id

        if is_pair:
            self.match_cards(card1, card2, idx1, idx2)
        else:
            # No match - Record unsuccessful move
            # NOTE: Cards stay flipped! Frontend will flip them back after cardVisibilityDuration.
            # Only after Frontend calls finalize-move will cards be actually flipped back.
            self.record_move(
                self.current_player_turn,
                [idx1, idx2],
                is_match=False
            )

            # Store indices for later finalization
            self.last_unmatched_cards = [idx1, idx2]

            # Switch turn on mismatch (except in singleplayer time mode)
            if self.game_mode in [GameMode.SINGLEPLAYER_AI, GameMode.MULTIPLAYER]:
                self.next_turn()

        # Clear selected cards
        self.selected_cards = []

        return is_pair, [idx1, idx2]

    def match_cards(self, card1, card2, idx1, idx2):
        # Mark cards as matched
        card1.matched = True
        card2.matched = True

        # Award points to current player
        self.pairs_found += 1
        self.player_points[self.current_player_turn] += 1

        # Store matched pair record
        self.matched_pairs.append(
            MatchedPair(
                card_indices=(idx1, idx2),
                matched_by=self.current_player_turn,
                match_time=datetime.now(tz=timezone.utc)
            )
        )

        # Record successful move
        self.record_move(
            self.current_player_turn,
            [idx1, idx2],
            is_match=True
        )

        # Remove cards from bot memory
        if self.bot_ai:
            self.bot_ai.forget_card(idx1)
            self.bot_ai.forget_card(idx2)
    
    
    def finalize_move(self) -> None:
        """
        Finalize the last move: flip back unmatched cards.
        Called by Frontend after cardVisibilityDuration.
        This ensures perfect synchronization between Frontend and Backend.
        """
        for idx in self.last_unmatched_cards:
            if 0 <= idx < len(self.cards):
                self.cards[idx].flipped = False
        
        self.last_unmatched_cards = []
    
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
            timestamp=datetime.now(tz=timezone.utc),
            move_number=len(self.move_history) + 1
        )
        self.move_history.append(move)
    
    # ==================== Bot Logic ====================
    
    def bot_move(self) -> Optional[Dict]:
        """
        Execute bot's move based on difficulty level.
        Bot decides which cards to flip, then GameSession executes the move.
        
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

        # Get bot's decision (which cards to flip)
        first_idx, second_idx = self.bot_ai.decide_move(available_cards)

        if second_idx == -1:
            return None  # Not enough cards available

        # Execute the move
        self.flip_card(self.current_player_turn, first_idx)
        # Bot remembers its own cards
        if self.difficulty in ['Mittel', 'Schwer']:
            first_card = self.cards[first_idx]

            self.bot_ai.remember_card(first_idx, first_card.id, seen_by='bot')

        self.flip_card(self.current_player_turn, second_idx)
        # Bot remembers its own cards
        if self.difficulty in ['Mittel', 'Schwer']:
            second_card = self.cards[second_idx]

            self.bot_ai.remember_card(second_idx, second_card.id, seen_by='bot')

        # Check if bot's cards match (important: must be done here!)
        is_match, matched_positions = self.check_match()

        return {
            'type': 'bot_move',
            'first_card': first_idx,
            'second_card': second_idx,
            'is_pair': is_match,
            'matched_positions': matched_positions
        }
    
    # ==================== Scoring & Ranking ====================
    
    def calculate_rank(self, time_seconds: int) -> str:
        """
        Calculate rank based on time and board size using RANK_THRESHOLDS from config.
        Used for singleplayer "Player vs. Time" mode.
        
        Args:
            time_seconds: Time elapsed in seconds
            
        Returns:
            Rank (A, B, C, D, E) based on thresholds
        """
        # Get thresholds for this board size
        thresholds = RANK_THRESHOLDS.get(self.board_size, {})
        
        if not thresholds:
            return 'E'  # Default to E if board size not configured
        
        # Check thresholds in order: A < B < C < D < E
        if time_seconds < thresholds['A']:
            return 'A'
        elif time_seconds < thresholds['B']:
            return 'B'
        elif time_seconds < thresholds['C']:
            return 'C'
        elif time_seconds < thresholds['D']:
            return 'D'
        else:
            return 'E'
    
    # ==================== Win Condition & Finishing ====================
    
    def check_win_condition(self) -> bool:
        """
        Check if the game should end.
        Game ends when all cards are matched or time expires.
        
        Returns:
            True if game should end, False otherwise
        """
        # Guard against uninitialized game (no cards yet)
        if not self.cards:
            return False
        
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
        self.ended_at = datetime.now(tz=timezone.utc)
        self.finalize_move()  # Flip back any unmatched cards and clear the list

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
                moves_count=sum(m.player_id == pid for m in self.move_history),
                time_spent=self.elapsed_time,
                rank=rank,
            )
            self.final_results.append(result)
    
    def start_game(self) -> None:
        """
        Start the game session.
        Changes status from WAITING to ACTIVE and sets start time.
        """
        if self.status != GameStatus.WAITING:
            raise ValueError(f"Cannot start game with status: {self.status}")
        
        self.status = GameStatus.ACTIVE
        self.started_at = datetime.now(tz=timezone.utc)
    
    def reset_game(self) -> None:
        """
        Reset the game to initial state.
        Re-initializes cards and clears game progress.
        """
        self.status = GameStatus.WAITING
        self.finished = False
        self.started_at = None
        self.ended_at = None
        self.winner = None
        self.final_results = []
        self.elapsed_time = 0
        self.time_expired = False
        self.last_unmatched_cards = []
        
        # Reset game state
        self.initialize_game()
        
        # Reset bot memory if applicable
        if self.bot_ai:
            self.bot_ai.clear_memory()
    
    def start_timer(self) -> None:
        """Start the game timer"""
        if self.status != GameStatus.ACTIVE:
            raise ValueError(f"Cannot start timer with game status: {self.status}")
        if self.started_at is None:
            self.started_at = datetime.now(tz=timezone.utc)
    
    def stop_timer(self) -> None:
        """Stop the game timer and calculate elapsed time"""
        if self.started_at is not None:
            self.elapsed_time = int((datetime.now(tz=timezone.utc) - self.started_at).total_seconds())
    
    def get_formatted_elapsed_time(self) -> str:
        """Get elapsed time formatted as MM:SS using utils.format_time"""
        return format_time(self.elapsed_time)
    
    def check_win(self) -> bool:
        """
        Check if the game is won (alias for check_win_condition).
        Returns True if all cards are matched or time expired.
        """
        if self.check_win_condition():
            self.finish_game()
            return True
        return False

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
            "cards": [card.model_dump() for card in self.cards],
            "matched_pairs_count": len(self.matched_pairs),
            "pairs_found": self.pairs_found,
            "player_points": self.player_points,
            "elapsed_time": self.elapsed_time,
            "finished": self.finished,
            "winner": self.winner,
            "final_results": [r.model_dump() for r in self.final_results] if self.final_results else []
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
        Uses Pydantic model_dump() for automatic serialization (datetime -> ISO format).
        
        Returns:
            List of move records
        """
        result = []
        for move in self.move_history:
            move_dict = move.model_dump()
            # Convert datetime to ISO format string
            move_dict['timestamp'] = move_dict['timestamp'].isoformat() if isinstance(move_dict['timestamp'], datetime) else move_dict['timestamp']
            result.append(move_dict)
        return result
