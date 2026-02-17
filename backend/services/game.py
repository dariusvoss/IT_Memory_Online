import json
import os
import random
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from services.bot import BotAI

# List of card images (matching the frontend)
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

class GameService:
    """Service that manages the game logic"""
    
    def __init__(self):
        self.is_player_turn = True
        self.game_started = False
        self.cards = []
        self.selected_cards = []
        self.pairs_found = 0
        self.pairs_found_player = 0
        self.pairs_found_bot = 0
        self.difficulty = 'Leicht'
        self.deck_size = ''
        self.delay = 0.8
        self.visible_delay = 0.5
        self.bot_ai = BotAI()
        self.game_records = []
        self.selected_images = []
        
        # Load game records from file
        self.load_game_records()

    # ========================= Getters/Setters =========================
    
    def get_cards(self) -> List[Dict]:
        """Get all cards"""
        return self.cards
    
    def get_selected_cards(self) -> List[Dict]:
        """Get currently selected cards"""
        return self.selected_cards
    
    def get_pairs_found(self) -> int:
        """Get number of pairs found"""
        return self.pairs_found
    
    def get_player_points(self) -> int:
        """Get player's points (pairs found)"""
        return self.pairs_found_player
    
    def get_bot_points(self) -> int:
        """Get bot's points (pairs found)"""
        return self.pairs_found_bot
    
    def get_difficulty(self) -> str:
        """Get current difficulty level"""
        return self.difficulty
    
    def get_deck_size(self) -> int:
        """Get current deck size"""
        return len(self.cards)
    
    def set_difficulty(self, level: str) -> None:
        """Set game difficulty level"""
        valid_levels = ['Leicht', 'Mittel', 'Schwer', 'None']
        if level not in valid_levels:
            raise ValueError(f"Invalid difficulty level: {level}")
        self.difficulty = level
        if level != 'None':
            self.bot_ai.set_difficulty(level)

    def get_game_records(self) -> List[Dict]:
        """Get all game records"""
        return self.game_records
    
    # ========================= Game Logic =========================
    
    def initialize_game(self, card_count: int) -> None:
        """Initialize game with specified card count (16, 36, or 64)"""
        if card_count not in [16, 36, 64]:
            raise ValueError(f"Invalid card count: {card_count}. Must be 16, 36, or 64.")
        
        # Select images based on card count
        self.selected_images = CARD_IMAGES[:card_count // 2]
        
        # Create cards (two of each image)
        self.cards = []
        for index, image in enumerate(self.selected_images):
            self.cards.append({'id': index, 'image': image, 'flipped': False, 'matched': False})
            self.cards.append({'id': index, 'image': image, 'flipped': False, 'matched': False})
        
        # Shuffle cards
        self.shuffle_cards()
        
        # Reset game state
        self.selected_cards = []
        self.pairs_found = 0
        self.game_started = True
        
        # Initialize bot if difficulty is not 'None'
        if self.difficulty != 'None':
            self.bot_ai.initialize(card_count)
    
    def shuffle_cards(self) -> None:
        """Shuffle cards using Fisher-Yates algorithm"""
        for i in range(len(self.cards) - 1, 0, -1):
            j = random.randint(0, i)
            self.cards[i], self.cards[j] = self.cards[j], self.cards[i]
    
    def flip_card(self, card_index: int) -> Optional[bool]:
        """Flip a card at the given index"""
        if card_index < 0 or card_index >= len(self.cards):
            raise IndexError(f"Card index out of range: {card_index}")
        
        card = self.cards[card_index]
        
        # Check if card can be flipped
        if len(self.selected_cards) < 2 and not card['flipped'] and not card['matched']:
            card['flipped'] = True
            self.selected_cards.append({'index': card_index, 'card': card})
            
            # Remember card for bot if difficulty requires it
            if self.difficulty == 'Mittel' and not self.is_player_turn:
                self.bot_ai.remember_card(card_index, card['id'])
            elif self.difficulty == 'Schwer':
                self.bot_ai.remember_card(card_index, card['id'])
        
        # Check if we have two cards selected
        if len(self.selected_cards) == 2:
            return self._check_match()
        
        return None
    
    def _check_match(self) -> bool:
        """Check if the two selected cards match"""
        if not self.selected_cards or len(self.selected_cards) < 2:
            return False
        
        card1 = self.selected_cards[0]['card']
        card2 = self.selected_cards[1]['card']
        
        is_pair = card1['id'] == card2['id']
        
        if is_pair:
            # Cards match - mark as matched
            card1['matched'] = True
            card2['matched'] = True
            self.pairs_found += 1
            
            # Award points
            if self.difficulty == 'None' or self.is_player_turn:
                self.pairs_found_player += 1
            else:
                self.pairs_found_bot += 1
            
            # Remove cards from bot memory
            for selected in self.selected_cards:
                idx = selected['index']
                self.bot_ai.forget_card(idx)
        else:
            # Cards don't match - flip them back
            card1['flipped'] = False
            card2['flipped'] = False
        
        # Always clear selected cards
        self.selected_cards = []
        return is_pair

    def reset_game(self) -> None:
        """Reset the game to initial state"""
        for card in self.cards:
            card['flipped'] = False
            card['matched'] = False
        
        self.selected_cards = []
        self.pairs_found = 0
        self.pairs_found_player = 0
        self.pairs_found_bot = 0
        self.game_started = False
        self.is_player_turn = True
        self.bot_ai.clear_memory()
        self.difficulty = 'Leicht'
    
    def check_win(self) -> bool:
        """Check if the game is won"""
        if self.pairs_found == len(self.selected_images):
            return True
        return False
    
    def calculate_rank(self, time: str, deck_size: int) -> str:
        """Calculate rank based on time and deck size"""
        parts = time.split(':')
        minutes = int(parts[0])
        seconds = int(parts[1])
        total_seconds = minutes * 60 + seconds
        
        if deck_size == 16:
            if total_seconds < 60:
                return 'A'
            elif total_seconds < 120:
                return 'B'
            elif total_seconds < 180:
                return 'C'
            elif total_seconds < 240:
                return 'D'
            else:
                return 'E'
        elif deck_size == 36:
            if total_seconds < 120:
                return 'A'
            elif total_seconds < 240:
                return 'B'
            elif total_seconds < 360:
                return 'C'
            elif total_seconds < 480:
                return 'D'
            else:
                return 'E'
        elif deck_size == 64:
            if total_seconds < 180:
                return 'A'
            elif total_seconds < 360:
                return 'B'
            elif total_seconds < 540:
                return 'C'
            elif total_seconds < 720:
                return 'D'
            else:
                return 'E'
        
        return 'E'
    
    def get_selected_size_text(self, size: int) -> str:
        """Get human-readable deck size text"""
        if size == 16:
            return 'Klein (16 Karten)'
        elif size == 36:
            return 'Mittel (36 Karten)'
        elif size == 64:
            return 'Groß (64 Karten)'
        return ''
    
    # ========================= Bot Logic =========================
    
    def bot_move(self) -> Optional[Dict]:
        """Execute bot's move based on difficulty level"""
        if self.difficulty == 'None' or not self.cards:
            return None
        
        available_cards = [
            (i, card) for i, card in enumerate(self.cards)
            if not card['flipped'] and not card['matched']
        ]
        
        if not available_cards or len(available_cards) < 2:
            return None
        
        if self.difficulty == 'Leicht':
            move = self._random_bot_move(available_cards)
        else:  # Mittel or Schwer
            move = self._bot_memory_move(available_cards)
        
        return move
    
    def _random_bot_move(self, available_cards: List[Tuple]) -> Dict:
        """Bot makes random moves"""
        # First card
        first_idx, first_card = random.choice(available_cards)
        self.flip_card(first_idx)
        
        # Second card (remove first from available)
        remaining = [c for c in available_cards if c[0] != first_idx]
        if not remaining:
            return {'first_card': first_idx, 'second_card': None}
        
        second_idx, second_card = random.choice(remaining)
        self.flip_card(second_idx)
        
        return {
            'type': 'random',
            'first_card': first_idx,
            'second_card': second_idx,
            'is_pair': first_card['id'] == second_card['id']
        }
    
    def _bot_memory_move(self, available_cards: List[Tuple]) -> Dict:
        """Bot uses memory to find pairs"""
        # Check if bot knows a pair
        pair = self.bot_ai.find_known_pair()
        
        if pair:
            first_idx, second_idx = pair
            # Check if cards are still available
            available_indices = [idx for idx, _ in available_cards]
            
            if first_idx in available_indices and second_idx in available_indices:
                self.flip_card(first_idx)
                self.flip_card(second_idx)
                
                first_card = self.cards[first_idx]
                second_card = self.cards[second_idx]
                
                return {
                    'type': 'memory',
                    'first_card': first_idx,
                    'second_card': second_idx,
                    'is_pair': first_card['id'] == second_card['id']
                }
        
        # Fall back to random move if no known pair
        return self._random_bot_move(available_cards)
    
    # ========================= Game Records =========================
    
    def add_game_record(self, record: Dict) -> None:
        """Add a game record"""
        self.game_records.append(record)
        self.save_game_records()
    
    def clear_game_records(self) -> None:
        """Clear all game records"""
        self.game_records = []
        self.save_game_records()
    
    def save_game_records(self) -> None:
        """Save game records to JSON file"""
        records_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'game_records.json')
        os.makedirs(os.path.dirname(records_file), exist_ok=True)
        
        with open(records_file, 'w', encoding='utf-8') as f:
            json.dump(self.game_records, f, ensure_ascii=False, indent=2)
    
    def load_game_records(self) -> None:
        """Load game records from JSON file"""
        records_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'game_records.json')
        
        if os.path.exists(records_file):
            with open(records_file, 'r', encoding='utf-8') as f:
                self.game_records = json.load(f)
        else:
            self.game_records = []
