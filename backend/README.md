# Memory Game Backend - FastAPI

Dies ist das Backend für das Memory Game. Es wurde mit FastAPI entwickelt und stellt alle notwendigen APIs für das Spiel bereit.

## Installation

### 1. Python-Umgebung einrichten

```bash
# In den backend-Ordner wechseln
cd backend

# Virtuelle Umgebung erstellen (optional, aber empfohlen)
python -m venv venv

# Virtuelle Umgebung aktivieren
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 2. Abhängigkeiten installieren

```bash
pip install -r requirements.txt
```

## Starten des Servers

```bash
# Development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production server
uvicorn main:app --host 0.0.0.0 --port 8000
```

Der Server läuft dann unter `http://localhost:8000`

API Dokumentation: `http://localhost:8000/docs` (Swagger UI)

## API Endpoints

### Game Management

#### `POST /api/game/initialize`
Initialisiert ein neues Spiel mit einer bestimmten Kartenzahl.

**Request:**
```json
{
  "card_count": 16
}
```

**Parameter:**
- `card_count`: 16, 36 oder 64 Karten

**Response:**
```json
{
  "status": "success",
  "message": "Game initialized",
  "cards": [...]
}
```

#### `POST /api/game/set-difficulty`
Setzt die Schwierigkeitsstufe des Spiels.

**Request:**
```
POST /api/game/set-difficulty?difficulty=Leicht
```

**Parameter:**
- `difficulty`: "Leicht", "Mittel", "Schwer" oder "None"

**Response:**
```json
{
  "status": "success",
  "difficulty": "Leicht"
}
```

#### `POST /api/game/reset`
Setzt das Spiel in den Ausgangszustand zurück.

**Response:**
```json
{
  "status": "success",
  "message": "Game reset"
}
```

### Card Operations

#### `POST /api/game/flip-card`
Dreht eine Karte um.

**Request:**
```json
{
  "card_id": 0
}
```

**Response:**
```json
{
  "status": "success",
  "cards": [...],
  "selected_cards_count": 1,
  "match_result": null
}
```

### Timer Management

#### `POST /api/game/start-timer`
Startet den Timer.

**Response:**
```json
{
  "status": "success",
  "message": "Timer started"
}
```

#### `POST /api/game/stop-timer`
Stoppt den Timer.

**Response:**
```json
{
  "status": "success",
  "message": "Timer stopped"
}
```

#### `GET /api/game/timer`
Ruft den aktuellen Timerwert ab.

**Response:**
```json
{
  "elapsed_seconds": 120,
  "formatted": "2:00",
  "is_running": true
}
```

### Game State

#### `GET /api/game/state`
Ruft den aktuellen Spielzustand ab.

**Response:**
```json
{
  "cards": [...],
  "is_player_turn": true,
  "pairs_found": 2,
  "player_points": 2,
  "bot_points": 0,
  "difficulty": "Leicht",
  "game_started": true,
  "timer": 45
}
```

#### `POST /api/game/check-win`
Prüft, ob das Spiel gewonnen wurde.

**Response (wenn gewonnen):**
```json
{
  "status": "success",
  "won": true,
  "time": "2:30",
  "rank": "A",
  "player_points": 8,
  "bot_points": 0,
  "difficulty": "Leicht"
}
```

### Bot Operations

#### `POST /api/game/bot-move`
Führt einen Zug des Bots aus.

**Response:**
```json
{
  "status": "success",
  "move": {
    "type": "random",
    "first_card": 5,
    "second_card": 12,
    "is_pair": false
  },
  "cards": [...],
  "bot_points": 0
}
```

### Game Records

#### `GET /api/game/records`
Ruft alle Spielaufzeichnungen ab.

**Response:**
```json
{
  "status": "success",
  "records": [
    {
      "date": "2024-01-15 10:30:45",
      "mode": "Spieler vs. Zeit",
      "difficulty_level": "Leicht",
      "deck_size": "Klein (16 Karten)",
      "points": "-",
      "rank": "A",
      "time": "2:15"
    }
  ]
}
```

#### `POST /api/game/save-record`
Speichert eine Spielaufzeichnung.

**Request:**
```json
{
  "date": "2024-01-15 10:30:45",
  "mode": "Spieler vs. Zeit",
  "difficulty_level": "Leicht",
  "deck_size": "Klein (16 Karten)",
  "points": "-",
  "rank": "A",
  "time": "2:15"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Record saved"
}
```

#### `DELETE /api/game/records`
Löscht alle Spielaufzeichnungen.

**Response:**
```json
{
  "status": "success",
  "message": "All records deleted"
}
```

## Projektstruktur

```
backend/
├── main.py                 # FastAPI App und Endpoints
├── models.py              # Pydantic Datenmodelle
├── requirements.txt       # Python Abhängigkeiten
├── services/
│   ├── __init__.py
│   ├── game.py           # Spiellogik
│   ├── timer.py          # Timer-Verwaltung
│   └── bot.py            # Bot AI Logik
└── data/
    └── game_records.json # Gespeicherte Spielaufzeichnungen
```

## Spielmodi

### Spieler vs. Zeit (Mode: None)
- Der Spieler versucht, alle Paare in der kürzesten Zeit zu finden
- Der Timer läuft ständig
- Ranking wird basierend auf Zeit berechnet

### Spieler vs. Bot
- Der Spieler spielt gegen einen Bot
- Der Schwierigkeitsgrad bestimmt die Bot-Intelligenz

**Schwierigkeitsgrade:**
- **Leicht**: Bot deckt zufällig Karten auf
- **Mittel**: Bot merkt sich Karten, die er aufgedeckt hat
- **Schwer**: Bot merkt sich alle aufgedeckten Karten (auch die des Spielers)

## Bot AI Logik

Der Bot hat ein Gedächtnis, das bis zu einer bestimmten Anzahl von Karten speichert:
- **Kleine Decks (16)**: 4 Karten
- **Mittlere Decks (36)**: 8 Karten  
- **Große Decks (64)**: 10 Karten

Basierend auf der Schwierigkeit:
- **Leicht**: Zufällige Auswahl
- **Mittel**: Versucht Paare zu finden, die er aufgedeckt hat (nur seine eigenen Züge)
- **Schwer**: Versucht Paare zu finden, die er aufgedeckt hat (auch Spieler-Karten)

## Frontend Integration

Das Backend ist für CORS konfiguriert und kann von jedem Origin aus aufgerufen werden. Das Frontend sollte die API unter `http://localhost:8000/api/` aufrufen.

Beispiel API-Aufruf von Angular:
```typescript
constructor(private http: HttpClient) {}

initializeGame() {
  this.http.post('/api/game/initialize', { card_count: 16 })
    .subscribe(res => console.log(res));
}
```

## Datenspeicherung

Spielaufzeichnungen werden in `backend/data/game_records.json` gespeichert. Diese Datei wird automatisch erstellt und aktualisiert.

## Entwicklung

### Async Support
Das Backend unterstützt auch async/await Operationen. Für I/O-intensive Operationen können Operationen mit `async`/`await` implementiert werden.

### Logging
Logging kann durch Importieren des `logging`-Moduls hinzugefügt werden:

```python
import logging

logger = logging.getLogger(__name__)
logger.info("Message")
```

## Troubleshooting

**Port 8000 wird bereits verwendet:**
```bash
# Anderen Port verwenden
uvicorn main:app --reload --port 8001
```

**CORS Fehler:**
CORS ist bereits im Backend aktiviert. Falls trotzdem Fehler auftreten, Frontend URL in `main.py` hinzufügen:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular default port
    ...
)
```

**Python nicht gefunden:**
Stellen Sie sicher, dass Python 3.8+ installiert ist:
```bash
python --version
```

## Lizenz

Dieses Projekt ist Teil des Memory Game Projekts.
