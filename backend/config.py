"""
Configuration file for Memory Game Backend
"""

# Game Configuration
VALID_CARD_COUNTS = [16, 36, 64]
VALID_DIFFICULTIES = ['Leicht', 'Mittel', 'Schwer', 'None']

# Timing Configuration (in seconds)
GENERAL_DELAY = 0.8
VISIBLE_DELAY = 0.5

# Bot Memory Configuration
BOT_MEMORY_SIZES = {
    16: 4,    # 4 cards for small deck
    36: 8,    # 8 cards for medium deck
    64: 10    # 10 cards for large deck
}

# Ranking Thresholds
RANK_THRESHOLDS = {
    16: {  # Small deck
        'A': 60,
        'B': 120,
        'C': 180,
        'D': 240
    },
    36: {  # Medium deck
        'A': 120,
        'B': 240,
        'C': 360,
        'D': 480
    },
    64: {  # Large deck
        'A': 180,
        'B': 360,
        'C': 540,
        'D': 720
    }
}

# API Configuration
API_PREFIX = "/api"
API_VERSION = "1.0.0"

# Server Configuration
HOST = "0.0.0.0"
PORT = 8000
DEBUG = False

# CORS Configuration
CORS_ORIGINS = ["*"]
CORS_CREDENTIALS = True
CORS_METHODS = ["*"]
CORS_HEADERS = ["*"]

# Data Storage
DATA_DIR = "data"
RECORDS_FILE = "game_records.json"
