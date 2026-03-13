"""
Matchmaker Service for Multiplayer Matching

Handles player queue management and automatic pairing for multiplayer games.
Players join a queue and are automatically matched into game sessions when
a pair becomes available.
"""

from typing import Dict, List, Optional, Callable
from datetime import datetime
import uuid
from enum import Enum
from pydantic import BaseModel, Field


class MatchStatus(str, Enum):
    """Status of a match"""
    MATCHED = "matched"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    COMPLETED = "completed"


class Match(BaseModel):
    """Represents a matched pair of players"""
    match_id: str
    player_ids: List[str]  # exactly 2 players
    created_at: datetime
    status: MatchStatus = MatchStatus.MATCHED
    game_session_id: Optional[str] = None
    deck_size: Optional[int] = None  # Kartensatzgröße
    bonus_effekt: bool = False
    metadata: Dict = Field(default_factory=dict)


class Matchmaker:
    """
    Manages player queue and automatic matching for multiplayer games.

    Players join a queue and are automatically paired when 2 players are available.
    Emits 'matched' event when a pair is found.

    Usage:
        matchmaker = Matchmaker()
        matchmaker.on_matched(lambda match: create_game_session(match))
        matchmaker.join_queue('player-123')
        matchmaker.join_queue('player-456')  # Triggers match
    """

    def __init__(self):
        self.queue: Dict[tuple[int, bool], List[str]] = {}  # (deck_size, bonus_effekt) -> [player_ids]
        self.matches: Dict[str, Match] = {}
        self.player_to_match: Dict[str, str] = {}  # player_id -> match_id
        self.player_deck_size: Dict[str, int] = {}  # player_id -> deck_size
        self.player_bonus_effekt: Dict[str, bool] = {}  # player_id -> bonus flag
        self.player_queue_key: Dict[str, tuple[int, bool]] = {}  # player_id -> queue key
        self._match_callback: Optional[Callable] = None

    def join_queue(self, player_id: str, deck_size: int, bonus_effekt: bool = False) -> bool:
        """
        Add a player to the matchmaking queue.
        Automatically triggers matching if 2 players are available.

        Args:
            player_id: Unique identifier for the player
            deck_size: Kartensatzgröße (z.B. 4, 6, 8, etc.)

        Returns:
            True if player was added, False if already in queue/match
        """
        if not player_id or deck_size <= 0:
            return False

        # Check if player is already in queue or matched
        if self.is_player_in_queue(player_id) or self.is_player_matched(player_id):
            return False

        queue_key = (deck_size, bonus_effekt)

        # Initialisiere Queue für diese Einstellungen wenn nötig
        if queue_key not in self.queue:
            self.queue[queue_key] = []

        self.queue[queue_key].append(player_id)
        self.player_deck_size[player_id] = deck_size
        self.player_bonus_effekt[player_id] = bonus_effekt
        self.player_queue_key[player_id] = queue_key
        self._try_match(queue_key)
        return True

    def leave_queue(self, player_id: str, deck_size: int = None, bonus_effekt: Optional[bool] = None) -> bool:
        """
        Remove a player from the queue.

        Args:
            player_id: Player to remove
            deck_size: Kartensatzgröße (optional, falls nicht angegeben, wird automatisch aus player_deck_size geholt)

        Returns:
            True if player was removed, False if not found
        """
        if player_id in self.player_queue_key:
            queue_key = self.player_queue_key[player_id]
            if queue_key not in self.queue:
                return False
            if player_id in self.queue[queue_key]:
                self.queue[queue_key].remove(player_id)
                if not self.queue[queue_key]:
                    del self.queue[queue_key]
                del self.player_deck_size[player_id]
                self.player_bonus_effekt.pop(player_id, None)
                del self.player_queue_key[player_id]
                return True
        return False

    def is_player_in_queue(self, player_id: str) -> bool:
        """Check if player is currently in the queue"""
        return player_id in self.player_deck_size

    def is_player_matched(self, player_id: str) -> bool:
        """Check if player is already matched in a game"""
        return player_id in self.player_to_match

    def get_queue(self) -> Dict[str, List[str]]:
        """Get current queue as a copy"""
        return {
            f"deck_{deck_size}_bonus_{str(bonus_effekt).lower()}": players.copy()
            for (deck_size, bonus_effekt), players in self.queue.items()
        }

    def get_queue_size(self) -> int:
        """Get number of players waiting in queue"""
        return sum(len(players) for players in self.queue.values())

    def _try_match(self, queue_key: tuple[int, bool]) -> Optional[Match]:
        """
        Try to match players mit der gleichen Kartensatzgröße.

        Args:
            queue_key: (deck_size, bonus_effekt)

        Returns:
            Match object if successful, None otherwise
        """
        if queue_key not in self.queue or len(self.queue[queue_key]) < 2:
            return None

        deck_size, bonus_effekt = queue_key

        # Get first two players from queue
        player_a = self.queue[queue_key].pop(0)
        player_b = self.queue[queue_key].pop(0)

        # Leere Queue entfernen
        if not self.queue[queue_key]:
            del self.queue[queue_key]

        # Create match
        match = self._create_match([player_a, player_b], deck_size, bonus_effekt)

        # Register match
        self.matches[match.match_id] = match
        self.player_to_match[player_a] = match.match_id
        self.player_to_match[player_b] = match.match_id

        # Clean up player_deck_size
        del self.player_deck_size[player_a]
        del self.player_deck_size[player_b]
        self.player_bonus_effekt.pop(player_a, None)
        self.player_bonus_effekt.pop(player_b, None)
        self.player_queue_key.pop(player_a, None)
        self.player_queue_key.pop(player_b, None)

        # Trigger callback if registered
        if self._match_callback:
            self._match_callback(match)

        return match

    def _create_match(self, player_ids: List[str], deck_size: int, bonus_effekt: bool) -> Match:
        """Create a new match object"""
        match_id = str(uuid.uuid4())
        return Match(
            match_id=match_id,
            player_ids=player_ids,
            created_at=datetime.now(),
            deck_size=deck_size,
            bonus_effekt=bonus_effekt
        )

    def on_matched(self, callback: Callable[[Match], None]) -> None:
        """
        Register callback to be invoked when players are matched.

        Args:
            callback: Function that receives Match object

        Example:
            matchmaker.on_matched(lambda match: print(f"Matched: {match.player_ids}"))
        """
        self._match_callback = callback

    def get_match(self, match_id: str) -> Optional[Match]:
        """Get match details by ID"""
        return self.matches.get(match_id)

    def get_player_match(self, player_id: str) -> Optional[Match]:
        """Get match details for a specific player"""
        match_id = self.player_to_match.get(player_id)
        return self.matches.get(match_id) if match_id else None

    def set_match_game_session(self, match_id: str, game_session_id: str) -> bool:
        """
        Link a match to a game session after it's created.

        Args:
            match_id: ID of the match
            game_session_id: ID of the created game session

        Returns:
            True if successful, False if match not found
        """
        if match := self.matches.get(match_id):
            match.game_session_id = game_session_id
            match.status = MatchStatus.ACCEPTED
            return True
        return False

    def complete_match(self, match_id: str) -> bool:
        """
        Mark a match as completed (game finished).
        Optionally remove from matches dict for cleanup.

        Args:
            match_id: ID of the match

        Returns:
            True if successful, False if match not found
        """
        if match := self.matches.get(match_id):
            match.status = MatchStatus.COMPLETED
            return True
        return False

    def cancel_match(self, match_id: str) -> bool:
        """
        Cancel a match and free up players.
        Puts players back in queue if desired.

        Args:
            match_id: ID of match to cancel

        Returns:
            True if successful, False if match not found
        """
        match = self.matches.get(match_id)
        if not match:
            return False

        # Remove player associations
        for player_id in match.player_ids:
            if player_id in self.player_to_match:
                del self.player_to_match[player_id]

        # Mark as rejected
        match.status = MatchStatus.REJECTED

        return True

    def delete_match(self, match_id: str) -> bool:
        """Löscht ein Match aus der aktiven Match-Liste"""
        if match := self.matches.get(match_id):
            for player_id in match.player_ids:
                if player_id in self.player_to_match:
                    del self.player_to_match[player_id]
            del self.matches[match_id]
            return True
        return False

    def delete_match_by_session(self, session_id: str) -> bool:
        """Löscht ein Match anhand der verknüpften game_session_id"""
        return next(
            (
                self.delete_match(match_id)
                for match_id, match in list(self.matches.items())
                if match.game_session_id == session_id
            ),
            False,
        )

    def clear_queue(self) -> int:
        """
        Clear entire queue (for testing/admin).

        Returns:
            Number of players cleared
        """
        count = len(self.queue)
        self.queue.clear()
        return count

    def get_stats(self) -> Dict:
        """
        Get matchmaker statistics.

        Returns:
            Dictionary with queue size, matched count, etc.
        """
        return {
            "queue_by_settings": {
                f"deck_{deck_size}_bonus_{str(bonus_effekt).lower()}": len(players)
                for (deck_size, bonus_effekt), players in self.queue.items()
            },
            "total_queue_size": sum(
                len(players) for players in self.queue.values()
            ),
            "total_matches": len(self.matches),
            "active_matches": sum(
                m.status == MatchStatus.MATCHED for m in self.matches.values()
            ),
            "completed_matches": sum(
                m.status == MatchStatus.COMPLETED for m in self.matches.values()
            ),
        }

    def get_active_matches(self):
        """Gibt alle laufenden Matches zurück"""
        return [m for m in self.matches.values() if m.status == MatchStatus.MATCHED.value]


# Global instance
matchmaker = Matchmaker()