from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from models import GameMode


BONUS_TRIGGER_INTERVAL = 3
TIME_BONUS_SECONDS = 15


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
    # {
    #     "effect_id": "time_bonus",
    #     "allowed_modes": [GameMode.SINGLEPLAYER_TIME],
    #     "replacement_by_mode": {
    #         GameMode.SINGLEPLAYER_AI: "skip_turn",
    #         GameMode.MULTIPLAYER: "skip_turn",
    #     },
    # },
    {
        "effect_id": "scouting_bonus",
        "allowed_modes": [GameMode.MULTIPLAYER,GameMode.SINGLEPLAYER_AI,GameMode.SINGLEPLAYER_TIME],
        "replacement_by_mode": {},
    }#,
    # {
    #     "effect_id": "card_medium",
    #     "allowed_modes": [GameMode.MULTIPLAYER,GameMode.SINGLEPLAYER_AI,GameMode.SINGLEPLAYER_TIME],
    #     "replacement_by_mode": {},
    # }
]


BONUS_EFFECT_DEFINITIONS: Dict[str, BonusEffectDefinition] = {
    "time_bonus": BonusEffectDefinition(
        effect_id="time_bonus",
        label="Zeitbonus",
        description=f"Reduziert deine aktuelle Zeit um {TIME_BONUS_SECONDS} Sekunden.",
        category="time",
        utility_weight=5,
        auto_trigger=False,
        metadata={"seconds": TIME_BONUS_SECONDS},
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
}


def get_bonus_effect_definition(effect_id: str) -> BonusEffectDefinition:
    if effect_id not in BONUS_EFFECT_DEFINITIONS:
        raise ValueError(f"Unknown bonus effect: {effect_id}")
    return BONUS_EFFECT_DEFINITIONS[effect_id]


def build_effect_pool(game_mode: GameMode) -> List[str]:
    resolved_effects: List[str] = []

    for effect in BASE_EFFECTS:
        if game_mode in effect["allowed_modes"]:
            resolved_effect_id = effect["effect_id"]
        else:
            resolved_effect_id = effect["replacement_by_mode"].get(game_mode)

        if resolved_effect_id and resolved_effect_id not in resolved_effects:
            resolved_effects.append(resolved_effect_id)

    return resolved_effects


def serialize_bonus_effect(effect_id: str) -> Dict:
    return get_bonus_effect_definition(effect_id).to_public_dict()