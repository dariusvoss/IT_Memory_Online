from __future__ import annotations

from dataclasses import dataclass, field
import random
from typing import Dict, List, Optional

from config import (
    BONUS_BLINDGAENGER_COUNT,
    BONUS_BLINDGAENGER_MULTIPLIER_BY_BOARD_SIZE,
)
from models import GameMode


BONUS_TRIGGER_INTERVAL = 3
TIME_BONUS_SECONDS_BY_BOARD_SIZE = {
    16: 15,
    36: 60,
    64: 180,
}
BLINDGAENGER_EFFECT_ID = "blindgaenger"


@dataclass(frozen=True)
class BonusEffectDefinition:
    effect_id: str
    label: str
    description: str
    category: str
    utility_weight: int
    auto_trigger: bool = False
    metadata: Dict[str, int] = field(default_factory=dict)

    def to_public_dict(self) -> Dict:
        return {
            "id": self.effect_id,
            "label": self.label,
            "description": self.description,
            "category": self.category,
            "utility_weight": self.utility_weight,
            "auto_trigger": self.auto_trigger,
            "metadata": dict(self.metadata),
        }


BASE_EFFECTS = [
    {
        "effect_id": "time_bonus",
        "allowed_modes": [GameMode.SINGLEPLAYER_TIME],
        "replacement_by_mode": {
            GameMode.SINGLEPLAYER_AI: "skip_turn",
            GameMode.MULTIPLAYER: "skip_turn",
        },
    },
    {
        "effect_id": "scouting_bonus",
        "allowed_modes": [GameMode.MULTIPLAYER,GameMode.SINGLEPLAYER_AI,GameMode.SINGLEPLAYER_TIME],
        "replacement_by_mode": {},
    },
    {
        "effect_id": "card_medium",
        "allowed_modes": [GameMode.MULTIPLAYER,GameMode.SINGLEPLAYER_AI,GameMode.SINGLEPLAYER_TIME],
        "replacement_by_mode": {},
    },
    {
        "effect_id": "whirlwind",
        "allowed_modes": [GameMode.MULTIPLAYER, GameMode.SINGLEPLAYER_AI, GameMode.SINGLEPLAYER_TIME],
        "replacement_by_mode": {},
    }
]


BONUS_EFFECT_DEFINITIONS: Dict[str, BonusEffectDefinition] = {
    "time_bonus": BonusEffectDefinition(
        effect_id="time_bonus",
        label="Zeitbonus",
        description="Reduziert deine aktuelle Zeit.",
        category="time",
        utility_weight=5,
        auto_trigger=False,
        metadata={"seconds": TIME_BONUS_SECONDS_BY_BOARD_SIZE[16]},
    ),
    "skip_turn": BonusEffectDefinition(
        effect_id="skip_turn",
        label="Aussetzen",
        description="Dein Gegner muss die nächste Runde aussetzen. Du bist direkt wieder dran.",
        category="turn_control",
        utility_weight=4,
        auto_trigger=False,
    ),
    "scouting_bonus": BonusEffectDefinition(
        effect_id="scouting_bonus",
        label="Scouting-Bonus",
        description="Nach deinen nächsten zwei Karten darfst du zusätzlich eine dritte Karte nur für dich aufdecken.",
        category="information",
        utility_weight=3,
        auto_trigger=False,
    ),
    "card_medium": BonusEffectDefinition(
        effect_id="card_medium",
        label="Kartenmedium",
        description="Du siehst privat eine passende Partnerkarte und hast zwei Versuche, das Paar sofort zu treffen.",
        category="information",
        utility_weight=4,
        auto_trigger=False,
    ),
    "whirlwind": BonusEffectDefinition(
        effect_id="whirlwind",
        label="Wirbelwind",
        description="Mischt alle Karten zufällig durch. Bereits aufgedeckte Karten bleiben aufgedeckt.",
        category="board_control",
        utility_weight=4,
        auto_trigger=False,
    )
}


def get_time_bonus_seconds(board_size: int) -> int:
    return TIME_BONUS_SECONDS_BY_BOARD_SIZE.get(board_size, TIME_BONUS_SECONDS_BY_BOARD_SIZE[16])


def _format_time_bonus_description(seconds: int) -> str:
    if seconds == 60:
        return "Reduziert deine aktuelle Zeit um 1 Minute."
    if seconds % 60 == 0 and seconds > 60:
        minutes = seconds // 60
        return f"Reduziert deine aktuelle Zeit um {minutes} Minuten."
    return f"Reduziert deine aktuelle Zeit um {seconds} Sekunden."


def get_bonus_effect_definition(effect_id: str, board_size: Optional[int] = None) -> BonusEffectDefinition:
    if effect_id not in BONUS_EFFECT_DEFINITIONS:
        raise ValueError(f"Unknown bonus effect: {effect_id}")

    base_definition = BONUS_EFFECT_DEFINITIONS[effect_id]
    if effect_id != "time_bonus" or board_size is None:
        return base_definition

    seconds = get_time_bonus_seconds(board_size)
    return BonusEffectDefinition(
        effect_id=base_definition.effect_id,
        label=base_definition.label,
        description=_format_time_bonus_description(seconds),
        category=base_definition.category,
        utility_weight=base_definition.utility_weight,
        auto_trigger=base_definition.auto_trigger,
        metadata={"seconds": seconds},
    )


def build_effect_pool(game_mode: GameMode, board_size: int) -> List[str]:
    resolved_effects: List[str] = []

    for effect in BASE_EFFECTS:
        if game_mode in effect["allowed_modes"]:
            resolved_effect_id = effect["effect_id"]
        else:
            resolved_effect_id = effect["replacement_by_mode"].get(game_mode)

        if resolved_effect_id and resolved_effect_id not in resolved_effects:
            resolved_effects.append(resolved_effect_id)

    multiplier = BONUS_BLINDGAENGER_MULTIPLIER_BY_BOARD_SIZE.get(board_size, 1)
    blindgaenger_count = BONUS_BLINDGAENGER_COUNT * multiplier
    if blindgaenger_count > 0:
        resolved_effects.extend([BLINDGAENGER_EFFECT_ID] * blindgaenger_count)

    random.shuffle(resolved_effects)
    # print(f"Built effect pool for mode {game_mode} and board size {board_size}: {resolved_effects}")
    return resolved_effects


def serialize_bonus_effect(effect_id: str, board_size: Optional[int] = None) -> Dict:
    return get_bonus_effect_definition(effect_id, board_size).to_public_dict()