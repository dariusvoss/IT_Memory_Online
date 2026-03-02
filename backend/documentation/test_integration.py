"""
Integration test for Frontend-Backend communication
Tests the complete game flow with the new Session API
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_complete_game_flow():
    """Test complete game flow: create → initialize → play → win"""
    
    print("=" * 70)
    print("INTEGRATION TEST: Complete Game Flow (Singleplayer Time Mode)")
    print("=" * 70)
    
    # Step 1: Create Session
    print("\n1️⃣  Creating game session...")
    create_payload = {
        "player_ids": ["player1"],
        "difficulty": "None",
        "board_size": 16,
        "game_mode": "singleplayer_time"
    }
    
    response = requests.post(f"{BASE_URL}/session/create", json=create_payload)
    print(f"Status: {response.status_code}")
    data = response.json()
    
    if response.status_code != 200:
        print(f"❌ Failed to create session: {data}")
        return False
    
    session_id = data["data"]["session_id"]
    print(f"✅ Session created: {session_id}")
    print(f"   Status: {data['data']['status']}")
    print(f"   Cards: {len(data['data']['cards'])}")
    
    # Step 2: Get Session State
    print("\n2️⃣  Getting session state...")
    response = requests.get(f"{BASE_URL}/session/{session_id}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed to get session: {response.json()}")
        return False
    
    session_data = response.json()["data"]
    print(f"✅ Session state retrieved")
    print(f"   Current player: {session_data['current_player']}")
    print(f"   Pairs found: {session_data['pairs_found']}")
    
    # Step 3: Start Game
    print("\n3️⃣  Starting game...")
    response = requests.post(f"{BASE_URL}/session/{session_id}/start", json={})
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed to start game: {response.json()}")
        return False
    
    print(f"✅ Game started")
    
    # Step 4: Flip Cards (simulate finding a match)
    print("\n4️⃣  Flipping cards to find a match...")
    
    # Find matching cards
    response = requests.get(f"{BASE_URL}/session/{session_id}")
    session_data = response.json()["data"]
    cards = session_data["cards"]
    
    # Find first matching pair
    matched_indices = None
    for i in range(len(cards)):
        for j in range(i + 1, len(cards)):
            if cards[i]["id"] == cards[j]["id"] and not cards[i]["matched"]:
                matched_indices = (i, j)
                break
        if matched_indices:
            break
    
    if not matched_indices:
        print("❌ Could not find matching pair in cards")
        return False
    
    idx1, idx2 = matched_indices
    print(f"   Found matching pair: Card {idx1} (ID: {cards[idx1]['id']}) and Card {idx2} (ID: {cards[idx2]['id']})")
    
    # Flip first card
    print(f"\n   Flipping card {idx1}...")
    flip_payload = {"card_index": idx1}
    response = requests.post(f"{BASE_URL}/session/{session_id}/flip-card", json=flip_payload)
    print(f"   Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed to flip card: {response.json()}")
        return False
    
    flip_data = response.json()
    print(f"✅ Card flipped")
    print(f"   Valid move: {flip_data['valid_move']}")
    print(f"   Selected cards: {flip_data['selected_cards_count']}")
    
    # Flip second card
    print(f"\n   Flipping card {idx2}...")
    flip_payload = {"card_index": idx2}
    response = requests.post(f"{BASE_URL}/session/{session_id}/flip-card", json=flip_payload)
    print(f"   Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed to flip second card: {response.json()}")
        return False
    
    flip_data = response.json()
    print(f"✅ Second card flipped")
    print(f"   Is match: {flip_data['is_match']}")
    print(f"   Pairs found: {flip_data['pairs_found']}")
    
    # Step 5: Check win condition
    print("\n5️⃣  Checking win condition...")
    response = requests.post(f"{BASE_URL}/session/{session_id}/check-win", json={})
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed to check win: {response.json()}")
        return False
    
    check_data = response.json()
    print(f"✅ Win check completed")
    print(f"   Won: {check_data['won']}")
    if check_data['won']:
        print(f"   Winner: {check_data.get('winner', 'N/A')}")
        print(f"   Rank: {check_data.get('rank', 'N/A')}")
    
    # Step 6: Delete Session
    print("\n6️⃣  Deleting session...")
    response = requests.delete(f"{BASE_URL}/session/{session_id}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Failed to delete session: {response.json()}")
        return False
    
    print(f"✅ Session deleted")
    
    print("\n" + "=" * 70)
    print("✅ INTEGRATION TEST PASSED!")
    print("=" * 70)
    return True


def test_bot_mode():
    """Test bot AI mode"""
    
    print("\n" + "=" * 70)
    print("INTEGRATION TEST: Bot AI Mode (Singleplayer AI)")
    print("=" * 70)
    
    # Create session with bot
    print("\n1️⃣  Creating bot game session...")
    create_payload = {
        "player_ids": ["player1", "bot"],
        "difficulty": "Leicht",
        "board_size": 16,
        "game_mode": "singleplayer_ai"
    }
    
    response = requests.post(f"{BASE_URL}/session/create", json=create_payload)
    
    if response.status_code != 200:
        print(f"❌ Failed to create bot session: {response.json()}")
        return False
    
    session_id = response.json()["data"]["session_id"]
    print(f"✅ Bot session created: {session_id}")
    
    # Start game
    print("\n2️⃣  Starting bot game...")
    response = requests.post(f"{BASE_URL}/session/{session_id}/start", json={})
    
    if response.status_code != 200:
        print(f"❌ Failed to start bot game: {response.json()}")
        return False
    
    print(f"✅ Bot game started")
    
    # Flip cards (player move)
    print("\n3️⃣  Player flip card...")
    response = requests.post(f"{BASE_URL}/session/{session_id}/flip-card", json={"card_index": 0})
    
    if response.status_code != 200:
        print(f"❌ Failed flip: {response.json()}")
        return False
    
    response = requests.post(f"{BASE_URL}/session/{session_id}/flip-card", json={"card_index": 1})
    
    if response.status_code != 200:
        print(f"❌ Failed flip: {response.json()}")
        return False
    
    print(f"✅ Player moves executed")
    
    # Bot move
    print("\n4️⃣  Bot making move...")
    response = requests.post(f"{BASE_URL}/session/{session_id}/bot-move", json={})
    
    if response.status_code != 200:
        print(f"❌ Failed bot move: {response.json()}")
        return False
    
    print(f"✅ Bot moved")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/session/{session_id}")
    
    print("\n" + "=" * 70)
    print("✅ BOT MODE TEST PASSED!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    print("\n🧪 Starting Integration Tests...\n")
    
    try:
        # Test 1: Complete flow
        test1_passed = test_complete_game_flow()
        
        time.sleep(1)
        
        # Test 2: Bot mode
        test2_passed = test_bot_mode()
        
        print("\n" + "=" * 70)
        if test1_passed and test2_passed:
            print("✅ ALL TESTS PASSED! Backend-Frontend integration ready.")
        else:
            print("❌ Some tests failed. Check console output.")
        print("=" * 70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Test error: {e}\n")
