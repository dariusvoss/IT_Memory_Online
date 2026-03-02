"""
Test script for Memory Game API
Run this script to test the API endpoints
"""

import requests
import json
import time
from typing import Dict, Any

# API base URL
BASE_URL = "http://localhost:8000/api"

class MemoryGameClient:
    """Client for testing Memory Game API"""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
    
    def _make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Dict[str, Any]:
        """Make HTTP request"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url, params=params)
            elif method == "POST":
                response = self.session.post(url, json=data, params=params)
            elif method == "DELETE":
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            return {"status": "error", "message": str(e)}
    
    def health_check(self) -> Dict[str, Any]:
        """Check if API is running"""
        url = "http://localhost:8000/"
        try:
            response = self.session.get(url)
            return response.json()
        except:
            return {"status": "error"}
    
    def initialize_game(self, card_count: int) -> Dict[str, Any]:
        """Initialize a new game"""
        print(f"\n🎮 Initializing game with {card_count} cards...")
        return self._make_request("POST", "/game/initialize", {"card_count": card_count})
    
    def set_difficulty(self, difficulty: str) -> Dict[str, Any]:
        """Set game difficulty"""
        print(f"\n⚙️  Setting difficulty to {difficulty}...")
        return self._make_request("POST", "/game/set-difficulty", params={"difficulty": difficulty})
    
    def flip_card(self, card_id: int) -> Dict[str, Any]:
        """Flip a card"""
        return self._make_request("POST", "/game/flip-card", {"card_id": card_id})
    
    def start_timer(self) -> Dict[str, Any]:
        """Start the timer"""
        print("\n⏱️  Starting timer...")
        return self._make_request("POST", "/game/start-timer")
    
    def stop_timer(self) -> Dict[str, Any]:
        """Stop the timer"""
        print("\n⏱️  Stopping timer...")
        return self._make_request("POST", "/game/stop-timer")
    
    def get_timer(self) -> Dict[str, Any]:
        """Get timer status"""
        return self._make_request("GET", "/game/timer")
    
    def get_game_state(self) -> Dict[str, Any]:
        """Get current game state"""
        return self._make_request("GET", "/game/state")
    
    def bot_move(self) -> Dict[str, Any]:
        """Get bot's next move"""
        return self._make_request("POST", "/game/bot-move")
    
    def check_win(self) -> Dict[str, Any]:
        """Check if game is won"""
        return self._make_request("POST", "/game/check-win")
    
    def reset_game(self) -> Dict[str, Any]:
        """Reset the game"""
        print("\n🔄 Resetting game...")
        return self._make_request("POST", "/game/reset")
    
    def get_records(self) -> Dict[str, Any]:
        """Get game records"""
        print("\n📋 Fetching game records...")
        return self._make_request("GET", "/game/records")
    
    def save_record(self, record: Dict) -> Dict[str, Any]:
        """Save a game record"""
        return self._make_request("POST", "/game/save-record", record)
    
    def clear_records(self) -> Dict[str, Any]:
        """Clear all records"""
        print("\n🗑️  Clearing all records...")
        return self._make_request("DELETE", "/game/records")


def print_result(title: str, result: Dict[str, Any]) -> None:
    """Pretty print result"""
    print(f"\n{'='*60}")
    print(f"📌 {title}")
    print(f"{'='*60}")
    print(json.dumps(result, indent=2, ensure_ascii=False))


def run_tests():
    """Run test suite"""
    client = MemoryGameClient()
    
    # Test 1: Health check
    print("🧪 Test 1: Health Check")
    health = client.health_check()
    print_result("Health Check", health)
    
    if health.get("status") == "error":
        print("\n❌ API is not running! Please start the server with: uvicorn main:app --reload")
        return
    
    print("\n✅ API is running!")
    
    # Test 2: Initialize game
    print("\n\n🧪 Test 2: Initialize Game")
    init_result = client.initialize_game(16)
    print_result("Initialized Game", {
        "status": init_result.get("status"),
        "message": init_result.get("message"),
        "card_count": len(init_result.get("cards", []))
    })
    
    # Test 3: Set difficulty
    print("\n\n🧪 Test 3: Set Difficulty")
    diff_result = client.set_difficulty("Leicht")
    print_result("Difficulty Set", diff_result)
    
    # Test 4: Get game state
    print("\n\n🧪 Test 4: Get Game State")
    state = client.get_game_state()
    print_result("Game State", {
        "status": state.get("status"),
        "player_turn": state.get("is_player_turn"),
        "pairs_found": state.get("pairs_found"),
        "difficulty": state.get("difficulty")
    })
    
    # Test 5: Flip cards
    print("\n\n🧪 Test 5: Flip Cards")
    print("Flipping card 0...")
    flip1 = client.flip_card(0)
    print(f"Status: {flip1.get('status')}, Selected: {flip1.get('selected_cards_count')}")
    
    print("Flipping card 1...")
    flip2 = client.flip_card(1)
    print(f"Status: {flip2.get('status')}, Selected: {flip2.get('selected_cards_count')}")
    
    # Test 6: Timer
    print("\n\n🧪 Test 6: Timer")
    client.start_timer()
    time.sleep(2)
    timer = client.get_timer()
    print_result("Timer Status", timer)
    client.stop_timer()
    
    # Test 7: Get records
    print("\n\n🧪 Test 7: Get Game Records")
    records = client.get_records()
    print_result("Game Records", {
        "status": records.get("status"),
        "record_count": len(records.get("records", []))
    })
    
    # Test 8: Save record
    print("\n\n🧪 Test 8: Save Game Record")
    test_record = {
        "date": "2024-01-15 10:30:45",
        "mode": "Spieler vs. Zeit",
        "difficulty_level": "Leicht",
        "deck_size": "Klein (16 Karten)",
        "points": "-",
        "rank": "A",
        "time": "2:15"
    }
    save_result = client.save_record(test_record)
    print_result("Record Saved", save_result)
    
    # Test 9: Reset
    print("\n\n🧪 Test 9: Reset Game")
    reset_result = client.reset_game()
    print_result("Game Reset", reset_result)
    
    print("\n\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🧪 Memory Game API Test Suite")
    print("="*60)
    run_tests()
