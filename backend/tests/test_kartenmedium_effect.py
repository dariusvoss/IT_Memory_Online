import sys
from pathlib import Path
import unittest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models import Card, GameMode  # noqa: E402
from services.game_session import GameSession  # noqa: E402


class KartenmediumEffectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.session = GameSession(
            session_id="test-session",
            player_ids=["player1", "player2"],
            difficulty="None",
            board_size=16,
            game_mode=GameMode.MULTIPLAYER,
            bonus_effekt=True,
        )
        self.session.initialize_game()
        self.session.current_player_turn = "player1"
        self.session.cards = [
            Card(id=0, image="a.png", position=0),
            Card(id=0, image="a.png", position=1),
            Card(id=1, image="b.png", position=2),
            Card(id=1, image="b.png", position=3),
        ]

    def test_kartenmedium_reveals_partner_of_seen_card(self) -> None:
        self.session.player_seen_positions["player1"] = {0}

        result = self.session.use_bonus_effect("player1", "kartenmedium", assignment_round=1)

        self.assertEqual(result["kartenmedium_preview_card_index"], 1)
        self.assertEqual(self.session.player_kartenmedium_preview_index["player1"], 1)

    def test_preview_clears_when_player_starts_with_other_card(self) -> None:
        self.session.player_seen_positions["player1"] = {0}
        self.session.use_bonus_effect("player1", "kartenmedium", assignment_round=1)

        self.assertTrue(self.session.flip_card("player1", 2))
        self.assertIsNone(self.session.player_kartenmedium_preview_index["player1"])

    def test_preview_clears_when_player_uses_preview_card_as_first_pick(self) -> None:
        self.session.player_seen_positions["player1"] = {0}
        self.session.use_bonus_effect("player1", "kartenmedium", assignment_round=1)

        self.assertTrue(self.session.flip_card("player1", 1))
        self.assertIsNone(self.session.player_kartenmedium_preview_index["player1"])
        self.assertEqual(self.session.selected_cards[0][0], 1)


if __name__ == "__main__":
    unittest.main()
