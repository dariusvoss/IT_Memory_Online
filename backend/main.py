from fastapi import FastAPI, HTTPException, Request, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict
import json
import os
from datetime import datetime
import uuid
from fastapi.responses import JSONResponse
from services.matchmaker import matchmaker, Match
from services.session_manager import GameSessionManager
from models import GameRecord, CreateGameRequest, FlipCardRequest, GameMode, GameStatus
from config import CORS_ORIGINS, API_PREFIX, API_VERSION

app = FastAPI(title="Memory Game Backend", version=API_VERSION)

# CORS configuration for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Initialize services
session_manager = GameSessionManager() #(session_timeout_minutes=30)
multiplayer_finish_ack: Dict[str, set] = {}


# Register matchmaker callback
def on_players_matched(match: Match):
    """Create game session when players are matched"""
    # print(f"Players matched: {match.player_ids}")

    # Create game session correctly!
    session_id  = session_manager.create_session(
        player_ids=match.player_ids,
        difficulty="None",
        board_size=match.deck_size,
        game_mode=GameMode.MULTIPLAYER
    )
    match.game_session_id = session_id

matchmaker.on_matched(on_players_matched)

# ========================= Routes - Session Management =========================

@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"message": "Memory Game API is running"}

@app.post(f"{API_PREFIX}/session/create")
def create_game(request: CreateGameRequest):
    """Create a new game session"""
    try:
        session_id = session_manager.create_session(
            player_ids=request.player_ids,
            difficulty=request.difficulty,
            board_size=request.board_size,
            game_mode=request.game_mode
        )

        session = session_manager.get_session(session_id)
        return {
            "status": "success",
            "session_id": session_id,
            "data": session.to_dict()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.get(f"{API_PREFIX}/session/{{session_id}}")
def get_session_state(session_id: str = Path(...)):
    """Get current state of a game session"""
    if session := session_manager.get_session(session_id):
        return {
            "status": "success",
            "data": session.to_dict()
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.get(f"{API_PREFIX}/session/{{session_id}}/details")
def get_session_details(session_id: str = Path(...)):
    """Get detailed state of a game session (including move history)"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.to_dict()
    session_data["move_history"] = session.get_move_history()
    
    return {
        "status": "success",
        "data": session_data
    }

@app.post(f"{API_PREFIX}/session/{{session_id}}/start")
def start_game(session_id: str = Path(...)):
    """Start a game session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.start_game()
        return {
            "status": "success",
            "message": "Game started",
            "session_id": session_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.post(f"{API_PREFIX}/session/{{session_id}}/reset")
def reset_game(session_id: str = Path(...)):
    """Reset a game session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.reset_game()
        return {
            "status": "success",
            "message": "Game reset",
            "session_id": session_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.post(f"{API_PREFIX}/session/{{session_id}}/finalize-move")
def finalize_move(session_id: str = Path(...)):
    """
    Finalize the current move.
    Called by Frontend after cardVisibilityDuration.
    Flips back unmatched cards and returns updated session state.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.finalize_move()
        return {
            "status": "success",
            "message": "Move finalized",
            "data": session.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.delete(f"{API_PREFIX}/session/{{session_id}}")
def delete_session(session_id: str = Path(...)):
    """Delete/close a game session"""
    if session_manager.delete_session(session_id):
        return {"status": "success", "message": "Session deleted"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

# ========================= Routes - Game Play =========================

@app.post(f"{API_PREFIX}/session/{{session_id}}/flip-card")
def flip_card(session_id: str = Path(...), request: FlipCardRequest = None):
    """
    Flip a card in the game session.
    Works for all game modes (SINGLEPLAYER_TIME, SINGLEPLAYER_AI, MULTIPLAYER).
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        success = session.flip_card(session.current_player_turn, request.card_index)

        if not success:
            return {
                "status": "error",
                "message": "Could not flip card",
                "valid_move": False
            }
        # Get selected cards count BEFORE check_match (which may clear them)
        selected_cards_count_before_match = len(session.selected_cards)

        # Get the IDs and positions of the currently selected cards BEFORE they're cleared by check_match()
        card_ids = []
        card_positions = []
        for idx, _ in session.selected_cards:
            card_ids.append(session.cards[idx].id)
            card_positions.append(idx)

        # Check if this reveals a match
        is_match, matched_positions = session.check_match()

        return {
            "status": "success",
            "valid_move": True,
            "cards": serialize_cards(session.cards),
            "selected_cards_count": selected_cards_count_before_match,
            "is_match": is_match,
            "matched_positions": matched_positions,
            "card_ids": card_ids,
            "card_positions": card_positions,
            "current_player": session.current_player_turn,
            "player_points": session.player_points,
            "pairs_found": session.pairs_found,
            "game_mode": session.game_mode.value,
            "is_player_turn": (
                session.current_player_turn == session.player_ids[0]
                if session.player_ids
                else False
            ),
            "bot_points": session.player_points.get(
                'bot', session.player_points.get('player2', 0)
            ),
            "elapsed_time": (
                session.elapsed_time if hasattr(session, 'elapsed_time') else 0
            ),
        }
    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.post(f"{API_PREFIX}/session/{{session_id}}/bot-move")
def bot_move(session_id: str = Path(...)):
    """
    Execute bot's move for the current session.
    Only available in SINGLEPLAYER_AI mode.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.game_mode != GameMode.SINGLEPLAYER_AI:
        raise HTTPException(
            status_code=400,
            detail=f"Bot moves only available in SINGLEPLAYER_AI mode. Current mode: {session.game_mode.value}"
        )

    if not session.bot_ai:
        raise HTTPException(status_code=400, detail="Bot not initialized for this session")

    try:
        if move := session.bot_move():
            return {
                "status": "success",
                "move": move,
                "cards": serialize_cards(session.cards),
                "player_points": session.player_points,
                "pairs_found": session.pairs_found,
                "current_player": session.current_player_turn
            }
        else:
            return {
                "status": "error",
                "message": "Bot cannot make a move"
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.post(f"{API_PREFIX}/session/{{session_id}}/check-win")
def check_win(session_id: str = Path(...)):
    """
    Check if the game is won.
    Works for all game modes. Rank calculation only for SINGLEPLAYER_TIME mode.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        if session.finished:
            return {
                "status": "success",
                "won": True,
                "game_mode": session.game_mode.value,
                "winner": session.winner,
                "player_points": session.player_points,
                "pairs_found": session.pairs_found,
                "difficulty": session.difficulty,
                "time": session.elapsed_time if hasattr(session, 'elapsed_time') else 0,
                "finish_reason": session.metadata.get("finish_reason"),
                "quitter_id": session.metadata.get("quitter_id")
            }

        if is_won := session.check_win():
            response = {
                "status": "success",
                "won": True,
                "game_mode": session.game_mode.value,
                "winner": session.winner,
                "player_points": session.player_points,
                "pairs_found": session.pairs_found,
                "difficulty": session.difficulty,
                "time": session.elapsed_time if hasattr(session, 'elapsed_time') else 0,
                "finish_reason": session.metadata.get("finish_reason"),
                "quitter_id": session.metadata.get("quitter_id")
            }

            # Only calculate rank for time-based mode
            if session.game_mode == GameMode.SINGLEPLAYER_TIME:
                response["rank"] = session.calculate_rank(session.elapsed_time)
                response["elapsed_time"] = session.elapsed_time

            return response

        return {"status": "success", "won": False}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post(f"{API_PREFIX}/session/{{session_id}}/leave")
def leave_multiplayer_session(session_id: str = Path(...), data: dict = Body(...)):
    """
    A player leaves an active multiplayer game.
    The other player is marked as winner and the session is finished.
    """
    player_id = data.get("player_id")
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id is required")

    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.game_mode != GameMode.MULTIPLAYER:
        raise HTTPException(status_code=400, detail="Leave endpoint is only available for multiplayer sessions")

    if player_id not in session.player_ids:
        raise HTTPException(status_code=400, detail="Player is not part of this session")

    if not session.finished:
        opponents = [pid for pid in session.player_ids if pid != player_id]
        winner = opponents[0] if opponents else None

        session.status = GameStatus.FINISHED
        session.finished = True
        session.ended_at = datetime.now()
        session.winner = winner
        session.last_unmatched_cards = []
        session.metadata["finish_reason"] = "player_left"
        session.metadata["quitter_id"] = player_id

    if session_id not in multiplayer_finish_ack:
        multiplayer_finish_ack[session_id] = set()

    # quitter is treated as already acknowledged
    multiplayer_finish_ack[session_id].add(player_id)

    return {
        "status": "success",
        "message": "Player left the session",
        "winner": session.winner,
        "finish_reason": session.metadata.get("finish_reason"),
        "quitter_id": session.metadata.get("quitter_id")
    }

# ========================= Routes - Timer Management =========================

@app.post(f"{API_PREFIX}/session/{{session_id}}/timer/start")
def start_timer(session_id: str = Path(...)):
    """Start the timer for a game session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.start_timer()
        return {
            "status": "success",
            "message": "Timer started",
            "elapsed_time": session.elapsed_time
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.post(f"{API_PREFIX}/session/{{session_id}}/timer/stop")
def stop_timer(session_id: str = Path(...)):
    """Stop the timer for a game session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.stop_timer()
        return {
            "status": "success",
            "message": "Timer stopped",
            "elapsed_time": session.elapsed_time
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

@app.get(f"{API_PREFIX}/session/{{session_id}}/timer/status")
def get_timer_status(session_id: str = Path(...)):
    """Get current timer status for a game session"""
    if session := session_manager.get_session(session_id):
        return {
            "status": "success",
            "elapsed_time": session.elapsed_time,
            "is_running": session.elapsed_time > 0 if hasattr(session, 'elapsed_time') else False
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.get(f"{API_PREFIX}/session/{{session_id}}/players")
def get_players(session_id: str = Path(...)):
    """
    Get list of players in a session.
    Useful for multiplayer sessions to track active players.
    """
    if session := session_manager.get_session(session_id):
        return {
            "status": "success",
            "session_id": session_id,
            "game_mode": session.game_mode.value,
            "players": session.player_ids,
            "current_turn": session.current_player_turn,
            "player_points": session.player_points
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")

# ========================= Routes - Move History & Replay =========================

@app.get(f"{API_PREFIX}/session/{{session_id}}/moves")
def get_moves(session_id: str = Path(...)):
    """
    Get complete move history for a session.
    Includes all moves, matches, and timestamps for analysis.
    """
    if session := session_manager.get_session(session_id):
        return {
            "status": "success",
            "session_id": session_id,
            "total_moves": len(session.move_history),
            "moves": session.get_move_history()
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.get(f"{API_PREFIX}/session/{{session_id}}/replay")
def get_replay(session_id: str = Path(...)):
    """
    Get complete replay data with card positions for visualization.
    Includes initial shuffled state and all moves to replicate game.
    """
    if session := session_manager.get_session(session_id):
        return {
            "status": "success",
            "session_id": session_id,
            "board_size": session.board_size,
            "cards": serialize_cards(session.cards),
            "moves": session.get_move_history(),
            "matched_pairs": [
                {
                    "card_indices": pair.card_indices,
                    "matched_by": pair.matched_by,
                    "move_number": next(
                        (m.move_number for m in session.move_history 
                         if set(m.card_indices) == set(pair.card_indices) and m.is_match),
                        None
                    )
                }
                for pair in session.matched_pairs
            ]
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.get(f"{API_PREFIX}/session/{{session_id}}/analysis")
def get_analysis(session_id: str = Path(...)):
    """
    Get game analysis and statistics.
    Includes player performance, move efficiency, and insights.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Calculate statistics per player
    player_stats = {}
    for player_id in session.player_ids:
        player_moves = [m for m in session.move_history if m.player_id == player_id]
        successful_moves = [m for m in player_moves if m.is_match]
        
        player_stats[player_id] = {
            "total_moves": len(player_moves),
            "successful_matches": len(successful_moves),
            "failed_attempts": len(player_moves) - len(successful_moves),
            "success_rate": (len(successful_moves) / len(player_moves) * 100) if player_moves else 0,
            "points": session.player_points.get(player_id, 0)
        }
    
    return {
        "status": "success",
        "session_id": session_id,
        "game_mode": session.game_mode.value,
        "difficulty": session.difficulty,
        "total_moves": len(session.move_history),
        "total_time": session.elapsed_time,
        "pairs_formed": session.pairs_found,
        "player_statistics": player_stats,
        "winner": session.winner,
        "finished": session.finished
    }


# ========================= Admin Routes =========================
@app.get(f"{API_PREFIX}/admin/sessions")
def get_active_sessions():
    """Get all active sessions (for debug/admin)"""
    sessions = []
    for session_id, session in list(session_manager.sessions.items()):
        if summary := session_manager.get_session_summary(session_id):
            sessions.append(summary)

    return {
        "status": "success",
        "active_sessions": len(sessions),
        "sessions": sessions
    }

@app.post(f"{API_PREFIX}/admin/cleanup")
def cleanup_sessions():
    """Clean up expired sessions"""
    count = session_manager.cleanup_expired_sessions()
    return {
        "status": "success",
        "cleaned_up": count,
        "remaining_sessions": session_manager.get_session_count()
    }

@app.get(f"{API_PREFIX}/admin/active-matches")
def get_active_matches():
    """Gibt alle laufenden Matches zurück"""
    active_matches = matchmaker.get_active_matches()
    return {"active_matches": [match.to_dict() for match in active_matches]}

# ========================= Helper Functions =========================

def serialize_cards(cards: list) -> list:
    """
    Serialize Card Pydantic models to dictionaries for JSON responses.
    
    Args:
        cards: List of Card Pydantic models
        
    Returns:
        List of dictionaries with card data
    """
    return [card.model_dump() for card in cards]

# ========================= Player ID Routes =========================

@app.get(f"{API_PREFIX}/player/create-id")
def create_player_id():
    """Create a new player ID"""
    player_id = str(uuid.uuid4())
    
    return {
        "player_id": player_id,
        "status": "created"
    }

@app.get(f"{API_PREFIX}/player/verify-id")
def verify_player_id(request: Request):
    """Verify existing player ID from cookie"""
    if player_id := request.cookies.get("player_id"):
        return {"player_id": player_id, "status": "exists"}

    raise HTTPException(status_code=401, detail="Player ID not found")

# ========================= Matchmaking Routes =========================

@app.post(f"{API_PREFIX}/matchmaking/join-queue")
def join_queue(data: dict):
    """Join the matchmaking queue"""
    player_id = data.get("player_id")
    deck_size = data.get("deck_size") 
    if matchmaker.join_queue(player_id, deck_size):
        return {
            "status": "joined",
            "queue_size": matchmaker.get_queue_size(),
            "player_deck_size": matchmaker.player_deck_size.get(player_id)
            }
    else:
        return {"status": "error", "message": "Already in queue or in a match"}

@app.post(f"{API_PREFIX}/matchmaking/leave-queue")
def leave_queue(data: dict):
    """Leave the matchmaking queue"""
    player_id = data.get("player_id")
    deck_size = data.get("deck_size")
    success = matchmaker.leave_queue(player_id, deck_size)
    return {
        "status": "success" if success else "error",
        "message": "Left queue" if success else "Not in queue"
    }

@app.get(f"{API_PREFIX}/matchmaking/status/{{player_id}}")
def get_matchmaking_status(player_id: str):
    """Get matchmaking status for a player"""
    match = matchmaker.get_player_match(player_id)
    
    if match and match.game_session_id:
        session = session_manager.get_session(match.game_session_id)
        if not session:
            # Cleanup stale match references if session no longer exists
            matchmaker.delete_match(match.match_id)
            return {"status": "not_in_queue"}
        return {
            "status": "matched",
            "match_id": match.match_id,
            "opponent": [p for p in match.player_ids if p != player_id],
            "game_session_id": match.game_session_id,
            "session": session.to_dict() if session else None
        }
    elif matchmaker.is_player_in_queue(player_id):
        return {
            "status": "waiting",
            "queue_position": "matchmaker.get_queue_position(player_id)",
            "player_deck_size": matchmaker.player_deck_size.get(player_id),
            "queue_size": matchmaker.get_queue_size()
        }
    else:
        return {"status": "not_in_queue"}

@app.get(f"{API_PREFIX}/matchmaking/stats")
def get_matchmaker_stats():
    """Get matchmaker statistics"""
    return matchmaker.get_stats()

@app.get(f"{API_PREFIX}/matchmaking/queue")
def get_queue():
    """Get current matchmaking queue"""
    return {
        "queue": matchmaker.get_queue(),
        "queue_size": matchmaker.get_queue_size()
    }

@app.delete(f"{API_PREFIX}/matchmaking/match/{{match_id}}")
def delete_match(match_id: str):
    """Löscht ein aktives Match basierend auf der match_id"""
    try:
        if success := matchmaker.delete_match(match_id):
            return {"status": "success", "message": "Match deleted"}
        else:
            raise HTTPException(status_code=404, detail="Match not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post(f"{API_PREFIX}/session/{{session_id}}/finish-ack")
def acknowledge_game_finished(session_id: str, data: dict = Body(...)):
    """
    Acknowledge game finish from one player.
    Deletes multiplayer session + match only after both players acknowledged.
    """
    player_id = data.get("player_id")
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id is required")

    session = session_manager.get_session(session_id)

    # If session already gone, ensure stale matchmaking refs are cleaned
    if not session:
        matchmaker.delete_match_by_session(session_id)
        multiplayer_finish_ack.pop(session_id, None)
        return {
            "status": "success",
            "cleaned_up": True,
            "message": "Session already cleaned"
        }

    if session.game_mode != GameMode.MULTIPLAYER:
        return {
            "status": "success",
            "cleaned_up": False,
            "message": "No multiplayer cleanup required"
        }

    if session_id not in multiplayer_finish_ack:
        multiplayer_finish_ack[session_id] = set()

    multiplayer_finish_ack[session_id].add(player_id)

    # Count only real players (exclude bot just in case)
    required_players = [pid for pid in session.player_ids if pid != 'bot']
    all_acknowledged = all(pid in multiplayer_finish_ack[session_id] for pid in required_players)

    if all_acknowledged:
        session_manager.delete_session(session_id)
        matchmaker.delete_match_by_session(session_id)
        multiplayer_finish_ack.pop(session_id, None)
        return {
            "status": "success",
            "cleaned_up": True,
            "message": "Session and match cleaned up"
        }

    return {
        "status": "success",
        "cleaned_up": False,
        "acknowledged": list(multiplayer_finish_ack[session_id]),
        "required": required_players,
        "message": "Waiting for other player acknowledgement"
    }


# ========================= Error Handlers =========================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.detail}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

