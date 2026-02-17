from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from datetime import datetime

app = FastAPI(title="Memory Game Backend", version="1.0.0")

# CORS configuration for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import services
from services.game import GameService
from services.timer import TimerService
from models import GameStateResponse, GameRecord, MoveRequest, BotMoveRequest

# Initialize services
game_service = GameService()
timer_service = TimerService()

# ========================= Data Models =========================

class InitializeGameRequest(BaseModel):
    card_count: int

class FlipCardRequest(BaseModel):
    card_id: int

class GameStatusRequest(BaseModel):
    difficulty: Optional[str] = 'Leicht'

# ========================= Routes =========================

@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"message": "Memory Game API is running"}

@app.post("/api/game/initialize")
def initialize_game(request: InitializeGameRequest):
    """Initialize a new game with specified card count (16, 36, or 64)"""
    try:
        game_service.initialize_game(request.card_count)
        timer_service.reset_timer()
        return {
            "status": "success",
            "message": "Game initialized",
            "cards": game_service.get_cards()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/set-difficulty")
def set_difficulty(difficulty: str):
    """Set game difficulty level: Leicht, Mittel, Schwer, or None"""
    try:
        game_service.set_difficulty(difficulty)
        return {"status": "success", "difficulty": difficulty}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/flip-card")
def flip_card(request: FlipCardRequest):
    """Flip a card by its index"""
    try:
        result = game_service.flip_card(request.card_id)
        return {
            "status": "success",
            "cards": game_service.get_cards(),
            "selected_cards_count": len(game_service.get_selected_cards()),
            "match_result": result
        }
    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/start-timer")
def start_timer():
    """Start the game timer"""
    timer_service.start_timer()
    return {"status": "success", "message": "Timer started"}

@app.post("/api/game/stop-timer")
def stop_timer():
    """Stop the game timer"""
    timer_service.stop_timer()
    return {"status": "success", "message": "Timer stopped"}

@app.get("/api/game/timer")
def get_timer():
    """Get current timer value"""
    return {
        "elapsed_seconds": timer_service.get_elapsed_seconds(),
        "formatted": timer_service.get_formatted_timer(),
        "is_running": timer_service.is_timer_running
    }

@app.post("/api/game/bot-move")
def bot_move():
    """Get bot's next move based on difficulty level"""
    try:
        move = game_service.bot_move()
        return {
            "status": "success",
            "move": move,
            "cards": game_service.get_cards(),
            "bot_points": game_service.get_bot_points()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/game/state")
def get_game_state():
    """Get current game state"""
    return {
        "cards": game_service.get_cards(),
        "is_player_turn": game_service.is_player_turn,
        "pairs_found": game_service.get_pairs_found(),
        "player_points": game_service.get_player_points(),
        "bot_points": game_service.get_bot_points(),
        "difficulty": game_service.get_difficulty(),
        "game_started": game_service.game_started,
        "timer": timer_service.get_elapsed_seconds()
    }

@app.post("/api/game/reset")
def reset_game():
    """Reset the game to initial state"""
    game_service.reset_game()
    timer_service.reset_timer()
    return {"status": "success", "message": "Game reset"}

@app.post("/api/game/check-win")
def check_win():
    """Check if the game is won"""
    is_won = game_service.check_win()
    if is_won:
        timer_service.stop_timer()
        time_formatted = timer_service.get_formatted_timer()
        deck_size = game_service.get_deck_size()
        rank = game_service.calculate_rank(time_formatted, deck_size)
        
        return {
            "status": "success",
            "won": True,
            "time": time_formatted,
            "rank": rank,
            "player_points": game_service.get_player_points(),
            "bot_points": game_service.get_bot_points(),
            "difficulty": game_service.get_difficulty()
        }
    return {"status": "success", "won": False}

@app.post("/api/game/save-record")
def save_game_record(record: GameRecord):
    """Save a game record to the database"""
    try:
        game_service.add_game_record(record.dict())
        return {"status": "success", "message": "Record saved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/game/records")
def get_game_records():
    """Get all game records"""
    records = game_service.get_game_records()
    return {"status": "success", "records": records}

@app.delete("/api/game/records")
def clear_game_records():
    """Delete all game records"""
    game_service.clear_game_records()
    return {"status": "success", "message": "All records deleted"}

# ========================= Error Handlers =========================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "status": "error",
        "message": exc.detail
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
