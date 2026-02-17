from pydantic import BaseModel
from typing import List, Optional

class Card(BaseModel):
    id: int
    image: str
    flipped: bool
    matched: bool

class GameRecord(BaseModel):
    date: str
    mode: str
    difficulty_level: str
    deck_size: str
    points: str
    rank: str
    time: str

class MoveRequest(BaseModel):
    card_index: int

class BotMoveRequest(BaseModel):
    available_cards: List[Card]

class GameStateResponse(BaseModel):
    cards: List[Card]
    is_player_turn: bool
    pairs_found: int
    player_points: int
    bot_points: int
    difficulty: str
    game_started: bool
    timer: int
