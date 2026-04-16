"""
Game Session Management Module

Handles the state and logic for individual game sessions.
Supports singleplayer and multiplayer games modes.
This is the unified game logic module that combines all game mechanics.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import random
from services.bot import BotAI
from services.bonus_effects import (
    BONUS_TRIGGER_INTERVAL,
    build_effect_pool,
    get_bonus_effect_definition,
    serialize_bonus_effect,
)
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
        game_mode: GameMode = GameMode.SINGLEPLAYER_TIME,
        bonus_effekt: bool = False
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
        self.bonus_effekt = bonus_effekt
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
        self.time_bonus_seconds_used = 0
        
        # ==================== Metadata ====================
        self.metadata: Dict[str, Any] = {}
        
        # ==================== Move Finalization ====================
        self.last_unmatched_cards: List[int] = []  # Cards that need to be flipped back when finalized
        self.round_counter = 0
        self.bonus_trigger_count = 0
        self.last_bonus_trigger_round: Optional[int] = None
        self.bonus_trigger_interval = BONUS_TRIGGER_INTERVAL
        self.bonus_random = random.Random(f"{session_id}-bonus")
        self.player_effect_pool: Dict[str, List[str]] = {}
        self.player_ready_effects: Dict[str, List[str]] = {}
        self.player_used_effects: Dict[str, List[str]] = {}
        self.player_bonus_history: Dict[str, List[Dict[str, Any]]] = {}
        self.player_bonus_notifications: Dict[str, List[Dict[str, Any]]] = {}
        self.player_skip_tokens: Dict[str, int] = {}
        self.player_scouting_charges: Dict[str, int] = {}
        self.player_private_scout_pending: Dict[str, bool] = {}
        self.player_seen_card_positions: Dict[str, Dict[int, set[int]]] = {}
        self.player_card_medium_preview: Dict[str, Optional[int]] = {}
        self.player_card_medium_attempts: Dict[str, int] = {}
        self.bonus_event_counter = 0
    
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
        self.last_unmatched_cards = []
        self.pairs_found = 0
        self.player_points = {pid: 0 for pid in self.player_ids}
        self.move_history = []
        self.matched_pairs = []
        self.started_at = None
        self.ended_at = None
        self.current_turn_index = 0
        self.current_player_turn = self.player_ids[0]
        self.round_counter = 0
        self.bonus_trigger_count = 0
        self.last_bonus_trigger_round = None
        self.time_bonus_seconds_used = 0
        self._initialize_bonus_state()
        self.metadata.pop("tie_break", None)
        
        # Initialize bot if needed
        if self.bot_ai:
            self.bot_ai.initialize(self.board_size)

    def _initialize_bonus_state(self) -> None:
        effect_pool = build_effect_pool(self.game_mode) if self.bonus_effekt else []
        self.player_effect_pool = {pid: list(effect_pool) for pid in self.player_ids}
        self.player_ready_effects = {pid: [] for pid in self.player_ids}
        self.player_used_effects = {pid: [] for pid in self.player_ids}
        self.player_bonus_history = {pid: [] for pid in self.player_ids}
        self.player_bonus_notifications = {pid: [] for pid in self.player_ids}
        self.player_skip_tokens = {pid: 0 for pid in self.player_ids}
        self.player_scouting_charges = {pid: 0 for pid in self.player_ids}
        self.player_private_scout_pending = {pid: False for pid in self.player_ids}
        self.player_seen_card_positions = {pid: {} for pid in self.player_ids}
        self.player_card_medium_preview = {pid: None for pid in self.player_ids}
        self.player_card_medium_attempts = {pid: 0 for pid in self.player_ids}
        self.bonus_event_counter = 0
    
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

        preview_card_index = self.player_card_medium_preview.get(player_id)
        if (
            len(self.selected_cards) == 0
            and preview_card_index is not None
            and preview_card_index != card_index
            and 0 <= preview_card_index < len(self.cards)
        ):
            preview_card = self.cards[preview_card_index]
            if not preview_card.matched and card.id == preview_card.id:
                preview_card.flipped = True
                card.flipped = True
                self.selected_cards = [(preview_card_index, preview_card), (card_index, card)]
                self._remember_seen_card(player_id, preview_card_index, preview_card.id)
                self._remember_seen_card(player_id, card_index, card.id)

                if self.bot_ai and self.game_mode == GameMode.SINGLEPLAYER_AI and self.difficulty == 'Schwer':
                    self.bot_ai.remember_card(card_index, card.id, seen_by='player')

                return True

        # Can't select more than 2 cards per turn
        if len(self.selected_cards) >= 2:
            return False
        
        # Flip the card
        card.flipped = True
        # Store card with its index for later reference in check_match
        self.selected_cards.append((card_index, card))
        self._remember_seen_card(player_id, card_index, card.id)
        
        # Remember card for bot (only for 'Schwer' difficulty when player flips cards)
        if self.bot_ai and self.game_mode == GameMode.SINGLEPLAYER_AI and self.difficulty == 'Schwer':
            self.bot_ai.remember_card(card_index, card.id, seen_by='player')
        
        return True

    def _remember_seen_card(self, player_id: str, card_index: int, card_id: int) -> None:
        seen_by_player = self.player_seen_card_positions.setdefault(player_id, {})
        seen_positions = seen_by_player.setdefault(card_id, set())
        seen_positions.add(card_index)

    def _get_card_medium_partner_candidates(self, player_id: str) -> List[int]:
        seen_by_player = self.player_seen_card_positions.get(player_id, {})
        partner_candidates: set[int] = set()

        for card_id, seen_positions in seen_by_player.items():
            unresolved_positions = [
                idx for idx, card in enumerate(self.cards)
                if card.id == card_id and not card.matched
            ]

            if len(unresolved_positions) < 2:
                continue

            for seen_pos in seen_positions:
                if seen_pos not in unresolved_positions:
                    continue

                for partner_idx in unresolved_positions:
                    if partner_idx == seen_pos:
                        continue

                    partner_card = self.cards[partner_idx]
                    if partner_card.matched or partner_card.flipped:
                        continue

                    partner_candidates.add(partner_idx)

        return list(partner_candidates)

    def _activate_card_medium_preview(self, player_id: str) -> Optional[int]:
        candidates = self._get_card_medium_partner_candidates(player_id)
        if not candidates:
            self.player_card_medium_preview[player_id] = None
            self.player_card_medium_attempts[player_id] = 0
            return None

        preview_card_index = self.bonus_random.choice(candidates)
        self.player_card_medium_preview[player_id] = preview_card_index
        self.player_card_medium_attempts[player_id] = 2

        preview_card = self.cards[preview_card_index]
        self._remember_seen_card(player_id, preview_card_index, preview_card.id)
        return preview_card_index
    
    def _activate_private_scout_window(self, player_id: str) -> bool:
        if self.player_scouting_charges.get(player_id, 0) <= 0:
            return False

        self.player_scouting_charges[player_id] -= 1
        self.player_private_scout_pending[player_id] = True
        return True

    def check_match(self) -> Tuple[bool, List[int], bool]:
        """
        Check if the two selected cards match.
        Handles scoring and turn switching.
        NOTE: Does NOT flip cards back on mismatch - Frontend handles card flipping animation.
        
        Returns:
            Tuple of (is_match: bool, card_positions: List[int], bonus_triggered: bool)
        """
        if len(self.selected_cards) < 2:
            return False, [], False

        # Extract card index and card from tuples
        idx1, card1 = self.selected_cards[0]
        idx2, card2 = self.selected_cards[1]
        self.last_unmatched_cards = []

        acting_player = self.current_player_turn
        medium_preview_index = self.player_card_medium_preview.get(acting_player)
        medium_match_index: Optional[int] = None

        if medium_preview_index is not None and 0 <= medium_preview_index < len(self.cards):
            preview_card = self.cards[medium_preview_index]
            if not preview_card.matched:
                if idx1 != medium_preview_index and card1.id == preview_card.id:
                    medium_match_index = idx1
                elif idx2 != medium_preview_index and card2.id == preview_card.id:
                    medium_match_index = idx2

        # Determine if cards match
        is_pair = card1.id == card2.id or medium_match_index is not None

        if medium_match_index is not None and medium_preview_index is not None:
            medium_card = self.cards[medium_match_index]
            preview_card = self.cards[medium_preview_index]
            preview_card.flipped = True

            self.match_cards(preview_card, medium_card, medium_preview_index, medium_match_index)

            non_matching_index = idx2 if medium_match_index == idx1 else idx1
            non_matching_card = self.cards[non_matching_index]
            if not non_matching_card.matched:
                non_matching_card.flipped = False
        elif is_pair:
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

        # Kartenmedium preview is only valid for the current two-card attempt.
        self.player_card_medium_preview[acting_player] = None
        self.player_card_medium_attempts[acting_player] = 0

        # Clear selected cards
        self.selected_cards = []

        # A round is complete after two cards were processed.
        self.round_counter += 1
        self._activate_private_scout_window(acting_player)
        bonus_triggered = self._evaluate_bonus_trigger(acting_player)

        if medium_match_index is not None and medium_preview_index is not None:
            return True, [medium_preview_index, medium_match_index], bonus_triggered

        return is_pair, [idx1, idx2], bonus_triggered

    def _evaluate_bonus_trigger(self, player_id: str) -> bool:
        """Assign a bonus effect after a fixed number of completed rounds."""
        if not self.bonus_effekt:
            return False

        if player_id not in self.player_ids:
            return False

        if self.round_counter > 0 and self.round_counter % self.bonus_trigger_interval == 0:
            assigned_effect = self.assign_bonus_effect(player_id)
            if not assigned_effect:
                return False

            self.bonus_trigger_count += 1
            self.last_bonus_trigger_round = self.round_counter
            return True

        return False

    def assign_bonus_effect(self, player_id: str) -> Optional[str]:
        if not self.bonus_effekt:
            return None

        effect_pool = self.player_effect_pool.get(player_id, [])
        if not effect_pool:
            return None

        effect_id = self.bonus_random.choice(effect_pool)
        effect_pool.remove(effect_id)
        definition = get_bonus_effect_definition(effect_id)

        should_auto_trigger = definition.auto_trigger or player_id == 'bot'

        if should_auto_trigger:
            self.use_bonus_effect(
                player_id,
                effect_id,
                assignment_round=self.round_counter,
                auto_assigned=should_auto_trigger,
            )
            return effect_id

        self.player_ready_effects[player_id].append(effect_id)
        self._create_bonus_notification(
            player_id,
            event_type="effect_ready",
            effect_id=effect_id,
            assignment_round=self.round_counter,
        )
        return effect_id

    def get_player_bonus_state(self, player_id: str) -> Dict[str, Any]:
        ready_effects = self.player_ready_effects.get(player_id, [])
        used_effects = self.player_used_effects.get(player_id, [])
        notifications = self.player_bonus_notifications.get(player_id, [])
        medium_preview_index = self.player_card_medium_preview.get(player_id)

        return {
            "bonus_enabled": self.bonus_effekt,
            "trigger_interval": self.bonus_trigger_interval,
            "ready_effects": [serialize_bonus_effect(effect_id) for effect_id in ready_effects],
            "used_effects": [serialize_bonus_effect(effect_id) for effect_id in used_effects],
            "remaining_pool_size": len(self.player_effect_pool.get(player_id, [])),
            "scouting_charge_count": self.player_scouting_charges.get(player_id, 0),
            "scouting_reveal_available": self.player_private_scout_pending.get(player_id, False),
            "medium_preview_active": medium_preview_index is not None,
            "medium_preview_card_index": medium_preview_index,
            "medium_attempts_remaining": self.player_card_medium_attempts.get(player_id, 0),
            "can_trigger": bool(
                not self.finished
                and self.current_player_turn == player_id
                and len(ready_effects) > 0
            ),
            "notifications": notifications,
            "time_bonus_seconds_used": self.time_bonus_seconds_used,
        }

    def trigger_bonus_effect(self, player_id: str, effect_id: Optional[str] = None) -> Dict[str, Any]:
        if not self.bonus_effekt:
            raise ValueError("Bonus effects are disabled for this session")

        if player_id not in self.player_ids:
            raise ValueError("Player is not part of this session")

        if player_id != self.current_player_turn:
            raise ValueError("Bonus effect can only be triggered during your turn")

        ready_effects = self.player_ready_effects.get(player_id, [])
        if not ready_effects:
            raise ValueError("No ready bonus effect available")

        selected_effect_id = effect_id or ready_effects[0]
        if selected_effect_id not in ready_effects:
            raise ValueError("Requested bonus effect is not ready")

        if selected_effect_id == "card_medium" and len(self.selected_cards) > 0:
            raise ValueError("Kartenmedium kann nur vor der ersten Kartenwahl im Zug aktiviert werden")

        ready_effects.remove(selected_effect_id)
        return self.use_bonus_effect(player_id, selected_effect_id, assignment_round=self.round_counter)

    def use_bonus_effect(
        self,
        player_id: str,
        effect_id: str,
        assignment_round: int,
        auto_assigned: bool = False,
    ) -> Dict[str, Any]:
        definition = get_bonus_effect_definition(effect_id)

        if effect_id not in self.player_used_effects[player_id]:
            self.player_used_effects[player_id].append(effect_id)

        self.player_bonus_history[player_id].append(
            {
                "effect_id": effect_id,
                "category": definition.category,
                "utility_weight": definition.utility_weight,
                "used_at_round": self.round_counter,
                "assigned_at_round": assignment_round,
                "auto_assigned": auto_assigned,
            }
        )

        is_auto_triggered = definition.auto_trigger or player_id == 'bot'

        result = {
            "effect": definition.to_public_dict(),
            "player_id": player_id,
            "applied": True,
            "auto_triggered": is_auto_triggered,
        }

        if effect_id == "time_bonus":
            seconds = definition.metadata.get("seconds", 0)
            self.time_bonus_seconds_used += seconds
            self.elapsed_time = self.get_effective_elapsed_time()
            result["time_reduced_seconds"] = seconds
            result["elapsed_time"] = self.elapsed_time
            self._create_bonus_notification(
                player_id,
                event_type="effect_used",
                effect_id=effect_id,
                assignment_round=assignment_round,
            )
        elif effect_id == "skip_turn":
            skipped_players = [pid for pid in self.player_ids if pid != player_id]
            for skipped_player_id in skipped_players:
                self.player_skip_tokens[skipped_player_id] = self.player_skip_tokens.get(skipped_player_id, 0) + 1
            result["skip_applied_to"] = skipped_players
            
            # Notification for the player who triggered the effect
            self._create_bonus_notification(
                player_id,
                event_type="effect_auto_used",
                effect_id=effect_id,
                assignment_round=assignment_round,
            )
            
            # Notifications for affected players (those being skipped)
            for skipped_player_id in skipped_players:
                self._create_skip_turn_affected_notification(
                    skipped_player_id,
                    assignment_round=assignment_round,
                )

            if self.current_player_turn in skipped_players and self.game_mode in [GameMode.SINGLEPLAYER_AI, GameMode.MULTIPLAYER]:
                # Consume the token now so next_turn() doesn't double-skip this player later
                self.player_skip_tokens[self.current_player_turn] -= 1
                self.next_turn()
        elif effect_id == "scouting_bonus":
            self.player_scouting_charges[player_id] = self.player_scouting_charges.get(player_id, 0) + 1
            result["scouting_charge_count"] = self.player_scouting_charges[player_id]
            self._create_bonus_notification(
                player_id,
                event_type="effect_used",
                effect_id=effect_id,
                assignment_round=assignment_round,
            )
        elif effect_id == "card_medium":
            preview_card_index = self._activate_card_medium_preview(player_id)
            result["preview_card_index"] = preview_card_index
            result["preview_available"] = preview_card_index is not None
            result["attempts_remaining"] = self.player_card_medium_attempts.get(player_id, 0)

            self._create_bonus_notification(
                player_id,
                event_type="effect_used",
                effect_id=effect_id,
                assignment_round=assignment_round,
            )

            if preview_card_index is None and self.player_bonus_notifications[player_id]:
                self.player_bonus_notifications[player_id][-1]["title"] = "Kartenmedium eingesetzt"
                self.player_bonus_notifications[player_id][-1]["message"] = "Aktuell gibt es keine passende Partnerkarte aus deinem bisherigen Wissen."

        return result

    def _create_bonus_notification(
        self,
        player_id: str,
        event_type: str,
        effect_id: str,
        assignment_round: int,
    ) -> None:
        definition = get_bonus_effect_definition(effect_id)
        self.bonus_event_counter += 1

        if event_type == "effect_ready":
            title = definition.label
            message = f"{definition.label} wurde dir zugewiesen. Du kannst den Effekt in deinem Zug auslösen."
        elif event_type == "effect_auto_used":
            title = definition.label
            message = definition.description
        else:
            title = f"{definition.label} eingesetzt"
            message = definition.description

        self.player_bonus_notifications[player_id].append(
            {
                "id": self.bonus_event_counter,
                "type": event_type,
                "round": assignment_round,
                "effect": definition.to_public_dict(),
                "title": title,
                "message": message,
            }
        )

    def _create_skip_turn_affected_notification(
        self,
        player_id: str,
        assignment_round: int,
    ) -> None:
        """Create a notification for a player affected by skip_turn effect."""
        self.bonus_event_counter += 1
        definition = get_bonus_effect_definition("skip_turn")

        self.player_bonus_notifications[player_id].append(
            {
                "id": self.bonus_event_counter,
                "type": "effect_used_on_you",
                "round": assignment_round,
                "effect": definition.to_public_dict(),
                "title": "Du musst aussetzen!",
                "message": "Dein Gegner hat den Aussetzen-Effekt eingesetzt. Du überspringst die nächste Runde.",
            }
        )

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
    
    
    def finalize_move(self, player_id: Optional[str] = None) -> None:
        """
        Finalize the last move: flip back unmatched cards.
        Called by Frontend after cardVisibilityDuration.
        This ensures perfect synchronization between Frontend and Backend.
        """
        for idx in self.last_unmatched_cards:
            if 0 <= idx < len(self.cards):
                self.cards[idx].flipped = False
        
        self.last_unmatched_cards = []

        if player_id and player_id in self.player_private_scout_pending:
            self.player_private_scout_pending[player_id] = False
            self.player_card_medium_preview[player_id] = None
            self.player_card_medium_attempts[player_id] = 0
        elif player_id is None:
            self.player_private_scout_pending = {pid: False for pid in self.player_ids}
            self.player_card_medium_preview = {pid: None for pid in self.player_ids}
            self.player_card_medium_attempts = {pid: 0 for pid in self.player_ids}
    
    def next_turn(self) -> None:
        """
        Switch to the next player's turn.
        Updates current_player_turn and resets selected cards.
        """
        if not self.turn_order:
            return

        for _ in range(len(self.turn_order)):
            self.current_turn_index = (self.current_turn_index + 1) % len(self.turn_order)
            next_player = self.turn_order[self.current_turn_index]

            if self.player_skip_tokens.get(next_player, 0) > 0:
                self.player_skip_tokens[next_player] -= 1
                continue

            self.current_player_turn = next_player
            break

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
        is_match, matched_positions, bonus_triggered = self.check_match()

        return {
            'type': 'bot_move',
            'first_card': first_idx,
            'second_card': second_idx,
            'is_pair': is_match,
            'matched_positions': matched_positions,
            'bonus_triggered': bonus_triggered,
            'round_counter': self.round_counter
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
            self.elapsed_time = self.get_effective_elapsed_time(self.ended_at)

        # Determine winner(s)
        max_points = max(self.player_points.values()) if self.player_points else 0
        winners = [pid for pid, pts in self.player_points.items() if pts == max_points]

        if len(winners) > 1 and self.game_mode in [GameMode.SINGLEPLAYER_AI, GameMode.MULTIPLAYER]:
            utility_by_player = {
                pid: sum(entry["utility_weight"] for entry in self.player_bonus_history.get(pid, []))
                for pid in winners
            }
            used_count_by_player = {
                pid: len(self.player_bonus_history.get(pid, []))
                for pid in winners
            }
            lowest_utility = min(utility_by_player.values())
            winners = [pid for pid in winners if utility_by_player[pid] == lowest_utility]

            if len(winners) > 1:
                lowest_count = min(used_count_by_player[pid] for pid in winners)
                winners = [pid for pid in winners if used_count_by_player[pid] == lowest_count]

            self.metadata["tie_break"] = {
                "resolved": len(winners) == 1,
                "utility_by_player": utility_by_player,
                "used_count_by_player": used_count_by_player,
                "winner": winners[0] if len(winners) == 1 else None,
            }

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
        self.time_bonus_seconds_used = 0
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
            self.elapsed_time = self.get_effective_elapsed_time()

    def get_effective_elapsed_time(self, reference_time: Optional[datetime] = None) -> int:
        if self.started_at is None:
            return max(0, self.elapsed_time)

        effective_now = reference_time or datetime.now(tz=timezone.utc)
        raw_elapsed = int((effective_now - self.started_at).total_seconds())
        return max(0, raw_elapsed - self.time_bonus_seconds_used)
    
    def get_formatted_elapsed_time(self) -> str:
        """Get elapsed time formatted as MM:SS using utils.format_time"""
        return format_time(self.get_effective_elapsed_time())
    
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
            "bonus_effekt": self.bonus_effekt,
            "round_counter": self.round_counter,
            "bonus_trigger_count": self.bonus_trigger_count,
            "last_bonus_trigger_round": self.last_bonus_trigger_round,
            "bonus_trigger_interval": self.bonus_trigger_interval,
            "current_player": self.current_player_turn,
            "player_ids": self.player_ids,
            "cards": [card.model_dump() for card in self.cards],
            "matched_pairs_count": len(self.matched_pairs),
            "pairs_found": self.pairs_found,
            "player_points": self.player_points,
            "elapsed_time": self.get_effective_elapsed_time() if self.started_at else self.elapsed_time,
            "finished": self.finished,
            "winner": self.winner,
            "final_results": [r.model_dump() for r in self.final_results] if self.final_results else [],
            "tie_break": self.metadata.get("tie_break"),
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
        session_dict["player_bonus_state"] = self.get_player_bonus_state(player_id)
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
