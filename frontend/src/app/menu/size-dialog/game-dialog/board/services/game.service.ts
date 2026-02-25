import { Injectable, EventEmitter, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TimerService } from './timer.service';
import { FinishDialogComponent } from '../finish-dialog/finish-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private http = inject(HttpClient);
  private apiUrl = 'http://memory.ipv64.de:8000/api/game';

  isPlayerTurn: boolean = true;
  gameStarted: boolean = false;
  gameEnded: EventEmitter<void> = new EventEmitter<void>();


  private selectedCards: any[] = [];
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private difficulty: 'Leicht' | 'Mittel' | 'Schwer' | 'None' = 'Leicht';
  private deckSize: string = '';
  private delay = 800;
  private visibleDelay = 500;
  private lastFlipResponse: any = null;

  private cards: { id: number; image: string; flipped: boolean; matched: boolean }[] = [];
  private gameRecords: any[] = [];
  private selectedImages: string[] = [];

  // Observable für UI Updates
  private cardsSubject = new BehaviorSubject<any[]>([]);
  public cards$ = this.cardsSubject.asObservable();

  private gameStateSubject = new BehaviorSubject<any>(null);
  public gameState$ = this.gameStateSubject.asObservable();

  constructor(private timerService: TimerService, private modalService: NgbModal) {
    console.log('GameService initialized');
    this.loadGameRecords();
  }




  // ========================= Getter/Setter =========================

  public get pairsFoundPlayerGetter(): number {
    return this.pairsFoundPlayer;
  }

  public get pairsFoundBotGetter(): number {
    return this.pairsFoundBot;
  }

  public get difficultyGetter(): string {
    return this.difficulty;
  }

  public setDifficulty(level: 'Leicht' | 'Mittel' | 'Schwer' | 'None') {
    this.difficulty = level;
    return this.http.post(`${this.apiUrl}/set-difficulty?difficulty=${level}`, {}).pipe(
      tap(response => {
        console.log('Difficulty set to:', level);
      })
    );
  }

  private getSelectedSize(selectedSize: number): string {
    if (selectedSize === 16) {
      this.deckSize = 'Klein (16 Karten)';
    } else if (selectedSize === 36) {
      this.deckSize = 'Mittel (36 Karten)';
    } else if (selectedSize === 64) {
      this.deckSize = 'Groß (64 Karten)';
    }
    return this.deckSize;
  }

  public getGameRecords() {
    return this.gameRecords;
  }

  //-------------------------------------------------------------------------------------//
  //----------------------------------- Game Logic -----------------------------------//
  //-------------------------------------------------------------------------------------//

  /**
   * Initialize a new game with the specified card count
   * Makes API call to backend and updates local state
   */
  initializeGame(cardCount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/initialize`, { card_count: cardCount }).pipe(
      tap((response: any) => {
        this.cards = response.cards;
        this.cardsSubject.next(this.cards);

        // Extract selected images from cards for win condition
        const uniqueIds = new Set(this.cards.map((c: any) => c.id));
        this.selectedImages = Array.from(uniqueIds);

        this.selectedCards = [];
        this.pairsFound = 0;
        this.pairsFoundPlayer = 0;
        this.pairsFoundBot = 0;
        this.gameStarted = true;
        this.isPlayerTurn = true;

        console.log('Game initialized:', cardCount, 'cards');
      })
    );
  }

  /**
   * Reset the game to initial state
   */
  resetGame(): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset`, {}).pipe(
      tap((response: any) => {
        this.cards.forEach(card => {
          card.flipped = false;
          card.matched = false;
        });
        this.cardsSubject.next(this.cards);

        this.selectedCards = [];
        this.pairsFound = 0;
        this.pairsFoundPlayer = 0;
        this.pairsFoundBot = 0;
        this.gameStarted = false;
        this.isPlayerTurn = true;
        this.timerService.resetTimer();
        this.difficulty = 'Leicht';

        console.log('Game reset');
      })
    );
  }

  /**
   * Get the current cards
   * Returns local copy (synced via flipCard and initialize)
   */
  getCards(): any[] {
    return this.cards;
  }

  /**
   * Flip a card at the given index
   * Makes API call to backend and updates local state
   */
  flipCard(card: any): void {
    const cardIndex = this.cards.indexOf(card);

    // Optimistic update - flip immediately
    if (this.selectedCards.length < 2 && !card.flipped && !card.matched) {
      card.flipped = true;
      this.selectedCards.push(card);
      this.cardsSubject.next([...this.cards]);
      console.log('test');
    }

    // Call backend
    this.http.post(`${this.apiUrl}/flip-card`, { card_id: cardIndex }).subscribe(
      (response: any) => {
        // Store response for checkMatch
        this.lastFlipResponse = response;

        // Update local state from response
        this.cards = response.cards;
        this.pairsFoundPlayer = response.player_points;
        this.pairsFoundBot = response.bot_points;
        this.isPlayerTurn = response.is_player_turn;
        this.cardsSubject.next(this.cards);

        // Check if two cards are selected
        if (response.selected_cards_count < 1) {
          setTimeout(() => this.checkMatch(), this.delay);
          console.log('Two cards flipped, checking for match after delay');
        }
        console.log('selectedCards', this.selectedCards.length,'Card flipped:', cardIndex, 'Response:', response);
      },
      error => {
        console.error('Error flipping card:', error);
        // Revert optimistic update on error
        card.flipped = false;
        const index = this.selectedCards.indexOf(card);
        if (index > -1) {
          this.selectedCards.splice(index, 1);
        }
        this.cardsSubject.next([...this.cards]);
      }
    );
  }

  /**
   * Check if the two selected cards match
   * This is called after backend processes the flip
   */
  private checkMatch(): void {
    if (!this.lastFlipResponse) {
      console.error('No flip response available');
      return;
    }
    console.log('Checking match for selected cards:', this.selectedCards);
    // Use match result from backend, not local comparison
    const isMatch = this.lastFlipResponse.match_result;
    const card1 = this.selectedCards[0];
    const card2 = this.selectedCards[1];

    if (isMatch) {
      // Match - cards stay flipped (backend marked them as matched)
      this.pairsFound++;
      this.selectedCards = [];
      this.lastFlipResponse = null;

      setTimeout(() => {
        if (this.checkWin()) return;

        // If bot's turn after successful match
        if (!this.isPlayerTurn && this.difficulty !== 'None') {
          setTimeout(() => this.botMove(), this.delay);
        }
      }, this.delay / 2);
    } else {
      // No match - flip cards back after a delay
      setTimeout(() => {
        if (card1 && card2) {
          card1.flipped = false;
          card2.flipped = false;
          this.cardsSubject.next([...this.cards]);
        }

        this.selectedCards = [];
        this.lastFlipResponse = null;

        // Switch turns for bot mode
        if (this.difficulty !== 'None') {
          this.switchTurn();
        }
      }, this.visibleDelay);
    }
  }

  /**
   * Check if the game is won
   */
  checkWin(): boolean {
    this.http.post(`${this.apiUrl}/check-win`, {}).subscribe(
      (response: any) => {
        if (response.won) {
          this.timerService.stopTimer();
          const finTime = this.timerService.getFormattedTimer();

          const record = {
            date: new Date().toLocaleString(),
            mode: this.difficulty !== 'None' ? 'Spieler vs. Bot' : 'Spieler vs. Zeit',
            difficulty_level: this.difficulty !== 'None' ? this.difficulty : '-',
            deck_size: this.getSelectedSize(this.cards.length),
            points: this.difficulty !== 'None' ? `${this.pairsFoundPlayer}` : '-',
            rank: response.rank,
            time: response.time
          };

          // Open finish dialog
          const modalRef = this.modalService.open(FinishDialogComponent, { centered: true });
          modalRef.componentInstance.time = finTime;
          modalRef.componentInstance.rank = response.rank;
          modalRef.componentInstance.playerPoints = this.pairsFoundPlayer;
          modalRef.componentInstance.botPoints = this.pairsFoundBot;
          modalRef.componentInstance.difficulty = this.difficulty;

          if (this.difficulty !== 'None') {
            if (this.pairsFoundPlayer > this.pairsFoundBot) {
              modalRef.componentInstance.message = '🎉 Glückwunsch! Du hast gewonnen!';
            } else if (this.pairsFoundPlayer < this.pairsFoundBot) {
              modalRef.componentInstance.message = '😢 Schade! Der Bot hat gewonnen!';
            } else {
              modalRef.componentInstance.message = '😐 Unentschieden!';
            }
          } else {
            modalRef.componentInstance.message = '🎉 Glückwunsch! Du hast alle Paare gefunden!';
          }

          // Save record
          this.http.post(`${this.apiUrl}/save-record`, record).subscribe(
            () => console.log('Record saved'),
            error => console.error('Error saving record:', error)
          );

          this.resetGame().subscribe();
          this.gameEnded.emit();
          return true;
        }
        return false;
      }
    );
    return false;
  }

  /**
   * Switch turn between player and bot
   */
  private switchTurn(): void {
    this.isPlayerTurn = !this.isPlayerTurn;
    console.log('Switch turn. Player turn now: ', this.isPlayerTurn);

    if (!this.isPlayerTurn && this.difficulty !== 'None') {
      console.log('Bot is taking a turn');
      setTimeout(() => this.botMove(), this.delay);
    } else {
      console.log('Player is now playing');
    }
  }

  //-------------------------------------------------------------------------------------//
  //------------------------------------- Bot Logic -----------------------------------//
  //-------------------------------------------------------------------------------------//

  /**
   * Get bot's next move from backend
   */
  botMove(): void {
    if (this.difficulty === 'None') {
      this.isPlayerTurn = true;
      return;
    }

    this.http.post(`${this.apiUrl}/bot-move`, {}).subscribe(
      (response: any) => {
        // Update game state from response
        this.cards = response.cards;
        this.cardsSubject.next(this.cards);
        this.pairsFoundBot = response.bot_points;

        console.log('Bot move:', response.move);

        // Check if bot found a match
        if (response.match_result) {
          console.log('Bot found a pair, bot goes again');
          // Bot found a pair - bot goes again
          setTimeout(() => {
            if (this.checkWin()) return;
            // Bot found a pair so goes again
            setTimeout(() => this.botMove(), this.delay);
          }, this.delay / 2);
        } else {
          console.log('Bot did not find a pair, switching to player');
          // No match - switch back to player
          setTimeout(() => {
            this.switchTurn();
          }, this.visibleDelay);
        }
      },
      error => console.error('Error executing bot move:', error)
    );
  }

  //-------------------------------------------------------------------------------------//
  //------------------------------------- Game Records -----------------------------------//
  //-------------------------------------------------------------------------------------//

  /**
   * Load game records from backend
   */
  private loadGameRecords(): void {
    this.http.get(`${this.apiUrl}/records`).subscribe(
      (response: any) => {
        this.gameRecords = response.records || [];
        console.log('Game records loaded:', this.gameRecords.length);
      },
      error => {
        console.error('Error loading game records:', error);
        this.gameRecords = [];
      }
    );
  }

  /**
   * Request to load game records (for manual refresh)
   */
  refreshGameRecords(): Observable<any> {
    return this.http.get(`${this.apiUrl}/records`).pipe(
      tap((response: any) => {
        this.gameRecords = response.records || [];
      })
    );
  }

  /**
   * Clear all game records
   */
  clearGameRecords(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/records`).pipe(
      tap((): void => {
        this.gameRecords = [];
        console.log('Game records cleared');
      })
    );
  }
}
