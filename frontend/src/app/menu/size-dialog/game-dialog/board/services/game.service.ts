import { Injectable, EventEmitter, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TimerService } from './timer.service';
import { SessionService } from './session.service';
import { FinishDialogComponent } from '../finish-dialog/finish-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/game`;
  private sessionService = inject(SessionService);

  isPlayerTurn: boolean = true;
  gameStarted: boolean = false;
  gameEnded: EventEmitter<void> = new EventEmitter<void>();

  private sessionId: string = '';
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
    // Difficulty is set when creating the session, not as separate API call
    return new Observable(observer => {
      observer.next({ success: true });
      observer.complete();
    });
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
   * Creates a session and starts the game
   */
  initializeGame(cardCount: number): Observable<any> {
    // Determine game mode based on difficulty
    let gameMode = 'singleplayer_time';
    if (this.difficulty !== 'None') {
      gameMode = 'singleplayer_ai';
    }

    // Create session with current settings
    return this.sessionService.createSession(
      ['player1'], // Player ID
      this.difficulty,
      cardCount,
      gameMode
    ).pipe(
      tap((response: any) => {
        if (response.data) {
          const sessionData = response.data;
          this.sessionId = sessionData.session_id;
          this.timerService.setSessionId(this.sessionId);

          this.cards = sessionData.cards || [];
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

          console.log('Game initialized with session:', sessionData.session_id);
        }
      })
    );
  }

  /**
   * Reset the game to initial state
   */
  resetGame(): Observable<any> {
    return this.sessionService.resetSession().pipe(
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
   * Uses session service and handles response
   */
  flipCard(card: any): void {
    const cardIndex = this.cards.indexOf(card);

    // Optimistic update - flip immediately
    if (this.selectedCards.length < 2 && !card.flipped && !card.matched) {
      card.flipped = true;
      this.selectedCards.push(card);
      this.cardsSubject.next([...this.cards]);
    }

    // Start game on first card flip
    if (this.selectedCards.length === 1) {
      this.sessionService.startGame().subscribe(
        (response: any) => {
          console.log('Game started successfully');
          // Now start the timer after game is started (for no difficulty mode)
          if (this.difficulty === 'None' && !this.timerService.isTimerRunning) {
            this.timerService.startTimer();
          }
        },
        (error: any) => {
          console.error('Error starting game:', error);
        }
      );
    }

    // Call backend
    this.sessionService.flipCard(cardIndex).subscribe(
      (response: any) => {
        // Store response for checkMatch
        this.lastFlipResponse = response;

        // Update local state from response
        if (response.cards) {
          this.cards = response.cards;
          this.cardsSubject.next(this.cards);
        }

        if (response.player_points) {
          this.pairsFoundPlayer = response.player_points['player1'] || 0;
        }
        if (response.bot_points !== undefined) {
          this.pairsFoundBot = response.bot_points;
        }

        // Check if two cards are selected
        if (response.selected_cards_count >= 2) {
          setTimeout(() => this.checkMatch(response), this.delay);
          console.log('Two cards flipped, checking for match after delay');
        }
        console.log('Card flipped:', cardIndex, 'Response:', response);
      },
      (error: any) => {
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
   * Uses match result from backend response
   */
  private checkMatch(response?: any): void {
    if (!response && !this.lastFlipResponse) {
      console.error('No flip response available');
      return;
    }

    const flipResponse = response || this.lastFlipResponse;
    console.log('Checking match for selected cards:', this.selectedCards);

    // Use match result from backend
    const isMatch = flipResponse.is_match;
    const card1 = this.selectedCards[0];
    const card2 = this.selectedCards[1];

    if (isMatch) {
      // Match - cards stay flipped (backend marked them as matched)
      this.pairsFound++;
      this.selectedCards = [];
      this.lastFlipResponse = null;

      setTimeout(() => {
        // Check if game is won after a successful match
        this.checkWin();

        if (this.gameStarted) {
          // If bot's turn after successful match
          if (!flipResponse.is_player_turn && this.difficulty !== 'None') {
            setTimeout(() => this.botMove(), this.delay);
          }
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
   * Sends request to backend and handles win condition
   */
  checkWin(): void {
    this.sessionService.checkWin().subscribe(
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
            rank: response.rank || '-',
            time: response.time || finTime
          };

          // Open finish dialog
          const modalRef = this.modalService.open(FinishDialogComponent, { centered: true });
          modalRef.componentInstance.time = finTime;
          modalRef.componentInstance.rank = response.rank || '-';
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

          // Save record (optional - implement if needed)
          // this.http.post(`${this.apiUrl}/save-record`, record).subscribe();

          this.resetGame().subscribe();
          this.gameEnded.emit();
        }
      },
      (error: any) => {
        console.error('Error checking win:', error);
      }
    );
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

    this.sessionService.botMove().subscribe(
      (response: any) => {
        // Update game state from response
        if (response.cards) {
          this.cards = response.cards;
          this.cardsSubject.next(this.cards);
        }

        if (response.player_points) {
          this.pairsFoundBot = response.player_points['bot'] || response.player_points['player2'] || 0;
        }

        console.log('Bot move executed');

        // Check if bot found a match
        if (response.is_match) {
          console.log('Bot found a pair, bot goes again');
          // Bot found a pair - bot goes again
          setTimeout(() => {
            this.checkWin();
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
      (error: any) => console.error('Error executing bot move:', error)
    );
  }

  //-------------------------------------------------------------------------------------//
  //------------------------------------- Game Records -----------------------------------//
  //-------------------------------------------------------------------------------------//

  /**
   * Load game records from backend
   * TODO: Implement using new analysis endpoint
   */
  private loadGameRecords(): void {
    // Records functionality to be integrated with new backend analysis endpoint
    this.gameRecords = [];
    console.log('Game records to be loaded from backend analysis');
  }

  /**
   * Request to load game records (for manual refresh)
   */
  refreshGameRecords(): Observable<any> {
    return new Observable(observer => {
      // TODO: Implement using session analysis endpoint
      observer.next({ records: [] });
      observer.complete();
    });
  }

  /**
   * Clear all game records
   */
  clearGameRecords(): Observable<any> {
    return new Observable(observer => {
      this.gameRecords = [];
      console.log('Game records cleared');
      observer.next({ success: true });
      observer.complete();
    });
  }
}
