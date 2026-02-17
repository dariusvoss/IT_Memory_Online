import threading
import time
from typing import Optional

class TimerService:
    """Service that manages the game timer"""
    
    def __init__(self):
        self.elapsed_seconds = 0
        self.is_timer_running = False
        self._timer_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
    
    def start_timer(self) -> None:
        """Start the timer"""
        if not self.is_timer_running:
            self.is_timer_running = True
            self._stop_event.clear()
            self._timer_thread = threading.Thread(target=self._run_timer, daemon=True)
            self._timer_thread.start()
    
    def stop_timer(self) -> None:
        """Stop the timer"""
        if self.is_timer_running:
            self.is_timer_running = False
            self._stop_event.set()
    
    def reset_timer(self) -> None:
        """Reset the timer"""
        self.stop_timer()
        self.elapsed_seconds = 0
    
    def _run_timer(self) -> None:
        """Internal timer loop"""
        while self.is_timer_running and not self._stop_event.is_set():
            time.sleep(1)
            if self.is_timer_running:
                self.elapsed_seconds += 1
    
    def get_elapsed_seconds(self) -> int:
        """Get elapsed seconds"""
        return self.elapsed_seconds
    
    def get_formatted_timer(self) -> str:
        """Get formatted timer as MM:SS"""
        minutes = self.elapsed_seconds // 60
        seconds = self.elapsed_seconds % 60
        return f"{minutes}:{seconds:02d}"
