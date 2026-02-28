# Frontend-Backend Integration Handbuch

## 📋 Überblick der Änderungen

Dein Backend wurde auf ein Session-basiertes System umgestellt. Das Frontend muss angepasst werden, um mit dieser neuen Struktur zu kommunizieren.

### Neue Architektur:
```
Frontend (Angular) 
    ↓
SessionService (TypeScript)  ← NEW: Verwaltung von Spiel-Sessions
    ↓
GameService (TypeScript)     ← UPDATED: Nutzt SessionService
    ↓
Backend API (/api/session/*) ← NEW: Session-basierte Endpoints
```

---

## 🚀 Schrittweise Integration

### **Phase 1: Backend bereit machen (✅ DONE)**

- [x] GameSession Klasse mit Session-Management implementiert
- [x] Alle Endpoints in main.py angepasst
- [x] Session-basierte API mit eindeutigem session_id

### **Phase 2: Frontend Services anpassen (✅ DONE)**

Die folgenden Dateien wurden erstellt/angepasst:

**Neu erstellt:**
- `frontend/src/app/.../services/session.service.ts` - Zentrale Session-Verwaltung

**Aktualisiert:**
- `frontend/src/app/.../services/game.service.ts` - Nutzt jetzt SessionService

### **Phase 3: Die Integration testen**

#### A. Backend starten

```bash
cd c:\Users\dariu\GitHub\IT_Memory_Online\backend
python main.py
```

**Erwartete Ausgabe:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

#### B. Integration testen (Python-Script)

```bash
cd c:\Users\dariu\GitHub\IT_Memory_Online\backend
python test_integration.py
```

Dies testet:
- ✅ Session erstellen
- ✅ Spiel starten
- ✅ Karten umdrehen
- ✅ Gewinn-Bedingung prüfen
- ✅ Bot-Modus
- ✅ Session löschen

#### C. Frontend starten und testen

```bash
cd c:\Users\dariu\GitHub\IT_Memory_Online\frontend
npm install
ng serve
```

Öffne: `http://localhost:4200`

---

## 🔄 Data Flow Vergleich

### ALT (vorher):
```
Frontend
  → POST /api/game/initialize
  → POST /api/game/flip-card
  → POST /api/game/check-win
  → POST /api/game/reset
```

### NEU (nachher):
```
Frontend
  → POST /api/session/create          (erstellt Session, gibt session_id)
  → POST /api/session/{id}/start      (startet das Spiel)
  → POST /api/session/{id}/flip-card  (Karte umdrehen)
  → POST /api/session/{id}/check-win  (Gewinn prüfen)
  → POST /api/session/{id}/reset      (zurücksetzen)
  → DELETE /api/session/{id}          (cleanup)
```

### Wichtige Unterschiede:

| Aspekt | ALT | NEU |
|--------|-----|-----|
| **Session-Management** | Implizit (Backend-Zustand) | Explizit (eindeutige `session_id`) |
| **Mehrere Spiele parallel** | ❌ Nicht möglich | ✅ Ja (verschiedene session_ids) |
| **Dekodoschwierigkeit** | Auf einen Spieler beschränkt | Multi-Session-fähig |
| **State-Verwaltung** | Zentral im Backend | Verwaltet per Session |

---

## 🛠️ Implementation Checklist

### Frontend (Game Service)

- [x] **SessionService erstellt** - Handles alle Session-API calls
- [x] **GameService angepasst** - Nutzt SessionService
- [x] **API URL aktualisiert** - Zu neuem Endpoint-Format
- [x] **Fehlerbehandlung** - Session-basierte Fehler
- [ ] **UI anpassen** - Falls nötig für neue Flows
- [ ] **Testen im Browser**

### Backend (Main API)

- [x] **Session-Endpoints implementiert**
  - [x] `/api/session/create`
  - [x] `/api/session/{id}/start`
  - [x] `/api/session/{id}/flip-card`
  - [x] `/api/session/{id}/check-win`
  - [x] `/api/session/{id}/bot-move`
  - [x] `/api/session/{id}/reset`
  - [x] `/api/session/{id}` (GET)

- [ ] **Testen mit Integrations-Script**
- [ ] **Fehlerbehandlung prüfen**
- [ ] **CORS** (sollte bereits konfiguriert sein)

---

## ⚠️ Häufige Probleme & Lösungen

### 1. **"No active session" Error**

**Problem:** Frontend bekommt Session-ID nicht richtig
```
Error: No active session
```

**Lösung:**
```typescript
// SessionService muss die session_id speichern
const sessionId = response.data.session_id;
sessionService.setCurrentSessionId(sessionId);
```

### 2. **CORS Fehler**

Frontend auf `localhost:4200`, Backend auf `localhost:8000`

**Sollte bereits gelöst sein in main.py:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    ...
)
```

Wenn noch Problem: Backend neustart erforderlich!

### 3. **302 Redirect beim Flip-Card**

**Problem:** Frontend sendet falsche Daten
```json
// FALSCH
{"card_id": 0}

// RICHTIG  
{"card_index": 0}
```

### 4. **Backend antwortet, aber Frontend zeigt nichts**

**Problem:** Response-Structure unterscheidet sich

Überprüfe:
```typescript
// Backend gibt zurück:
{
  "status": "success",
  "valid_move": true,
  "cards": [...],
  "is_match": true,
  ...
}

// Frontend erwartet:
response.cards        // ✅
response.is_match     // ✅
response.player_points // ✅
```

---

## 📊 Response Struktur Referenz

### Flip Card Response
```json
{
  "status": "success",
  "valid_move": true,
  "cards": [
    {
      "id": 0,
      "image": "assets/images-small/...",
      "flipped": true,
      "matched": false
    }
  ],
  "selected_cards_count": 1,
  "is_match": false,
  "matched_positions": [],
  "current_player": "player1",
  "player_points": {"player1": 0},
  "pairs_found": 0,
  "game_mode": "singleplayer_time"
}
```

### Check Win Response
```json
{
  "status": "success",
  "won": true,
  "game_mode": "singleplayer_time",
  "winner": "player1",
  "player_points": {"player1": 8},
  "pairs_found": 8,
  "difficulty": "None",
  "rank": "A",
  "elapsed_time": 120
}
```

---

## 🧪 Test-Befehle

```bash
# Integration Test (Python)
python c:\Users\dariu\GitHub\IT_Memory_Online\backend\test_integration.py

# Backend Single Test
curl -X POST http://localhost:8000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{
    "player_ids": ["player1"],
    "difficulty": "None",
    "board_size": 16,
    "game_mode": "singleplayer_time"
  }'

# Frontend (Beispiel im Browser-Console)
// Nach ng serve starten
SessionService.createSession(
  ['player1'], 
  'None', 
  16, 
  'singleplayer_time'
).subscribe(r => console.log(r))
```

---

## 🎯 Nächste Schritte

1. **Backend testen**
   ```bash
   python test_integration.py
   ```

2. **Frontend starten**
   ```bash
   ng serve --open
   ```

3. **Im Browser testen**
   - Neues Spiel starten
   - Karten umdrehen
   - Paarungen finden
   - Timer beobachten
   - Finish-Dialog überprüfen

4. **Debug** (wenn nötig)
   - Browser-Console (F12) - Frontend-Fehler
   - `http://localhost:8000/docs` - Backend-API Swagger Doku

---

## 📝 Weitere Notes

### Environment-Variablen

Die API-URL ist hard-coded in SessionService:
```typescript
private apiUrl = `${environment.apiUrl}/session`;
```

Überprüfe `environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api'  // ← Sollte stimmen
};
```

### Performance

Mit Session-Management kannst du:
- ✅ Mehrere Spiele gleichzeitig spielen
- ✅ Spiele verlassen und später fortsetzen
- ✅ Spiele analysieren (replay)
- ✅ Statistiken tracken

### Weitere Integration

Später könnten noch implementiert werden:
- User-Authentifizierung
- Spiel-Speicherung in Datenbank
- Multiplayer über WebSockets
- Statistik-Endpoints

---

## ✅ Fertig!

Wenn alle Tests bestanden sind, ist die Integration abgeschlossen! 🎉

Bei Problemen → CheckConsole Output & API Response im Browser-Inspector
