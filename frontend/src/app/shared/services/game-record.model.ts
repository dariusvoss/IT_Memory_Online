/**
 * Interface for Game Records
 * Stores all relevant data of a completed game session
 */
export interface GameRecord {
  date: string;                    // Date and time of game end
  mode: 'Spieler vs. Bot' | 'Spieler vs. Zeit' | 'Multiplayer';  // Game mode
  difficultyLevel: string;         // Difficulty level (only for PvB, otherwise "-")
  deckSize: string;                // Deck size (e.g., "Small (16 cards)")
  points: string | number;         // Points/pairs (PvB & Multiplayer) or "-"
  rank: string;                    // Rank (only for PvT: A-E), otherwise "-"
  time: string;                    // Time in MM:SS format (only for PvT), otherwise "-"
  result: string;                  // Final result: "Win" | "Loss" | "Draw" (only for PvB & Multiplayer), otherwise "-"
}
