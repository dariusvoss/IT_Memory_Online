from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from datetime import datetime
from enum import Enum

# ========================= Enum Types =========================

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


# ========================= Core Game Models =========================

class Card(BaseModel):
    """Represents a single card on the board"""
    id: int
    image: str
    flipped: bool = False
    matched: bool = False
    position: int = 0


class Move(BaseModel):
    """Records a single move in the game"""
    player_id: str
    card_indices: List[int]
    is_match: bool
    timestamp: datetime
    move_number: int


class MatchedPair(BaseModel):
    """Records a successfully matched pair"""
    card_indices: Tuple[int, int]
    matched_by: str
    match_time: datetime


class PlayerResult(BaseModel):
    """Final results for a player after game ends"""
    player_id: str
    points: int
    is_winner: bool
    moves_count: int
    time_spent: int
    rank: Optional[str] = None  # For time-based ranking


class BotState(BaseModel):
    """Tracking state for bot in singleplayer mode 'Player vs. Bot'"""
    bot_id: str
    difficulty: str  # 'Leicht', 'Mittel', 'Schwer'
    card_memory: Dict[int, int] = Field(default_factory=dict)  # position -> id
    known_pairs: List[Tuple[int, int]] = Field(default_factory=list)
    last_seen_cards: List[int] = Field(default_factory=list)


# ========================= API Request Models =========================

class MoveRequest(BaseModel):
    """Request to flip a card"""
    card_index: int


class BotMoveRequest(BaseModel):
    """Request for bot to make a move"""
    available_cards: List[Card]


class CreateGameRequest(BaseModel):
    """Request to create a new game session"""
    player_ids: List[str]
    difficulty: str  # 'Leicht', 'Mittel', 'Schwer'
    board_size: int  # 16, 36, 64
    game_mode: str = 'singleplayer_time'  # 'singleplayer_time', 'singleplayer_ai', 'multiplayer'
    bonus_effekt: bool = False


class FlipCardRequest(BaseModel):
    """Request to flip a card"""
    card_index: int
    player_id: Optional[str] = None


class BonusTriggerRequest(BaseModel):
    """Request to trigger a previously assigned bonus effect"""
    player_id: str
    effect_id: Optional[str] = None


# ========================= API Response Models =========================

class GameRecord(BaseModel):
    """Record of a completed game"""
    date: str
    mode: str
    difficulty_level: str
    deck_size: str
    points: str
    rank: str
    time: str


class GameStateResponse(BaseModel):
    """Response with current game state"""
    cards: List[Card]
    is_player_turn: bool
    pairs_found: int
    player_points: int
    bot_points: int
    difficulty: str
    game_started: bool
    timer: int
