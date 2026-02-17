# 🚀 Frontend-Backend Integration Setup Guide

## ✅ Was wurde integriert?

Das Frontend wurde vollständig mit dem FastAPI Backend verknüpft. Das Frontend sendet jetzt API-Requests zum Backend statt die Spiellogik lokal auszuführen.

### Geänderte Services

#### **game.service.ts**
- Alle Methoden verwenden jetzt HTTP-Aufrufe zum Backend
- `initializeGame()` → `POST /api/game/initialize`
- `flipCard()` → `POST /api/game/flip-card`
- `resetGame()` → `POST /api/game/reset`
- `setDifficulty()` → `POST /api/game/set-difficulty`
- `botMove()` → `POST /api/game/bot-move`
- `checkWin()` → `POST /api/game/check-win`

#### **timer.service.ts**
- Timer läuft weiterhin lokal im Frontend
- Benachrichtigt Backend über Start/Stop
- `startTimer()` → notifiziert `POST /api/game/start-timer`
- `stopTimer()` → notifiziert `POST /api/game/stop-timer`

### Geänderte Komponenten

- **menu.component.ts** - Wartet auf API-Responses mit `.subscribe()`
- **board.component.ts** - Subscribet auf `gameService.cards$` Observable für Auto-Updates
- **scoreboard.component.ts** - Lädt Records vom Backend

## 🎯 Quick Start

### Option 1: Mit PowerShell (Windows)

```powershell
# Im Projektroot-Verzeichnis
.\start-dev.ps1
```

Das Script öffnet zwei new Windows:
- Terminal 1: Backend (http://localhost:8000)
- Terminal 2: Frontend (http://localhost:4200)

### Option 2: Mit Bash (macOS/Linux)

```bash
# Im Projektroot-Verzeichnis
chmod +x start-dev.sh
./start-dev.sh
```

### Option 3: Manuell starten

#### Terminal 1: Backend starten
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Backend läuft dann unter: **http://localhost:8000**

#### Terminal 2: Frontend starten
```bash
cd frontend
npm install  # Nur beim ersten Mal
npm start
```

Frontend läuft dann unter: **http://localhost:4200**

## 📋 Checkliste nach Start

### Backend
- [ ] Backend läuft auf http://localhost:8000
- [ ] API Dokumentation unter http://localhost:8000/docs erreichbar
- [ ] Console zeigt keine Fehler

### Frontend
- [ ] Frontend läuft auf http://localhost:4200
- [ ] Seite lädt ohne Fehler
- [ ] Menü ist visible

### Integration
- [ ] Browser DevTools → Network Tab öffnen
- [ ] Spiel starten (PvT oder PvB)
- [ ] Network Tab sollte HTTP-Requests zeigen:
  - `POST /api/game/initialize`
  - `POST /api/game/set-difficulty`
  - `POST /api/game/flip-card` (bei Kartenlicks)
  - `POST /api/game/bot-move` (bei Bot-Zug)
  - `POST /api/game/check-win` (bei Spielende)

## 🔍 API Requests testen

### Mit Swagger UI
1. Öffne http://localhost:8000/docs
2. Alle Endpoints sind dokumentiert
3. Du kannst Requests direkt testen

### Mit Browser DevTools
1. Öffne Frontend (http://localhost:4200)
2. Öffne DevTools (F12)
3. Gehe zu "Network" Tab
4. Filtere nach "game.*"
5. Starte ein Spiel und beobachte die Requests

### Mit cURL/PowerShell
```powershell
# Game initialisieren
Invoke-RestMethod -Uri "http://localhost:8000/api/game/initialize" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"card_count": 16}'

# Schwierigkeit setzen
Invoke-RestMethod -Uri "http://localhost:8000/api/game/set-difficulty?difficulty=Leicht" `
  -Method POST

# Spielzustand abrufen
Invoke-RestMethod -Uri "http://localhost:8000/api/game/state" -Method GET | ConvertTo-Json
```

## 🎮 Spieltest-Szenarien

### Szenario 1: Spieler vs. Zeit (PvT)
1. Klick auf "Spielen" → "Spieler vs. Zeit"
2. Wähle Kartengröße
3. Spiel sollte starten
4. Überprüfe in Network Tab:
   - `initialize` mit `card_count: 16`
   - `set-difficulty?difficulty=None`
   - `flip-card` Calls beim Klicken
   - `check-win` wenn du alle Paare findest

### Szenario 2: Spieler vs. Bot (PvB)
1. Klick auf "Spielen" → "Spieler vs. Bot"
2. Wähle Schwierigkeit (z.B. Leicht)
3. Wähle Kartengröße
4. Spiel sollte starten
5. Überprüfe:
   - `set-difficulty?difficulty=Leicht`
   - `bot-move` Calls nach deinem Zug
   - Spielerwechsel funktioniert

### Szenario 3: Scoreboard
1. Beende ein Spiel
2. Clicke auf "Scoreboard"
3. Deine gespielte Partie sollte angezeigt werden
4. Überprüfe in Network Tab:
   - `get /api/game/records`
   - Eintrag wurde gespeichert (`save-record`)

## ⚙️ Konfiguration

### Backend URL ändern

Falls Backend auf anderem Port/Host läuft:

**Frontend `environment.ts`:**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://dein-backend:8000/api'  // ← ändern
};
```

**Frontend `environment.prod.ts`:**
```typescript
export const environment = {
  production: true,
  apiUrl: 'http://dein-backend:8000/api'  // ← ändern
};
```

Dann Frontend neu kompilieren: `ng build`

### Backend Port ändern

**Backend starten mit anderem Port:**
```bash
python -m uvicorn main:app --reload --port 9000
```

Dann Frontend environment anpassen.

## 🐛 Debugging

### Problem: CORS Fehler
```
Access to XMLHttpRequest at 'http://localhost:8000/api/game/...' 
from origin 'http://localhost:4200' has been blocked by CORS policy
```

**Lösung**: Backend hat CORS aktiviert, sollte funktionieren
- Backend URL in environment.ts überprüfen
- Backend neustarten

### Problem: 404 Not Found
```
POST http://localhost:8000/api/game/initialize 404
```

**Lösung**:
- Backend läuft nicht → starten
- Falscher Port → überprüfen
- API-Endpoint falsch → überprüfen

### Problem: Timeout
```
TypeError: Failed to fetch
```

**Lösung**:
- Backend nicht responsive ?→ überprüfen ob läuft
- Netzwerk-Problem → Firewall checken
- Terminal/Tab inactive → Browser fokussieren

### Problem: Cards werden nicht angezeigt
```
[ERROR] No cards loaded
```

**Lösung**:
- initializeGame nicht aufgerufen
- API-Response leer
- Browser Console Fehler überprüfen

### Browser Console Logs prüfen
```javascript
// In Browser Console (F12):

// Sollte passen:
"Difficulty set to: Leicht"
"Game initialized: 16 cards"
"Game reset"
"Record saved"

// Fehler:
"Error flipping card: 404"
"CorePolicyError: CORS disabled"
```

## 📊 Architecture Überblick

```
┌─────────────────────────────────────────────────────┐
│              Frontend (Angular 19)                  │
│                  Port 4200                          │
├─────────────────────────────────────────────────────┤
│  Components:                                        │
│  • menu.component → startGame()                     │
│  • board.component → renderCards()                  │
│  • game-dialog.component → manage game              │
│  • finish-dialog.component → show results           │
│  • scoreboard.component → view records              │
│                                                     │
│  Services (HTTP):                                   │
│  • GameService → API /api/game/*                    │
│  • TimerService → API /api/game/timer              │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP Requests
                       │ (JSON payloads)
                       ↓
┌─────────────────────────────────────────────────────┐
│             Backend (FastAPI)                       │
│                  Port 8000                          │
├─────────────────────────────────────────────────────┤
│  API Endpoints:                                     │
│  POST   /api/game/initialize                        │
│  POST   /api/game/flip-card                         │
│  POST   /api/game/check-win                         │
│  POST   /api/game/set-difficulty                    │
│  POST   /api/game/bot-move                          │
│  GET    /api/game/state                             │
│  POST   /api/game/reset                             │
│  GET    /api/game/records                           │
│  POST   /api/game/save-record                       │
│  DELETE /api/game/records                           │
│                                                     │
│  Services:                                          │
│  • GameService → Game Logic                         │
│  • BotAI → Bot Memory & Moves                       │
│  • TimerService → Timer Management                  │
└──────────────────────┬──────────────────────────────┘
                       │ JSON Responses
                       │ (game state)
                       ↓
┌─────────────────────────────────────────────────────┐
│            Data Storage (JSON Files)                │
│                backend/data/                        │
├─────────────────────────────────────────────────────┤
│  • game_records.json → Spielaufzeichnungen          │
└─────────────────────────────────────────────────────┘
```

## 📚 Weitere Dokumentation

- **[INTEGRATION.md](../INTEGRATION.md)** - Detaillierte Integration Details
- **[backend/README.md](../backend/README.md)** - Backend API Dokumentation
- **[backend/QUICKSTART.md](../backend/QUICKSTART.md)** - Backend Quickstart
- **[FRONTEND_TO_BACKEND_LOGIC.md](../FRONTEND_TO_BACKEND_LOGIC.md)** - Logik-Vergleich

## 🎯 Nächste Schritte

1. **Integration testen** - Alle Spielmodi durchspielen
2. **Performance prüfen** - Network Tab auf Latenz überprüfen
3. **Fehler beheben** - Eventuellen Bugs fixen
4. **Erweiterung** - WebSocket, Multiplayer, etc.

## ✨ Tipps & Tricks

### Frontend Fast Refresh
- Änderungen in `.ts` Dateien werden automatisch reloaded
- Browser aktualisiert sich selbst

### Backend Auto-Reload
- Änderungen in `.py` Dateien werden automatisch reloaded
- API wird neu gestartet automatisch

### OpenAPI/Swagger
- Unter http://localhost:8000/docs
- Kann requests dort testen
- Super für API-Entwicklung

### Network Throttling (DevTools)
- DevTools → Network → "Throttling"
- Simuliere langsames Netz
- 3G/4G/Offline testen

---

**Status**: ✅ Vollständig integriert und funktionsbereit!

Bei Fragen, siehe Dokumentation oben oder erstelle ein Issue.
