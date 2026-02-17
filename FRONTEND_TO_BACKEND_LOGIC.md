# Frontend zu Backend - Logik Vergleich

Dieses Dokument zeigt, wie die Logik aus dem TypeScript Frontend in Backend-API Aufrufe konvertiert werden kann.

## Überblick

Das Frontend enthält derzeit alle Spiellogik in den Angular Services und Komponenten. Das Backend bietet nun APIs an, die diese Logik ersetzen.

## Logik-Vergleich

### 1. Spielinitialisierung

**Frontend (game.service.ts):**
```typescript
initializeGame(cardCount: number) {
  const selectedSize = cardCount;
  this.selectedImages = this.cardImages.slice(0, selectedSize / 2);
  this.cards = this.selectedImages.flatMap((image, index) => [
    { id: index, image, flipped: false, matched: false },
    { id: index, image, flipped: false, matched: false },
  ]);
  this.cards = this.shuffleCards(this.cards);
  this.selectedCards = [];
  this.pairsFound = 0;
  this.gameStarted = true;
}
```

**Backend (API):**
```typescript
// Angular Service Aufruf
this.http.post('/api/game/initialize', { card_count: 16 }).subscribe(response => {
  this.cards = response.cards;
  this.gameStarted = true;
});
```

---

### 2. Kartenmischen (Shuffle)

**Frontend:**
```typescript
private shuffleCards(cards: any[]): any[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
```

**Backend (services/game.py):**
```python
def shuffle_cards(self) -> None:
    """Shuffle cards using Fisher-Yates algorithm"""
    for i in range(len(self.cards) - 1, 0, -1):
        j = random.randint(0, i)
        self.cards[i], self.cards[j] = self.cards[j], self.cards[i]
```

**API Nutzung:** Automatisch in `/api/game/initialize` enthalten

---

### 3. Karten umdrehen

**Frontend:**
```typescript
flipCard(card: any) {
  if (this.selectedCards.length < 2 && !card.flipped && !card.matched) {
    card.flipped = true;
    this.selectedCards.push(card);
    
    if (this.difficulty === 'Mittel' && !this.isPlayerTurn) {
      this.rememberCard(card);
    } else if (this.difficulty === 'Schwer') {
      this.rememberCard(card);
    }
  }
  
  if (this.selectedCards.length === 2) {
    setTimeout(() => this.checkMatch(), this.delay);
  }
}
```

**Backend (API):**
```typescript
// Angular Service
this.http.post('/api/game/flip-card', { card_id: cardIndex }).subscribe(response => {
  this.cards = response.cards;
  this.selectedCardsCount = response.selected_cards_count;
  
  if (response.selected_cards_count === 2) {
    // Check match result
  }
});
```

---

### 4. Paar-Überprüfung

**Frontend:**
```typescript
private checkMatch() {
  let isPair = false;
  if (this.selectedCards[0].id === this.selectedCards[1].id) {
    this.selectedCards.forEach((card) => (card.matched = true));
    this.pairsFound++;
    if (this.difficulty === 'None' || this.isPlayerTurn) {
      this.pairsFoundPlayer++;
    } else {
      this.pairsFoundBot++;
    }
    isPair = true;
  } else {
    this.selectedCards.forEach((card) => (
      setTimeout(() => card.flipped = false, this.visibleDelay)
    ));
  }
  // ... more logic
}
```

**Backend (Automatisch in flip_card):**
```python
def flip_card(self, card_index: int) -> Optional[bool]:
    # ... flip logic
    if len(self.selected_cards) == 2:
        return self._check_match()

def _check_match(self) -> bool:
    card1 = self.selected_cards[0]['card']
    card2 = self.selected_cards[1]['card']
    
    is_pair = card1['id'] == card2['id']
    # ... matching logic
    return is_pair
```

---

### 5. Timer-Management

**Frontend (timer.service.ts):**
```typescript
startTimer() {
  if (!this.intervalSubscription) {
    this.isTimerRunning = true;
    this.intervalSubscription = interval(1000)
      .pipe(map(() => ++this.secondsElapsed))
      .subscribe((seconds) => this.timer$.next(seconds));
  }
}

getFormattedTimer() {
  const time = this.timer$.getValue();
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
```

**Backend (services/timer.py):**
```python
def start_timer(self) -> None:
    self.is_timer_running = True
    self._stop_event.clear()
    self._timer_thread = threading.Thread(target=self._run_timer, daemon=True)
    self._timer_thread.start()

def get_formatted_timer(self) -> str:
    minutes = self.elapsed_seconds // 60
    seconds = self.elapsed_seconds % 60
    return f"{minutes}:{seconds:02d}"
```

**API Nutzung:**
```typescript
// Start Timer
this.http.post('/api/game/start-timer', {}).subscribe();

// Get Timer
this.http.get('/api/game/timer').subscribe(response => {
  this.formattedTime = response.formatted;
});
```

---

### 6. Bot-Logik

**Frontend:**
```typescript
botMove() {
  const availableCards = this.getCards().filter(card => !card.flipped && !card.matched);
  
  if (this.difficulty === 'Leicht') {
    this.randomBotMove(availableCards);
  } else if (this.difficulty === 'Mittel' || 'Schwer') {
    this.botMemoryMove(availableCards);
  }
}

private randomBotMove(availableCards: any[]) {
  const firstCard = availableCards[Math.floor(Math.random() * availableCards.length)];
  this.flipCard(firstCard);
  
  setTimeout(() => {
    const secondAvailable = this.getCards().filter(card => !card.flipped && !card.matched);
    const secondCard = secondAvailable[Math.floor(Math.random() * secondAvailable.length)];
    this.flipCard(secondCard);
  }, this.delay);
}
```

**Backend (services/bot.py):**
```python
def _random_bot_move(self, available_cards: List[Tuple]) -> Dict:
    first_idx, first_card = random.choice(available_cards)
    self.flip_card(first_idx)
    
    remaining = [c for c in available_cards if c[0] != first_idx]
    if remaining:
        second_idx, second_card = random.choice(remaining)
        self.flip_card(second_idx)
    
    return {
        'type': 'random',
        'first_card': first_idx,
        'second_card': second_idx,
        'is_pair': first_card['id'] == second_card['id']
    }
```

**API Nutzung:**
```typescript
this.http.post('/api/game/bot-move', {}).subscribe(response => {
  this.cards = response.cards;
  this.botPoints = response.bot_points;
  // Update UI based on move
});
```

---

### 7. Bot-Gedächtnis

**Frontend:**
```typescript
private rememberCard(card: any) {
  const maxMemorySize = this.getMaxMemorySize();
  
  if (!card.matched) {
    if (this.botMemory.has(this.getCards().indexOf(card))) return;
    
    if (this.botMemory.size >= maxMemorySize) {
      const firstKey = this.botMemory.keys().next().value;
      if (firstKey !== undefined) {
        this.botMemory.delete(firstKey);
      }
    }
    
    this.botMemory.set(this.getCards().indexOf(card), card.id);
  }
}

private botMemoryMove(availableCards: any[]) {
  let pairs: [number, number] | null = null;
  
  for (const [key1, value1] of this.botMemory) {
    for (const [key2, value2] of this.botMemory) {
      if (key1 !== key2 && value1 === value2) {
        pairs = [key1, key2];
        break;
      }
    }
    if (pairs) break;
  }
  // ... more logic
}
```

**Backend (services/bot.py):**
```python
def remember_card(self, index: int, card_id: int) -> None:
    max_memory = self._get_max_memory_size()
    
    if index in self.memory:
        return
    
    if len(self.memory) >= max_memory:
        oldest_key = next(iter(self.memory))
        del self.memory[oldest_key]
    
    self.memory[index] = card_id

def find_known_pair(self) -> Optional[Tuple[int, int]]:
    memory_items = list(self.memory.items())
    
    for i in range(len(memory_items)):
        for j in range(i + 1, len(memory_items)):
            idx1, card_id1 = memory_items[i]
            idx2, card_id2 = memory_items[j]
            
            if card_id1 == card_id2:
                return (idx1, idx2)
    
    return None
```

**API Nutzung:** Automatisch in `/api/game/bot-move` enthalten

---

### 8. Spielgewinn-Überprüfung

**Frontend:**
```typescript
checkWin() {
  if (this.pairsFound === this.selectedImages.length) {
    this.timerService.stopTimer();
    const finTime = this.timerService.getFormattedTimer();
    const timerank = this.calculateRank(finTime, this.cards.length);
    
    const record = {
      date: new Date().toLocaleString(),
      mode: this.difficulty !== 'None' ? 'Spieler vs. Bot' : 'Spieler vs. Zeit',
      // ... more fields
    };
    
    this.addGameRecord(record);
    return true;
  }
  return false;
}
```

**Backend (API):**
```python
def check_win(self) -> bool:
    if self.pairs_found == len(self.selected_images):
        return True
    return False
```

**API Nutzung:**
```typescript
this.http.post('/api/game/check-win', {}).subscribe(response => {
  if (response.won) {
    // Game won!
    const record = {
      date: new Date().toLocaleString(),
      mode: 'Spieler vs. Zeit',
      rank: response.rank,
      time: response.time,
      // ... more fields
    };
    
    this.http.post('/api/game/save-record', record).subscribe();
  }
});
```

---

### 9. Scoring-System

**Frontend:**
```typescript
private calculateRank(time: string, deckSize: number): string {
  const [minutes, seconds] = time.split(':').map(Number);
  const totalSeconds = minutes * 60 + seconds;

  if (deckSize === 16) {
    if (totalSeconds < 60) return 'A';
    if (totalSeconds < 120) return 'B';
    // ...
  }
  // ... more size checks
}
```

**Backend (services/game.py):**
```python
def calculate_rank(self, time: str, deck_size: int) -> str:
    parts = time.split(':')
    minutes = int(parts[0])
    seconds = int(parts[1])
    total_seconds = minutes * 60 + seconds
    
    if deck_size == 16:
        if total_seconds < 60:
            return 'A'
        elif total_seconds < 120:
            return 'B'
        # ...
    # ... more size checks
```

**API Nutzung:** Automatisch in `/api/game/check-win` enthalten

---

### 10. Spielaufzeichnungen (Scoring-Board)

**Frontend:**
```typescript
private saveScoreboardToCookies() {
  const jsonString = JSON.stringify(this.gameRecords);
  document.cookie = `scoreboard=${encodeURIComponent(jsonString)}; path=/; max-age=31536000`;
}

private loadScoreboardFromCookies(): any[] {
  const cookies = document.cookie.split('; ');
  const scoreboardCookie = cookies.find(row => row.startsWith('scoreboard='));
  if (scoreboardCookie) {
    const jsonString = decodeURIComponent(scoreboardCookie.split('=')[1]);
    return JSON.parse(jsonString);
  }
  return [];
}

private addGameRecord(record: { ... }) {
  this.gameRecords.push(record);
  this.saveScoreboardToCookies();
}
```

**Backend (services/game.py):**
```python
def add_game_record(self, record: Dict) -> None:
    self.game_records.append(record)
    self.save_game_records()

def save_game_records(self) -> None:
    records_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'game_records.json')
    os.makedirs(os.path.dirname(records_file), exist_ok=True)
    
    with open(records_file, 'w', encoding='utf-8') as f:
        json.dump(self.game_records, f, ensure_ascii=False, indent=2)

def load_game_records(self) -> None:
    # Load from JSON file
```

**API Nutzung:**
```typescript
// Save a record
this.http.post('/api/game/save-record', record).subscribe();

// Get all records
this.http.get('/api/game/records').subscribe(response => {
  this.gameRecords = response.records;
});

// Clear records
this.http.delete('/api/game/records').subscribe();
```

---

## Zusammenfassung der Änderungen

| Aspekt | Frontend (Alt) | Backend (Neu) |
|--------|---|---|
| **Spielinitialisierung** | Service Methode | POST `/api/game/initialize` |
| **Kartenmischen** | Service intern | Backend intern |
| **Kartenkarten** | Service + Real-time | POST `/api/game/flip-card` |
| **Paar-Überprüfung** | Service inline | Backend inline (in flip) |
| **Timer** | Service + RxJS | POST/GET `/api/game/timer/*` |
| **Bot-Logik** | Service Methode | POST `/api/game/bot-move` |
| **Bot-Gedächtnis** | Memory Map | Backend Memory Map |
| **Gewinn-Prüfung** | Service Methode | POST `/api/game/check-win` |
| **Ranking** | Service Logik | Backend Logik |
| **Aufzeichnungen** | Cookies (localStorage) | JSON Datei (Backend) |

---

## Performance-Hinweise

1. **Frontend bleibt unverändert**: Die UI wird weiterhin mit der bestehenden Angular-Logik aktualisiert
2. **Netzwerk-Latenzen**: API Aufrufe können 10-100ms dauern. Das sollte berücksichtigt werden
3. **Real-time Updates**: WebSockets könnten für synchrone Updates hilfreich sein (zukünftige Erweiterung)

---

## Nächste Schritte (Optional)

1. **Frontend Integration**: HTTP Aufrufe statt lokale Service-Aufrufe hinzufügen
2. **WebSocket Support**: Für Multiplayer-Modus
3. **Datenbankintegration**: SQLite/PostgreSQL statt JSON
4. **Authentifizierung**: User-Accounts und Leaderboards
5. **API-Dokumentation**: Swagger/OpenAPI ist bereits verfügbar unter `/docs`
