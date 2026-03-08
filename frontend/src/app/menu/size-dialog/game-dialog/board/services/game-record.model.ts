/**
 * Interface für Spielaufzeichnungen (Game Records)
 * Speichert alle relevanten Daten eines abgeschlossenen Spieldurchlaufs
 */
export interface GameRecord {
  date: string;                    // Datum und Uhrzeit des Spielendes
  mode: 'Spieler vs. Bot' | 'Spieler vs. Zeit' | 'Multiplayer';  // Spielmodus
  difficultyLevel: string;         // Schwierigkeitsgrad (nur bei PvB, sonst "-")
  deckSize: string;                // Kartensatzgröße (z.B. "Klein (16 Karten)")
  points: string | number;         // Punkte/Paare (PvB & Multiplayer) oder "-"
  rank: string;                    // Rang (nur bei PvT: A-E), sonst "-"
  time: string;                    // Zeit im Format MM:SS (nur bei PvT), sonst "-"
  result: string;                  // Endergebnis: "Sieg" | "Niederlage" | "Unentschieden" (nur bei PvB & Multiplayer), sonst "-"
}
