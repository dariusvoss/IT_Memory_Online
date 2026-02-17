"""
Utility functions for Memory Game Backend
"""

import os
from datetime import datetime
from typing import Dict, Any

def get_current_timestamp() -> str:
    """Get current timestamp in German format"""
    current_date = datetime.now()
    return current_date.strftime("%d.%m.%Y %H:%M:%S")

def get_current_datetime_str() -> str:
    """Get current datetime as string"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def ensure_data_directory() -> str:
    """Ensure data directory exists and return its path"""
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    return data_dir

def get_records_file_path() -> str:
    """Get path to game records file"""
    data_dir = ensure_data_directory()
    return os.path.join(data_dir, 'game_records.json')

def format_time(seconds: int) -> str:
    """Format seconds to MM:SS format"""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"

def validate_card_count(count: int) -> bool:
    """Validate card count"""
    return count in [16, 36, 64]

def validate_difficulty(difficulty: str) -> bool:
    """Validate difficulty level"""
    return difficulty in ['Leicht', 'Mittel', 'Schwer', 'None']

def get_deck_size_text(card_count: int) -> str:
    """Get human-readable deck size text"""
    sizes = {
        16: 'Klein (16 Karten)',
        36: 'Mittel (36 Karten)',
        64: 'Groß (64 Karten)'
    }
    return sizes.get(card_count, 'Unbekannt')

def create_game_record(
    mode: str,
    difficulty_level: str,
    deck_size: str,
    points: str = '-',
    rank: str = '-',
    time: str = '-'
) -> Dict[str, Any]:
    """Create a game record dictionary"""
    return {
        'date': get_current_datetime_str(),
        'mode': mode,
        'difficulty_level': difficulty_level,
        'deck_size': deck_size,
        'points': points,
        'rank': rank,
        'time': time
    }

def log_move(player_name: str, action: str, details: str = '') -> None:
    """Log a game move (for debugging)"""
    timestamp = get_current_datetime_str()
    message = f"[{timestamp}] {player_name}: {action}"
    if details:
        message += f" - {details}"
    # In production, this could be written to a file or logging service
    print(message)
