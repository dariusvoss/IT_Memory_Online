import { Injectable, EventEmitter, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TimerService } from './timer.service';
import { SessionService } from './session.service';
import { FinishDialogComponent } from '../finish-dialog/finish-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';

// Card interface for type safety
export interface GameCard {
  id: number;
  image: string;
  flipped: boolean;
  matched: boolean;
}

// Message templates to avoid emoji rendering issues
const WIN_MESSAGES = {
  playerWon: 'Glückwunsch! Du hast gewonnen!',
  botWon: 'Schade! Der Bot hat gewonnen!',
  draw: 'Unentschieden!',
  allPairsFound: 'Glückwunsch! Du hast alle Paare gefunden!'
};

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
  private gameInitialized: boolean = false;
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private difficulty: 'Leicht' | 'Mittel' | 'Schwer' | 'None' = 'Leicht';
  private actionDelay = 800;  // Verzögerung zwischen Aktionen (Bot-Zug, Spielerwechsel)
  private cardVisibilityDuration = 1200;  // Wie lange Karten sichtbar bleiben, bevor sie umgedreht werden
  private lastFlipResponse: any = null;

  private cards: GameCard[] = [];
  private gameRecords: any[] = [];
  private selectedImages: string[] = [];

  // Observable für UI Updates
  private cardsSubject = new BehaviorSubject<GameCard[]>([]);
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
    return of({ success: true });
  }

  private getSelectedSize(selectedSize: number): string {
    switch (selectedSize) {
      case 16:
        return 'Klein (16 Karten)';
      case 36:
        return 'Mittel (36 Karten)';
      case 64:
        return 'Groß (64 Karten)';
      default:
        return `${selectedSize} Karten`;
    }
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
        this.gameInitialized = false;  // Reset the game initialization flag
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

    // Start game on first card flip (only once)
    if (this.selectedCards.length === 1 && !this.gameInitialized) {
      this.gameInitialized = true;  // Mark game as initialized
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
          this.gameInitialized = false;  // Reset flag if start fails
          // Ensure UI and backend stay aligned if game start fails:
          // Revert the first flip and clear selectedCards
          if (this.selectedCards.length > 0) {
            const failedCard = this.selectedCards[0];
            const cardIndex = this.cards.indexOf(failedCard);
            if (cardIndex !== -1) {
              this.cards[cardIndex].flipped = false;
              this.cardsSubject.next([...this.cards]);
            }
            this.selectedCards = [];
          }
          // Ensure game state reflects that game has not started
          this.gameStarted = false;
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
        // DO NOT update bot points here - only update in botMove()
        // The backend doesn't track bot separately, so response.bot_points would reset it to 0

        // Check if two cards are selected
        if (response.selected_cards_count >= 2) {
          setTimeout(() => this.checkMatch(response), this.actionDelay);
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
    console.log('Checking match using flip response:', flipResponse);

    // Use match result from backend
    const isMatch = flipResponse.is_match;

    // Derive affected cards from backend response instead of local selection state
    // Prefer stable identifiers if available, otherwise fall back to positions
    let card1: GameCard | undefined;
    let card2: GameCard | undefined;

    if (flipResponse.card_ids && flipResponse.card_ids.length === 2) {
      const [id1, id2] = flipResponse.card_ids;
      card1 = this.cards.find(c => c.id === id1);
      card2 = this.cards.find(c => c.id === id2);
    } else if (flipResponse.card_positions && flipResponse.card_positions.length === 2) {
      const [pos1, pos2] = flipResponse.card_positions;
      card1 = this.cards[pos1];
      card2 = this.cards[pos2];
    } else if (this.selectedCards && this.selectedCards.length === 2) {
      // Fallback: only use local selection if backend did not provide identifiers/positions
      console.warn('flipResponse missing card identifiers; falling back to selectedCards');
      card1 = this.selectedCards[0];
      card2 = this.selectedCards[1];
    }

    if (!card1 || !card2) {
      console.warn('Unable to resolve affected cards from flipResponse; aborting match handling', {
        flipResponse,
        cardsLength: this.cards?.length,
      });
      return;
    }

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
            setTimeout(() => this.botMove(), this.actionDelay);
          }
        }
      }, this.actionDelay / 2);
    } else {
      // No match - flip cards back after a delay (long enough for player to see)
      setTimeout(() => {
        if (card1 && card2) {
          card1.flipped = false;
          card2.flipped = false;
          this.cardsSubject.next([...this.cards]);
        }

        this.selectedCards = [];
        this.lastFlipResponse = null;

        // Finalize move: tell Backend to flip back cards
        this.sessionService.finalizeMove().subscribe(
          (response: any) => {
            if (response.data) {
              this.cards = response.data.cards;
              this.cardsSubject.next(this.cards);
            }

            // Switch turns for bot mode
            if (this.difficulty !== 'None') {
              this.switchTurn();
            }
          },
          (error: any) => {
            console.error('Error finalizing move:', error);
            // Switch turns anyway so game continues
            if (this.difficulty !== 'None') {
              this.switchTurn();
            }
          }
        );
      }, this.cardVisibilityDuration);
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
          // Use time from backend if available, otherwise use frontend timer
          const finTime = response.time !== undefined 
            ? this.formatSeconds(response.time)
            : this.timerService.getFormattedTimer();

          const record = {
            date: new Date().toLocaleString(),
            mode: this.difficulty !== 'None' ? 'Spieler vs. Bot' : 'Spieler vs. Zeit',
            difficulty_level: this.difficulty !== 'None' ? this.difficulty : '-',
            deck_size: this.getSelectedSize(this.cards.length),
            points: this.difficulty !== 'None' ? `${this.pairsFoundPlayer}` : '-',
            rank: response.rank || '-',
            time: response.time !== undefined ? finTime : this.timerService.getFormattedTimer()
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
              modalRef.componentInstance.message = WIN_MESSAGES.playerWon;
            } else if (this.pairsFoundPlayer < this.pairsFoundBot) {
              modalRef.componentInstance.message = WIN_MESSAGES.botWon;
            } else {
              modalRef.componentInstance.message = WIN_MESSAGES.draw;
            }
          } else {
            modalRef.componentInstance.message = WIN_MESSAGES.allPairsFound;
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
   * Format seconds to MM:SS format
   */
  private formatSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }

  /**
   * Switch turn between player and bot
   */
  private switchTurn(): void {
    this.isPlayerTurn = !this.isPlayerTurn;
    console.log('Switch turn. Player turn now: ', this.isPlayerTurn);

    if (!this.isPlayerTurn && this.difficulty !== 'None') {
      console.log('Bot is taking a turn');
      setTimeout(() => this.botMove(), this.actionDelay);
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
        // Extract bot move details from response.move (not response.is_match!)
        const move = response.move || {};
        const firstCardIdx = move.first_card;
        const secondCardIdx = move.second_card;
        const isBotMatch = move.is_pair || false;

        // Show bot cards flipped sequentially for realistic animation
        const delayBeforeSecondCard = 800; // Animation delay between flips
        
        if (firstCardIdx !== undefined && secondCardIdx !== undefined) {
          // Flip first card immediately
          this.cards[firstCardIdx].flipped = true;
          this.cardsSubject.next([...this.cards]);

          // Flip second card after delay for visual effect
          setTimeout(() => {
            this.cards[secondCardIdx].flipped = true;
            this.cardsSubject.next([...this.cards]);
            }, delayBeforeSecondCard);
        }

        // After cardVisibilityDuration from when second card is flipped
        // This ensures both cards are visible for at least cardVisibilityDuration (1200ms)
        setTimeout(() => {
          if (response.cards) {
            this.cards = response.cards;
            this.cardsSubject.next(this.cards);
          }

          console.log('Bot move executed. Is match:', isBotMatch, '| Player points:', this.pairsFoundPlayer, '| Bot points:', this.pairsFoundBot);

          // Check if bot found a match (use isBotMatch, not response.is_match)
          if (isBotMatch) {
            console.log('Bot found a pair, bot goes again');
            // Update points after successful match
            if (response.player_points) {
              this.pairsFoundPlayer = response.player_points['player1'] || 0;
              this.pairsFoundBot = response.player_points['bot'] || 0;
            }
            // Bot found a pair - bot goes again
            setTimeout(() => {
              this.checkWin();
              // Bot found a pair so goes again
              setTimeout(() => this.botMove(), this.actionDelay);
            }, this.actionDelay / 2);
          } else {
            console.log('Bot did not find a pair, switching to player');
            // No match - finalize move to flip back cards on backend
            this.sessionService.finalizeMove().subscribe(
              (finalizeResponse: any) => {
                if (finalizeResponse.data) {
                  this.cards = finalizeResponse.data.cards;
                  this.cardsSubject.next(this.cards);
                  // Update points from finalized session state
                  if (finalizeResponse.data.player_points) {
                    this.pairsFoundPlayer = finalizeResponse.data.player_points['player1'] || 0;
                    this.pairsFoundBot = finalizeResponse.data.player_points['bot'] || 0;
                  }
                }
                // Switch back to player
                setTimeout(() => {
                  this.switchTurn();
                }, this.actionDelay);
              },
              (error: any) => {
                console.error('Error finalizing bot move:', error);
                // Switch turns anyway
                setTimeout(() => {
                  this.switchTurn();
                }, this.actionDelay);
              }
            );
          }
        }, delayBeforeSecondCard + this.cardVisibilityDuration);
      },
      (error: any) => {
        console.error('Error executing bot move:', error);
        // Restore turn state to player so game remains playable
        this.isPlayerTurn = true;
        console.log('Turn restored to player after bot move failure');
      }
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
    // TODO: Implement using session analysis endpoint
    return of({ records: [] });
  }

  /**
   * Clear all game records
   */
  clearGameRecords(): Observable<any> {
    this.gameRecords = [];
    console.log('Game records cleared');
    return of({ success: true });
  }
}
