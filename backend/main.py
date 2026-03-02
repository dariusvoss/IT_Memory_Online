from fastapi import FastAPI, HTTPException, Request, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import os
from datetime import datetime
import uuid
from fastapi.responses import JSONResponse
from services.matchmaker import matchmaker, Match
from services.game_session import GameMode
from services.session_manager import GameSessionManager

app = FastAPI(title="Memory Game Backend", version="1.0.0")

# CORS configuration for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",      # Dein Frontend während Entwicklung
        "https://memory.ipv64.de",     # Deine Production-Domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Nur nötige Methoden
    allow_headers=["Content-Type", "Authorization"],  # Nur nötige Headers
)

# Import services
from services.session_manager import GameSessionManager
from services.timer import TimerService
from models import GameRecord

# Initialize services
session_manager = GameSessionManager(session_timeout_minutes=30)
timer_service = TimerService()


# Register matchmaker callback
def on_players_matched(match: Match):
    """Create game session when players are matched"""
    # print(f"Players matched: {match.player_ids}")

    # Session korrekt erzeugen!
    session_id  = session_manager.create_session(
        player_ids=match.player_ids,
        difficulty='None',
        board_size=match.deck_size,
        game_mode=GameMode.MULTIPLAYER.value
    )
    session = session_manager.get_session(session_id)  # Session-Objekt holen
    if session:
        # session.initialize_game()
        match.game_session_id = session_id

matchmaker.on_matched(on_players_matched)

# ========================= Data Models =========================

class CreateGameRequest(BaseModel):
    player_ids: List[str]
    difficulty: str  # 'Leicht', 'Mittel', 'Schwer'
    board_size: int  # 16, 36, 64
    game_mode: str = 'singleplayer_time'  # 'singleplayer_time', 'singleplayer_ai', 'multiplayer'

class FlipCardRequest(BaseModel):
    card_index: int

# ========================= Routes - Session Management =========================

@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"message": "Memory Game API is running"}

@app.post("/api/session/create")
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
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/session/{session_id}")
def get_session_state(session_id: str = Path(...)):
    """Get current state of a game session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "status": "success",
        "data": session.to_dict()
    }

@app.get("/api/session/{session_id}/details")
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

@app.post("/api/session/{session_id}/start")
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
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/session/{session_id}/reset")
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
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/session/{session_id}/finalize-move")
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
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/session/{session_id}")
def delete_session(session_id: str = Path(...)):
    """Delete/close a game session"""
    if session_manager.delete_session(session_id):
        return {"status": "success", "message": "Session deleted"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

# ========================= Routes - Game Play =========================

@app.post("/api/session/{session_id}/flip-card")
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
        
        response_data = {
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
            "is_player_turn": session.current_player_turn == session.player_ids[0] if session.player_ids else False,
            "bot_points": session.player_points.get('bot', session.player_points.get('player2', 0)),
            "elapsed_time": session.elapsed_time if hasattr(session, 'elapsed_time') else 0
        }
        return response_data
    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/session/{session_id}/bot-move")
def bot_move(session_id: str = Path(...)):
    """
    Execute bot's move for the current session.
    Only available in SINGLEPLAYER_AI mode.
    """
    from services.game_session import GameMode
    
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
        move = session.bot_move()
        
        if not move:
            return {
                "status": "error",
                "message": "Bot cannot make a move"
            }
        
        return {
            "status": "success",
            "move": move,
            "cards": serialize_cards(session.cards),
            "player_points": session.player_points,
            "pairs_found": session.pairs_found,
            "current_player": session.current_player_turn
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/session/{session_id}/check-win")
def check_win(session_id: str = Path(...)):
    """
    Check if the game is won.
    Works for all game modes. Rank calculation only for SINGLEPLAYER_TIME mode.
    """
    from services.game_session import GameMode
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        is_won = session.check_win()
        
        if is_won:
            response = {
                "status": "success",
                "won": True,
                "game_mode": session.game_mode.value,
                "winner": session.winner,
                "player_points": session.player_points,
                "pairs_found": session.pairs_found,
                "difficulty": session.difficulty,
                "time": session.elapsed_time if hasattr(session, 'elapsed_time') else 0
            }
            
            # Only calculate rank for time-based mode
            if session.game_mode == GameMode.SINGLEPLAYER_TIME:
                response["rank"] = session.calculate_rank(session.elapsed_time)
                response["elapsed_time"] = session.elapsed_time
            
            return response
        
        return {"status": "success", "won": False}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ========================= Routes - Timer Management =========================

@app.post("/api/session/{session_id}/timer/start")
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
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/session/{session_id}/timer/stop")
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
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/session/{session_id}/timer/status")
def get_timer_status(session_id: str = Path(...)):
    """Get current timer status for a game session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "status": "success",
        "elapsed_time": session.elapsed_time,
        "is_running": session.elapsed_time > 0 if hasattr(session, 'elapsed_time') else False
    }

@app.get("/api/session/{session_id}/players")
def get_players(session_id: str = Path(...)):
    """
    Get list of players in a session.
    Useful for multiplayer sessions to track active players.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "status": "success",
        "session_id": session_id,
        "game_mode": session.game_mode.value,
        "players": session.player_ids,
        "current_turn": session.current_player_turn,
        "player_points": session.player_points
    }

# ========================= Routes - Move History & Replay =========================

@app.get("/api/session/{session_id}/moves")
def get_moves(session_id: str = Path(...)):
    """
    Get complete move history for a session.
    Includes all moves, matches, and timestamps for analysis.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "status": "success",
        "session_id": session_id,
        "total_moves": len(session.move_history),
        "moves": session.get_move_history()
    }

@app.get("/api/session/{session_id}/replay")
def get_replay(session_id: str = Path(...)):
    """
    Get complete replay data with card positions for visualization.
    Includes initial shuffled state and all moves to replicate game.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
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

@app.get("/api/session/{session_id}/analysis")
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
@app.get("/api/admin/sessions")
def get_active_sessions():
    """Get all active sessions (for debug/admin)"""
    sessions = []
    for session_id, session in session_manager.sessions.items():
        summary = session_manager.get_session_summary(session_id)
        if summary:
            sessions.append(summary)
    
    return {
        "status": "success",
        "active_sessions": len(sessions),
        "sessions": sessions
    }

@app.post("/api/admin/cleanup")
def cleanup_sessions():
    """Clean up expired sessions"""
    count = session_manager.cleanup_expired_sessions()
    return {
        "status": "success",
        "cleaned_up": count,
        "remaining_sessions": session_manager.get_session_count()
    }

@app.get("/api/admin/active-matches")
def get_active_matches():
    """Gibt alle laufenden Matches zurück"""
    active_matches = matchmaker.get_active_matches()  
    return {"active_matches": [match.to_dict() for match in active_matches]}

# ========================= Helper Functions =========================

def serialize_cards(cards: list) -> list:
    """
    Convert Card dataclass objects to dicts for JSON serialization.
    
    Args:
        cards: List of Card dataclass objects
        
    Returns:
        List of dictionaries with card data
    """
    return [
        {
            "id": card.id,
            "image": card.image,
            "flipped": card.flipped,
            "matched": card.matched,
            "position": card.position
        }
        for card in cards
    ]

# ========================= Player ID Routes =========================

@app.get("/api/player/create-id")
def create_player_id():
    """Create a new player ID"""
    player_id = str(uuid.uuid4())
    
    return {
        "player_id": player_id,
        "status": "created"
    }

@app.get("/api/player/verify-id")
def verify_player_id(request: Request):
    """Verify existing player ID from cookie"""
    player_id = request.cookies.get("player_id")
    
    if player_id:
        return {"player_id": player_id, "status": "exists"}
    
    raise HTTPException(status_code=401, detail="Player ID not found")

# ========================= Matchmaking Routes =========================

@app.post("/api/matchmaking/join-queue")
def join_queue(data: dict):
    """Join the matchmaking queue"""
    player_id = data.get("player_id")
    deck_size = data.get("deck_size")  # <– neu
    if matchmaker.join_queue(player_id, deck_size):
        return {
            "status": "joined", 
            "queue_size": matchmaker.get_queue_size(),
            "player_deck_size": matchmaker.player_deck_size.get(player_id)
            }
    else:
        return {"status": "error", "message": "Already in queue or in a match"}

@app.post("/api/matchmaking/leave-queue")
def leave_queue(data: dict):
    """Leave the matchmaking queue"""
    player_id = data.get("player_id")
    deck_size = data.get("deck_size")
    success = matchmaker.leave_queue(player_id, deck_size)
    return {
        "status": "success" if success else "error",
        "message": "Left queue" if success else "Not in queue"
    }

@app.get("/api/matchmaking/status/{player_id}")
def get_matchmaking_status(player_id: str):
    """Get matchmaking status for a player"""
    match = matchmaker.get_player_match(player_id)
    
    if match and match.game_session_id:
        session = session_manager.get_session(match.game_session_id)
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

@app.get("/api/matchmaking/stats")
def get_matchmaker_stats():
    """Get matchmaker statistics"""
    return matchmaker.get_stats()

@app.get("/api/matchmaking/queue")
def get_queue():
    """Get current matchmaking queue"""
    return {
        "queue": matchmaker.get_queue(),
        "queue_size": matchmaker.get_queue_size()
    }

# ========================= Player ID Routes =========================

@app.get("/api/player/create-id")
def create_player_id():
    """Create a new player ID"""
    player_id = str(uuid.uuid4())
    
    return {
        "player_id": player_id,
        "status": "created"
    }

@app.get("/api/player/verify-id")
def verify_player_id(request: Request):
    """Verify existing player ID from cookie"""
    player_id = request.cookies.get("player_id")
    
    if player_id:
        return {"player_id": player_id, "status": "exists"}
    
    raise HTTPException(status_code=401, detail="Player ID not found")


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

