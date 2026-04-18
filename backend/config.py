"""
Configuration file for Memory Game Backend
"""

# ==================== Card Images ====================
CARD_IMAGES = [
    'assets/images-small/Memory_Card_01_Default.webp',
    'assets/images-small/Memory_Card_02_RTF_02.webp',
    'assets/images-small/Memory_Card_03_Application_Window.webp',
    'assets/images-small/Memory_Card_04_Folder_Opened.webp',
    'assets/images-small/Memory_Card_05_Floppy_Disk.webp',
    'assets/images-small/Memory_Card_06_Removable_Media.webp',
    'assets/images-small/Memory_Card_07_Optical_Drive.webp',
    'assets/images-small/Memory_Card_08_Chip.webp',
    'assets/images-small/Memory_Card_09_Entire_Network.webp',
    'assets/images-small/Memory_Card_10_My_Computer.webp',
    'assets/images-small/Memory_Card_11_Printer.webp',
    'assets/images-small/Memory_Card_12_Start_Menu_Programs.webp',
    'assets/images-small/Memory_Card_13_Recent_Documents.webp',
    'assets/images-small/Memory_Card_14_Control_Panel.webp',
    'assets/images-small/Memory_Card_15_Search.webp',
    'assets/images-small/Memory_Card_16_Help_and_Support.webp',
    'assets/images-small/Memory_Card_17_Run.webp',
    'assets/images-small/Memory_Card_18_2_Hibernate.webp',
    'assets/images-small/Memory_Card_19_Sharing_Hand.webp',
    'assets/images-small/Memory_Card_20_Recycle_Bin(full).webp',
    'assets/images-small/Memory_Card_21_Administrative_Tools.webp',
    'assets/images-small/Memory_Card_22_Audio_CD.webp',
    'assets/images-small/Memory_Card_23_Add.webp',
    'assets/images-small/Memory_Card_24_Favorites.webp',
    'assets/images-small/Memory_Card_25_Logout.webp',
    'assets/images-small/Memory_Card_26_Windows_Update.webp',
    'assets/images-small/Memory_Card_27_Padlock.webp',
    'assets/images-small/Memory_Card_28_Delete.webp',
    'assets/images-small/Memory_Card_29_CAB.webp',
    'assets/images-small/Memory_Card_30_BAT.webp',
    'assets/images-small/Memory_Card_31_Font.webp',
    'assets/images-small/Memory_Card_32_TrueType2.webp'
]

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

# Bonus effects configuration
# Number of dud entries mixed into each player's effect pool.
# Higher values reduce the chance of receiving a real bonus effect.
BONUS_BLINDGAENGER_COUNT = 4

# Per board size multiplier for dud count scaling.
# Effective blindgaenger count = BONUS_BLINDGAENGER_COUNT * multiplier.
BONUS_BLINDGAENGER_MULTIPLIER_BY_BOARD_SIZE = {
    16: 1,
    36: 2,
    64: 3,
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
