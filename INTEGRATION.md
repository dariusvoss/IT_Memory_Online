# Frontend-Backend Integration

Dieses Dokument beschreibt die Integration zwischen Frontend (Angular) und Backend (FastAPI).

## Übersicht

Das Frontend wurde so angepasst, dass es die API-Endpoints des Backends nutzt, statt die Spiellogik lokal auszuführen. Die Kommunikation erfolgt über HTTP-Requests.

## Architektur

```
Frontend (Angular)
    ↓ HTTP Requests
Backend (FastAPI)
    ↓
Game Logic & Services
    ↓
Data Storage (JSON)
```

## Geänderte Dateien

### Konfiguration
- **[app.config.ts](frontend/src/app/app.config.ts)** - `provideHttpClient()` hinzugefügt
- **[environment.ts](frontend/src/environments/environment.ts)** - Backend URL konfiguriert (http://localhost:8000/api)
- **[environment.prod.ts](frontend/src/environments/environment.prod.ts)** - Production Backend URL (/api)

### Services
- **[game.service.ts](frontend/src/app/menu/size-dialog/game-dialog/board/services/game.service.ts)**
  - Komplett umgeschrieben für API-Integration
  - `initializeGame()` → `POST /api/game/initialize`
  - `flipCard()` → `POST /api/game/flip-card`
  - `resetGame()` → `POST /api/game/reset`
  - `setDifficulty()` → `POST /api/game/set-difficulty`
  - `botMove()` → `POST /api/game/bot-move`
  - `checkWin()` → `POST /api/game/check-win`
  - Game Records → `GET|POST|DELETE /api/game/records`

- **[timer.service.ts](frontend/src/app/menu/size-dialog/game-dialog/board/services/timer.service.ts)**
  - Frontend-Timer läuft lokal
  - Backend wird benachrichtigt: `startTimer()`, `stopTimer()`, `resetTimer()`

### Komponenten
- **[menu.component.ts](frontend/src/app/menu/menu.component.ts)**
  - `initializeGame()` und `setDifficulty()` mit `.subscribe()` werden abgewartet
  - Fehlerbehandlung für API-Aufrufe

- **[board.component.ts](frontend/src/app/menu/size-dialog/game-dialog/board/board.component.ts)**
  - Subscribed auf `gameService.cards$` Observable
  - Auto-Update wenn Backend Karten ändert
  - OnDestroy lifecycle für Cleanup

- **[scoreboard.component.ts](frontend/src/app/menu/scoreboard/scoreboard.component.ts)**
  - `refreshGameRecords()` lädt Records vom Backend
  - `clearGameRecords()` löscht alle Records

## API Integration Patterns

### Pattern 1: Asynchrone Operationen
```typescript
// Vorher (lokal)
this.gameService.initializeGame(16);
this.cards = this.gameService.getCards();

// Nachher (mit API)
this.gameService.initializeGame(16).subscribe(
  response => {
    this.cards = response.cards;
  },
  error => console.error(error)
);
```

### Pattern 2: Observable Subscriptions
```typescript
// Komponente subscribet auf Dienst-Observables
this.gameService.cards$.subscribe(updatedCards => {
  this.cards = updatedCards;
});
```

### Pattern 3: RxJS tap Operator
```typescript
// Service-Methoden nutzen tap() um lokal zu updaten
setDifficulty(level): Observable<any> {
  return this.http.post(url, {}).pipe(
    tap(response => {
      this.difficulty = level;
    })
  );
}
```

## Spielablauf mit API

### 1. Spiel starten (PvT - Player vs Time)
```
Menu Component
  → chooseSize('PvT')
    → SizeDialog (Größe wählen)
      → gameService.setDifficulty('None')
        → POST /api/game/set-difficulty?difficulty=None
      → gameService.initializeGame(16)
        → POST /api/game/initialize { card_count: 16 }
        → Backend shuffled Karten
        → Frontend erhält shuffled Karten
  → GameDialogComponent öffnet
    → BoardComponent rendert Karten
    → User klickt auf Karre
```

### 2. Karte umdrehen
```
User klickt Karte
  → BoardComponent.onCardClick(card)
    → gameService.flipCard(card)
      → POST /api/game/flip-card { card_id: 0 }
      → Backend aktualisiert Kartenzustand
      → Response mit aktualisierten Cards
    → Frontend updated Cards
    → gameService.cards$ Observable emittiert Update
    → BoardComponent rendert neu
```

### 3. Gewinnbedingung
```
2 Karten umgedreht
  → checkMatch()
    → POST /api/game/check-win
    → Backend checks if all pairs found
    → Falls gewonnen:
      → FinishDialog öffnet
      → Record wird gespeichert
      → POST /api/game/save-record
```

### 4. Bot-Zug (PvB - Player vs Bot)
```
Spieler-Zug endet
  → switchTurn()
    → isPlayerTurn = false
    → gameService.botMove()
      → POST /api/game/bot-move
      → Backend macht Zug
      → Response mit Karten-Update
    → Frontend updated
```

## Fehlerbehandlung

Das Frontend hat Error-Handler für API-Fehler:

```typescript
// Beispiel aus GameService
this.http.post(url, data).subscribe(
  response => {
    // Erfolg
  },
  error => {
    console.error('Error flipping card:', error);
    // Revert optimistic update
  }
);
```

## Optimistische Updates

Einige Operationen werden optimistisch im Frontend aktualisiert:

```typescript
// Karte wird sofort geflippt
card.flipped = true;
this.selectedCards.push(card);
this.cardsSubject.next([...this.cards]);

// Dann wird Backend aufgerufen
this.http.post('/api/game/flip-card', ...).subscribe(
  response => {
    // Backend response bestätigt
    this.cards = response.cards;
  },
  error => {
    // Bei Fehler, zurückrollen
    card.flipped = false;
  }
);
```

## Performance Überlegungen

1. **Netzwerk-Latenz**: API-Aufrufe können 10-100ms dauern
   - Lösung: Optimistische Updates für bessere UX

2. **Gleichzeitige Requests**: Frontend wartet auf initializeGame, bevor GameDialog öffnet
   - Lösung: `.subscribe()` abwarten vor nächstem Schritt

3. **Real-time Updates**: Timer läuft lokal, synchronisiert mit Backend
   - Lösung: Lokales Frontend-Timer + Backend Sync

## Testing

### Manual Testing mit Swagger UI
```
1. Backend starten: python -m uvicorn main:app --reload
2. Frontend starten: ng serve
3. Swagger UI öffnen: http://localhost:8000/docs
4. API-Endpoints testen
5. Frontend öffnen: http://localhost:4200
6. Spiel spielen und Requests in Browser DevTools beobachten
```

### Browser DevTools
```
Network Tab:
  - POST /api/game/initialize
  - POST /api/game/flip-card
  - POST /api/game/bot-move
  - POST /api/game/check-win
  - GET /api/game/records

Console:
  - Logs aus Services
  - Error Messages
```

## Environment Konfiguration

### Development (localhost)
```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api'
};
```

### Production
```typescript
// environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api'  // Same origin (Server proxied)
};
```

Bei Production sollte der Server den `/api` Endpoint proxieren zum FastAPI Backend.

## Zurück zu lokaler Logik

Falls später zurück zu lokaler Logik gewechselt werden soll:

1. **game.service.ts** - Alle HTTP-Calls entfernen, lokale Logik reinstellen
2. **timer.service.ts** - Nur lokales Timing, keine HTTP-Calls
3. **Komponenten** - `.subscribe()` calls entfernen
4. **Environment** - apiUrl nicht mehr nötig

## Nächste Schritte

### Kurzfristig
- [ ] WebSocket für Live-Multiplayer
- [ ] Real-time Bot-Animation
- [ ] Loading Spinner bei API-Calls

### Mittelfristig
- [ ] Database (SQLite statt JSON)
- [ ] User Authentication
- [ ] Global Leaderboard
- [ ] Persistent Sessions

### Langfristig
- [ ] Web Worker für Threading
- [ ] Service Worker für Offline
- [ ] Progressive Web App (PWA)
- [ ] Native Apps (React Native)

## Debugging

### Backend Logs
```bash
# Terminal wo uvicorn läuft
INFO:     POST /api/game/initialize
INFO:     Handling request...
```

### Frontend Logs
```
Browser Console:
  GameService: Game initialized
  Timer: Backend timer started
  Error flipping card: ...
```

### HTTP Requests
```
Network Tab → XHR/Fetch
Alle API requests sind hier sichtbar mit Response
```

## Troubleshooting

### CORS Fehler
```
Error: "CORS error: Origin not allowed"

Lösung:
- Backend hat Allow-All CORS
- Frontend muss http://localhost:8000 (nicht localhost:4200) aufrufen
- Check environment.ts apiUrl
```

### 404 Not Found
```
Error: "404 Not Found"

Lösung:
- Backend läuft nicht (start mit: uvicorn main:app --reload)
- Falschen Endpoint URL (check environment.ts)
- Falscher Port (8000 für Backend, 4200 für Frontend)
```

### Request Timeout
```
Error: "Timeout after 30s"

Lösung:
- Backend zu langsam oder nicht responsive
- Netzwerk-Problem
- Browser Tab inactive (timeout)
```

---

**Status**: ✅ Vollständig integriert und getestet

Weitere Fragen? Siehe Backend [README.md](../backend/README.md) oder [FRONTEND_TO_BACKEND_LOGIC.md](../FRONTEND_TO_BACKEND_LOGIC.md)
