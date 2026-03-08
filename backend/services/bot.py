import random
from typing import Dict, Optional, Tuple, List
from collections import OrderedDict

class BotAI:
    """Bot AI service for memory game"""
    
    def __init__(self):
        self.difficulty = 'Leicht'
        self.memory: OrderedDict[int, int] = OrderedDict()  # index -> card_id mapping
        self.card_count = 0
    
    def set_difficulty(self, difficulty: str) -> None:
        """Set bot difficulty level"""
        if difficulty in {'Leicht', 'Mittel', 'Schwer'}:
            self.difficulty = difficulty
        else:
            raise ValueError(f"Invalid difficulty: {difficulty}")
    
    def initialize(self, card_count: int) -> None:
        """Initialize bot for a game"""
        self.card_count = card_count
        self.memory.clear()
    
    def remember_card(self, index: int, card_id: int, seen_by: str = 'bot') -> None:
        """
        Bot remembers a card based on difficulty level and who revealed it.
        
        Args:
            index: Card position index
            card_id: Card ID
            seen_by: 'bot' if bot revealed the card, 'player' if player revealed it
        """
        max_memory = self._get_max_memory_size()
        
        # Don't remember if already in memory
        if index in self.memory:
            return
        
        # For 'Mittel' difficulty: only remember cards bot revealed
        if self.difficulty == 'Mittel' and seen_by == 'player':
            return
        
        # For 'Leicht' difficulty: don't remember anything
        if self.difficulty == 'Leicht':
            return
        
        # Remove oldest card if memory is full
        if len(self.memory) >= max_memory:
            oldest_key = next(iter(self.memory))
            del self.memory[oldest_key]
        
        # Add new card to memory
        self.memory[index] = card_id
    
    def forget_card(self, index: int) -> None:
        """Bot forgets a card (when it's matched)"""
        if index in self.memory:
            del self.memory[index]
    
    def clear_memory(self) -> None:
        """Clear all memory"""
        self.memory.clear()
    
    def find_known_pair(self) -> Optional[Tuple[int, int]]:
        """Find a known matching pair in memory"""
        # Look for two cards with the same id
        memory_items = list(self.memory.items())
        
        for i in range(len(memory_items)):
            for j in range(i + 1, len(memory_items)):
                idx1, card_id1 = memory_items[i]
                idx2, card_id2 = memory_items[j]
                
                if card_id1 == card_id2:
                    return (idx1, idx2)
        
        return None
    
    def _get_max_memory_size(self) -> int:
        """Get maximum memory size based on card count"""
        if self.card_count == 16:
            return 4  # 4 cards for small deck
        elif self.card_count == 36:
            return 8  # 8 cards for medium deck
        elif self.card_count == 64:
            return 10  # 10 cards for large deck
        return 2  # default
    
    def get_memory_status(self) -> Dict:
        """Get current memory status"""
        return {
            'difficulty': self.difficulty,
            'memory_count': len(self.memory),
            'max_memory': self._get_max_memory_size(),
            'memory': dict(self.memory)
        }
    
    def decide_move(self, available_cards: List[Tuple[int, dict]]) -> Tuple[int, int]:
        """
        Decide which two cards to flip based on difficulty level.
        
        Args:
            available_cards: List of (index, card_dict) tuples for available cards
            
        Returns:
            Tuple of (first_card_index, second_card_index)
        """
        if self.difficulty == 'Leicht':
            return self._decide_random_move(available_cards)
        else:  # 'Mittel' or 'Schwer'
            return self._decide_memory_move(available_cards)
    
    def _decide_random_move(self, available_cards: List[Tuple[int, dict]]) -> Tuple[int, int]:
        """
        Decide random move for 'Leicht' difficulty.
        
        Args:
            available_cards: List of (index, card) tuples
            
        Returns:
            Tuple of (first_index, second_index)
        """
        # First card (random)
        first_idx, _ = random.choice(available_cards)
        
        # Second card (remove first from available)
        remaining = [c for c in available_cards if c[0] != first_idx]
        if not remaining:
            return (first_idx, -1)  # Only one card available
        
        second_idx, _ = random.choice(remaining)
        
        return (first_idx, second_idx)
    
    def _decide_memory_move(self, available_cards: List[Tuple[int, dict]]) -> Tuple[int, int]:
        """
        Decide move using memory for 'Mittel' and 'Schwer' difficulties.
        
        First tries to find a known pair, falls back to random.
        
        Args:
            available_cards: List of (index, card) tuples
            
        Returns:
            Tuple of (first_index, second_index)
        """
        if pair := self.find_known_pair():
            first_idx, second_idx = pair
            available_indices = [idx for idx, _ in available_cards]

            # Check if both cards of the pair are still available
            if first_idx in available_indices and second_idx in available_indices:
                return (first_idx, second_idx)

        # Fall back to random move if no known pair found
        return self._decide_random_move(available_cards)

