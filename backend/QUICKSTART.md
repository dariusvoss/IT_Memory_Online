# 🚀 Schnellstart-Anleitung - Memory Game Backend

Folgen Sie diese Schritte, um das Backend schnell zu starten und zu testen.

## Voraussetzungen

- Python 3.8 oder höher
- pip (Python Package Manager)
- Optionally: PowerShell (Windows) oder Terminal (macOS/Linux)

## Installation & Start (Windows PowerShell)

### 1. In den Backend-Folder wechseln

```powershell
cd backend
```

### 2. Virtuelle Umgebung erstellen (Optional, aber empfohlen)

```powershell
# Virtuelle Umgebung erstellen
python -m venv venv

# Virtuelle Umgebung aktivieren
.\venv\Scripts\Activate.ps1

# Falls Aktivierungsfehler auftritt, diesen Befehl ausführen:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3. Abhängigkeiten installieren

```powershell
pip install -r requirements.txt
```

### 4. Backend starten

```powershell
# Development (mit Auto-Reload)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# oder einfach:
uvicorn main:app --reload
```

Du solltest diese Ausgabe sehen:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
```

## ✅ Ich bin Online! - Was nun?

### API Dokumentation ansehen
Öffne deinen Browser und navigiere zu:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc Alternative**: http://localhost:8000/redoc

### Backend testen

**Option 1: Mit Python-Test-Script**
```powershell
# Neues PowerShell-Fenster öffnen, in backend/ bleiben
python test_api.py
```

**Option 2: Mit Curl (Windows PowerShell)**
```powershell
# Game mit 16 Karten initialisieren
Invoke-RestMethod -Uri "http://localhost:8000/api/game/initialize" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"card_count": 16}' | ConvertTo-Json

# Schwierigkeit setzen
Invoke-RestMethod -Uri "http://localhost:8000/api/game/set-difficulty?difficulty=Leicht" `
  -Method POST

# Spielzustand abrufen
Invoke-RestMethod -Uri "http://localhost:8000/api/game/state" -Method GET | ConvertTo-Json
```

**Option 3: Mit Postman oder Insomnia**
1. Collection mit den Endpoints importieren (siehe Requests unten)
2. Requests testen

### Beispiel Requests

#### Game initialisieren
```http
POST http://localhost:8000/api/game/initialize
Content-Type: application/json

{
  "card_count": 16
}
```

#### Schwierigkeit setzen
```http
POST http://localhost:8000/api/game/set-difficulty?difficulty=Leicht
```

#### Game State abrufen
```http
GET http://localhost:8000/api/game/state
```

#### Karte umdrehen
```http
POST http://localhost:8000/api/game/flip-card
Content-Type: application/json

{
  "card_id": 0
}
```

#### Timer starten
```http
POST http://localhost:8000/api/game/start-timer
```

#### Bot zug
```http
POST http://localhost:8000/api/game/bot-move
```

## 📁 Dateien & Ordner

Nach dem Start wird diese Struktur erstellt:

```
backend/
├── main.py              # FastAPI App (Haupteintrag)
├── models.py           # Datenmodelle
├── config.py           # Konfigurationsdatei
├── utils.py            # Hilfsfunktionen
├── requirements.txt    # Python Abhängigkeiten
├── test_api.py         # Test Script
├── services/
│   ├── game.py        # Spiellogik
│   ├── timer.py       # Timer-Service
│   └── bot.py         # Bot AI
└── data/
    └── game_records.json  # Spielaufzeichnungen (wird erstellt)
```

## 🐛 Fehlerbehebung

### Fehler: "Port 8000 wird bereits verwendet"
```powershell
# Anderen Port verwenden
uvicorn main:app --reload --port 8001
```

### Fehler: "ModuleNotFoundError: No module named 'fastapi'"
```powershell
# Abhängigkeiten erneut installieren
pip install -r requirements.txt
```

### Fehler: "Python nicht gefunden"
```powershell
# Python Version überprüfen
python --version

# Ggf. python3 verwenden
python3 -m uvicorn main:app --reload
```

### CORS Fehler im Frontend
Der Backend ist bereits mit offenen CORS konfiguriert. Falls trotzdem Fehler:

1. Backend-Port überprüfen: http://localhost:8000 sollte antwortet
2. In main.py bei Bedarf Frontend-URL hinzufügen:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular default
    ...
)
```

## 🧪 Test-Szenarios

### Szenario 1: Einfaches Spiel (Spieler vs. Zeit)
```powershell
# 1. Game starten
POST /api/game/initialize { "card_count": 16 }

# 2. Schwierigkeit auf "None"
POST /api/game/set-difficulty?difficulty=None

# 3. Timer starten
POST /api/game/start-timer

# 4. Karten umdrehen
POST /api/game/flip-card { "card_id": 0 }
POST /api/game/flip-card { "card_id": 1 }

# 5. Spielzustand überprüfen
GET /api/game/state

# 6. Timer abrufen
GET /api/game/timer
```

### Szenario 2: Spieler vs. Bot (Leicht)
```powershell
# 1. Game starten
POST /api/game/initialize { "card_count": 16 }

# 2. Schwierigkeit auf "Leicht"
POST /api/game/set-difficulty?difficulty=Leicht

# 3. Spielerzug
POST /api/game/flip-card { "card_id": 0 }
POST /api/game/flip-card { "card_id": 1 }

# 4. Bot-Zug
POST /api/game/bot-move

# 5. Spielzustand überprüfen
GET /api/game/state
```

### Szenario 3: Spieler vs. Bot (Schwer)
```powershell
# 1. Game starten
POST /api/game/initialize { "card_count": 16 }

# 2. Schwierigkeit auf "Schwer"
POST /api/game/set-difficulty?difficulty=Schwer

# 3. Mehrere Karten aufdecken (Bot merkt sich)
POST /api/game/flip-card { "card_id": 0 }
POST /api/game/flip-card { "card_id": 5 }

# 4. Bot weiß jetzt, wo die Karten sind
POST /api/game/bot-move  # Bot findet Paar oder zufälliger Zug
```

## 📊 Spielaufzeichnungen

Alle Spielaufzeichnungen werden in `backend/data/game_records.json` gespeichert.

```powershell
# Aufzeichnungen abrufen
GET /api/game/records

# Aufzeichnung speichern
POST /api/game/save-record
{
  "date": "2024-01-15 10:30:45",
  "mode": "Spieler vs. Zeit",
  "difficulty_level": "Leicht",
  "deck_size": "Klein (16 Karten)",
  "points": "-",
  "rank": "A",
  "time": "2:15"
}

# Alle Aufzeichnungen löschen
DELETE /api/game/records
```

## 🎮 Frontend Integration (Kommende Schritte)

Das Frontend kann die Backend-APIs folgendermaßen nutzen:

```typescript
// In einem Angular Service
import { HttpClient } from '@angular/common/http';

export class GameService {
  private API_URL = 'http://localhost:8000/api';
  
  constructor(private http: HttpClient) {}
  
  initializeGame(cardCount: number) {
    return this.http.post(`${this.API_URL}/game/initialize`, { card_count: cardCount });
  }
  
  flipCard(cardId: number) {
    return this.http.post(`${this.API_URL}/game/flip-card`, { card_id: cardId });
  }
  
  getGameState() {
    return this.http.get(`${this.API_URL}/game/state`);
  }
}
```

## 📚 Weitere Ressourcen

- **FastAPI Dokumentation**: https://fastapi.tiangolo.com/
- **Uvicorn Dokumentation**: https://www.uvicorn.org/
- **API Vergleich**: Siehe `FRONTEND_TO_BACKEND_LOGIC.md`

## 💡 Developer Tipps

1. **Hot Reload**: Mit `--reload` Flag lädt die App bei Änderungen automatisch neu
2. **Debugging**: Verwende `print()` oder das logging Modul
3. **Database**: Später auf SQLite/PostgreSQL aufrüsten
4. **WebSocket**: Für Live-Updates zwischen Clients
5. **Tests**: pytest verwenden für automatisierte Tests

## ✨ Das wars!

Backend läuft erfolgreich. Viel Spaß beim Entwickeln! 🎉

---

**Fragen?** Siehe `README.md` für detaillierte API-Dokumentation.
