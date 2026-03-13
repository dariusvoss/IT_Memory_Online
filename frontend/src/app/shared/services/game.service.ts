import { Injectable, EventEmitter, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TimerService } from './timer.service';
import { SessionService } from './session.service';
import { FinishDialogComponent } from '../../mode-selection/game/board/finish-dialog/finish-dialog.component';
import { BonusEffectDialogComponent } from '../../mode-selection/game/board/bonus-effect-dialog/bonus-effect-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, mergeMap, catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GameRecord } from './game-record.model';

type GameModeType = 'singleplayer_time' | 'singleplayer_ai' | 'multiplayer';

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
  private currentGameMode: GameModeType = 'singleplayer_time';
  private selectedCards: any[] = [];
  private gameInitialized: boolean = false;
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private difficulty: 'Leicht' | 'Mittel' | 'Schwer' | 'None' = 'Leicht';
  private actionDelay = 800;  // Delay between actions (Bot turn, player switch)
  private cardVisibilityDuration = 1200;  // How long cards remain visible before being flipped back
  private lastFlipResponse: any = null;

  private cards: GameCard[] = [];
  private gameRecords: any[] = [];
  private selectedImages: string[] = [];
  private multiplayerPollingInterval: any = null;
  private isProcessingLocalAction: boolean = false;
  private finishDialogShown: boolean = false;
  private bonusEffekt = false;
  private lastSeenBonusTriggerCount = 0;

  // Observable for UI updates
  private cardsSubject = new BehaviorSubject<GameCard[]>([]);
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

  public get gameModeGetter(): GameModeType {
    return this.currentGameMode;
  }

  public get bonusEffektEnabled(): boolean {
    return this.bonusEffekt;
  }

  public setBonusEffekt(enabled: boolean): void {
    this.bonusEffekt = enabled;
  }

  private get localPlayerId(): string {
    return environment.playerId;
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
   * Closes any existing session before creating a new one
   */
  initializeGame(cardCount: number): Observable<any> {
    // Determine game mode based on difficulty
    let gameMode: GameModeType = 'singleplayer_time';
    if (this.difficulty !== 'None') {
      gameMode = 'singleplayer_ai';
    }

    this.currentGameMode = gameMode;

    // If there's an existing session, delete it first before creating a new one
    let deleteObservable: Observable<any>;
    if (this.sessionId) {
      console.log('Existing session found:', this.sessionId, '- Deleting before creating new session');
      deleteObservable = this.sessionService.deleteSession();
    } else {
      // If no existing session, just return an empty observable
      deleteObservable = of(null);
    }

    // Chain: Delete old session → Create new session
    return deleteObservable.pipe(
      mergeMap(() => {
        console.log('Old session deleted, creating new session');
        // Create session with current settings
        return this.sessionService.createSession(
          [this.localPlayerId], // Player ID
          this.difficulty,
          cardCount,
          gameMode,
          this.bonusEffekt
        );
      }),
      catchError((error: any) => {
        console.error('Error during session initialization:', error);
        // If delete fails, still try to create new session
        return this.sessionService.createSession(
          [this.localPlayerId],
          this.difficulty,
          cardCount,
          gameMode,
          this.bonusEffekt
        );
      }),
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
          this.lastSeenBonusTriggerCount = sessionData.bonus_trigger_count || 0;
          this.gameStarted = true;
          this.isPlayerTurn = true;

          console.log('Game initialized with session:', sessionData.session_id);
        }
      })
    );
  }

  /**
   * Initialize GameService state from an existing multiplayer session
   */
  initializeMultiplayerSession(sessionId: string, sessionData?: any): Observable<any> {
    this.currentGameMode = 'multiplayer';
    this.sessionId = sessionId;
    this.sessionService.setCurrentSessionId(sessionId);
    this.timerService.setSessionId(sessionId);

    const sessionStateRequest = sessionData
      ? of({ data: sessionData })
      : this.sessionService.getSessionState();

    return sessionStateRequest.pipe(
      tap((response: any) => {
        const state = response?.data ?? response;
        if (!state) {
          return;
        }

        this.cards = state.cards || [];
        this.cardsSubject.next(this.cards);
        this.selectedCards = [];
        this.lastFlipResponse = null;
        this.gameStarted = true;
        this.gameInitialized = state.status === 'active';
        this.finishDialogShown = false;
        this.lastSeenBonusTriggerCount = state.bonus_trigger_count || 0;
        this.isPlayerTurn = state.current_player
          ? state.current_player === this.localPlayerId
          : true;

        console.log('[Multiplayer Init] Current player:', state.current_player, '| Local player:', this.localPlayerId, '| Is my turn:', this.isPlayerTurn);

        this.updatePointsFromState(state.player_points);

        const uniqueIds = new Set(this.cards.map((c: any) => c.id));
        this.selectedImages = Array.from(uniqueIds);

        // Start polling for multiplayer sessions
        this.startMultiplayerPolling();
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
        if (this.gameModeGetter === 'singleplayer_time') {
          this.timerService.resetTimer();
        }
        this.difficulty = 'Leicht';
        if (this.gameModeGetter === 'multiplayer') {
          this.stopMultiplayerPolling();
        }
        this.currentGameMode = 'singleplayer_time';
        this.finishDialogShown = false;

        console.log('Game reset');
      })
    );
  }

  /**
   * Delete the current session and reset local state.
   * Used when user clicks "Neues Spiel starten" from menu.
   * Gracefully handles 404 errors (session already deleted or doesn't exist).
   */
  deleteSessionAndResetState(): Observable<any> {
    const hasSession = !!this.sessionService.getCurrentSessionId();
    const deleteRequest = hasSession ? this.sessionService.deleteSession() : of(null);

    return deleteRequest.pipe(
      catchError(error => {
        // Gracefully handle 404 or other errors - still reset local state
        console.warn('Error deleting session (may not exist):', error.status);
        return of(null); // Continue with state reset
      }),
      finalize(() => {
        // Always reset local state, regardless of delete success
        this.resetLocalState();

        console.log('Game state reset');
      })
    );
  }

  private resetLocalState(): void {
    this.cards = [];
    this.cardsSubject.next([]);

    this.selectedCards = [];
    this.pairsFound = 0;
    this.pairsFoundPlayer = 0;
    this.pairsFoundBot = 0;
    this.gameStarted = false;
    this.gameInitialized = false;
    this.isPlayerTurn = true;
    if (this.gameModeGetter === 'singleplayer_time') {
      this.timerService.resetTimerLocal();
    }
    this.difficulty = 'Leicht';
    if (this.gameModeGetter === 'multiplayer') {
      this.stopMultiplayerPolling();
    }
    this.finishDialogShown = false;
    this.lastFlipResponse = null;
    this.sessionId = '';
    this.currentGameMode = 'singleplayer_time';
    this.lastSeenBonusTriggerCount = 0;
    console.log('Local game state reset');
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
    // Prevent rapid clicks - exit if action already in progress or 2 cards already selected
    if (this.isProcessingLocalAction || this.selectedCards.length >= 2) {
      console.log('Action already in progress or 2 cards already selected. Ignoring click.');
      return;
    }
    
    this.isProcessingLocalAction = true;
    const cardIndex = this.cards.indexOf(card);

    // Optimistic update - flip immediately
    if (this.selectedCards.length < 2 && !card.flipped && !card.matched) {
      card.flipped = true;
      this.selectedCards.push(card);
      this.cardsSubject.next([...this.cards]);
    }

    // Resume timer if paused during gameplay (Player vs. Time mode)
    if (this.currentGameMode === 'singleplayer_time' && this.gameInitialized && !this.timerService.isTimerRunning) {
      this.timerService.startTimer();
    }

    // Start game on first card flip (only once)
    if (this.currentGameMode === 'singleplayer_time' && this.selectedCards.length === 1 && !this.gameInitialized) {
      this.gameInitialized = true;  // Mark game as initialized
      this.sessionService.startGame().subscribe(
        (response: any) => {
          console.log('Game started successfully');
          // Now start the timer after game is started (for no difficulty mode)
          if (this.currentGameMode === 'singleplayer_time' && !this.timerService.isTimerRunning) {
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

        this.updatePointsFromState(response.player_points);

        // Update turn state for multiplayer
        if (this.currentGameMode === 'multiplayer' && response.current_player) {
          this.isPlayerTurn = response.current_player === this.localPlayerId;
          console.log('[Multiplayer FlipCard] Current player:', response.current_player, '| Local player:', this.localPlayerId, '| Is my turn:', this.isPlayerTurn);
        }

        // Check if two cards are selected
        if (response.selected_cards_count >= 2) {
          if (response.bonus_triggered) {
            this.handleBonusTrigger();
          }
          setTimeout(() => this.checkMatch(response), this.actionDelay);
          console.log('Two cards flipped, checking for match after delay');
        } else {
          this.isProcessingLocalAction = false;
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
          if (!flipResponse.is_player_turn && this.currentGameMode === 'singleplayer_ai') {
            setTimeout(() => this.botMove(), this.actionDelay);
          }
          this.isProcessingLocalAction = false;
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

            // Update turn state for multiplayer
            if (this.currentGameMode === 'multiplayer' && response.data?.current_player) {
              this.isPlayerTurn = response.data.current_player === this.localPlayerId;
              console.log('[Multiplayer FinalizeMove] Current player:', response.data.current_player, '| Local player:', this.localPlayerId, '| Is my turn:', this.isPlayerTurn);
            }

            // Switch turns for bot mode
            if (this.currentGameMode === 'singleplayer_ai') {
              this.switchTurn();
            }
            this.isProcessingLocalAction = false;
          },
          (error: any) => {
            console.error('Error finalizing move:', error);
            // Switch turns anyway so game continues
            if (this.currentGameMode === 'singleplayer_ai') {
              this.switchTurn();
            }
            this.isProcessingLocalAction = false;
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
    if (this.finishDialogShown) {
      return;
    }

    this.sessionService.checkWin().subscribe(
      (response: any) => {
        if (response.won) {
          if (this.finishDialogShown) {
            return;
          }

          this.finishDialogShown = true;
          this.timerService.stopTimer();
          // Use time from backend if available, otherwise use frontend timer
          const finTime = response.time !== undefined
            ? this.formatSeconds(response.time)
            : this.timerService.getFormattedTimer();

          const record: GameRecord = {
            date: new Date().toLocaleString(),
            mode: this.currentGameMode === 'singleplayer_ai' ? 'Spieler vs. Bot' : this.currentGameMode === 'multiplayer' ? 'Multiplayer' : 'Spieler vs. Zeit',
            difficultyLevel: this.currentGameMode === 'singleplayer_ai' ? this.difficulty : '-',
            deckSize: this.getSelectedSize(this.cards.length),
            points: this.currentGameMode === 'singleplayer_time' ? '-' : `${this.pairsFoundPlayer}`,
            rank: this.currentGameMode === 'singleplayer_time' ? (response.rank || '-') : '-',
            time: this.currentGameMode === 'singleplayer_time' ? finTime : '-',
            result: this.calculateGameResult(response)
          };

          // Open finish dialog
          const modalRef = this.modalService.open(FinishDialogComponent, { centered: true });
          modalRef.componentInstance.time = finTime;
          modalRef.componentInstance.rank = response.rank || '-';
          modalRef.componentInstance.playerPoints = this.pairsFoundPlayer;
          modalRef.componentInstance.botPoints = this.pairsFoundBot;
          modalRef.componentInstance.difficulty = this.currentGameMode === 'multiplayer' ? 'multiplayer' : this.difficulty;

          if (this.currentGameMode === 'singleplayer_ai') {
            if (this.pairsFoundPlayer > this.pairsFoundBot) {
              modalRef.componentInstance.message = WIN_MESSAGES.playerWon;
            } else if (this.pairsFoundPlayer < this.pairsFoundBot) {
              modalRef.componentInstance.message = WIN_MESSAGES.botWon;
            } else {
              modalRef.componentInstance.message = WIN_MESSAGES.draw;
            }
          } else if (this.currentGameMode === 'multiplayer') {
            if (response.winner && response.winner === this.localPlayerId) {
              if (response.finish_reason === 'player_left') {
                modalRef.componentInstance.message = 'Glückwunsch! Du hast gewonnen, weil dein Gegner das Spiel verlassen hat!';
              } else {
                modalRef.componentInstance.message = WIN_MESSAGES.playerWon;
              }
            } else if (response.winner && response.winner !== this.localPlayerId) {
              if (response.finish_reason === 'player_left' && response.quitter_id === this.localPlayerId) {
                modalRef.componentInstance.message = 'Du hast das Spiel verlassen.';
              } else {
                modalRef.componentInstance.message = 'Schade! Dein Gegner hat gewonnen!';
              }
            } else {
              modalRef.componentInstance.message = WIN_MESSAGES.draw;
            }
          } else {
            modalRef.componentInstance.message = WIN_MESSAGES.allPairsFound;
          }

          // Save record to local storage (cookies)
          this.addGameRecord(record);

          if (this.currentGameMode === 'multiplayer') {
            this.stopMultiplayerPolling();

            modalRef.result.finally(() => {
              // Acknowledge finish; backend performs multiplayer cleanup when both players acknowledged.
              this.sessionService.acknowledgeFinish(this.localPlayerId).subscribe({
                next: (ackResponse: any) => {
                  console.log('[Multiplayer Finish Ack]', ackResponse);
                  this.resetLocalState();
                  this.gameEnded.emit();
                },
                error: (ackError: any) => {
                  console.error('Error acknowledging multiplayer finish:', ackError);
                  // Even if ack fails, still reset local state
                  this.resetLocalState();
                  this.gameEnded.emit();
                }
              });
            });
          } else {
            this.resetGame().subscribe();
            this.gameEnded.emit();
          }
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
   * Calculate game result based on game mode
   * Returns: "Sieg" | "Niederlage" | "Unentschieden" | "-"
   */
  private calculateGameResult(response: any): string {
    if (this.currentGameMode === 'singleplayer_ai') {
      if (this.pairsFoundPlayer > this.pairsFoundBot) {
        return 'Sieg';
      } else if (this.pairsFoundPlayer < this.pairsFoundBot) {
        return 'Niederlage';
      } else {
        return 'Unentschieden';
      }
    } else if (this.currentGameMode === 'multiplayer') {
      if (response.winner && response.winner === this.localPlayerId) {
        return 'Sieg';
      } else if (response.winner && response.winner !== this.localPlayerId) {
        return 'Niederlage';
      } else {
        return 'Unentschieden';
      }
    } else {
      return '-';
    }
  }

  /**
   * Switch turn between player and bot
   */
  private switchTurn(): void {
    this.isPlayerTurn = !this.isPlayerTurn;
    console.log('Switch turn. Player turn now: ', this.isPlayerTurn);

    if (!this.isPlayerTurn && this.currentGameMode === 'singleplayer_ai') {
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
    if (this.currentGameMode !== 'singleplayer_ai') {
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
        const delayBeforeSecondCard = 800;

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

          if (response.bonus_triggered) {
            this.handleBonusTrigger();
          }

          console.log('Bot move executed. Is match:', isBotMatch, '| Player points:', this.pairsFoundPlayer, '| Bot points:', this.pairsFoundBot);

          // Check if bot found a match (use isBotMatch, not response.is_match)
          if (isBotMatch) {
            console.log('Bot found a pair, bot goes again');
            // Update points after successful match
            this.updatePointsFromState(response.player_points);
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
                  this.updatePointsFromState(finalizeResponse.data.player_points);
                }

                // Update turn state for multiplayer after finalize
                if (this.currentGameMode === 'multiplayer' && finalizeResponse.data.current_player) {
                  this.isPlayerTurn = finalizeResponse.data.current_player === this.localPlayerId;
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

  private updatePointsFromState(playerPoints: { [key: string]: number } | undefined): void {
    if (!playerPoints) {
      return;
    }

    if (this.currentGameMode === 'multiplayer') {
      this.pairsFoundPlayer = playerPoints[this.localPlayerId] || 0;

      const opponentId = Object.keys(playerPoints).find((id) => id !== this.localPlayerId);
      this.pairsFoundBot = opponentId ? playerPoints[opponentId] || 0 : 0;
      return;
    }

    this.pairsFoundPlayer = playerPoints['player1'] || 0;
    this.pairsFoundBot = playerPoints['bot'] || 0;
  }

  //-------------------------------------------------------------------------------------//
  //-------------------------- Multiplayer Syncing (Polling) ---------------------------//
  //-------------------------------------------------------------------------------------//

  /**
   * Start polling session state for multiplayer games
   * This keeps both players in sync by fetching updates from backend
   */
  private startMultiplayerPolling(): void {
    if (this.currentGameMode !== 'multiplayer') {
      return;
    }

    // Stop any existing polling
    this.stopMultiplayerPolling();

    console.log('[Multiplayer Polling] Starting session state polling');

    // Poll every 1 second
    this.multiplayerPollingInterval = setInterval(() => {
      // Don't poll while processing local actions to avoid conflicts
      if (this.isProcessingLocalAction) {
        return;
      }

      this.sessionService.getSessionState().subscribe({
        next: (response: any) => {
          const state = response?.data ?? response;
          if (!state) {
            return;
          }

          // Update cards from server state
          this.cards = state.cards || [];
          this.cardsSubject.next(this.cards);

          // Update turn state
          if (state.current_player) {
            const wasMyTurn = this.isPlayerTurn;
            this.isPlayerTurn = state.current_player === this.localPlayerId;

            if (wasMyTurn !== this.isPlayerTurn) {
              console.log('[Multiplayer Polling] Turn changed! Current player:', state.current_player, '| Is my turn:', this.isPlayerTurn);
            }
          }

          // Update points
          this.updatePointsFromState(state.player_points);

          if (typeof state.bonus_trigger_count === 'number' && state.bonus_trigger_count > this.lastSeenBonusTriggerCount) {
            this.lastSeenBonusTriggerCount = state.bonus_trigger_count;
            this.openBonusEffectDialog();
          }

          // Check if game finished
          if (state.finished) {
            console.log('[Multiplayer Polling] Game finished detected');
            this.stopMultiplayerPolling();
            this.checkWin();
          }
        },
        error: (error: any) => {
          console.error('[Multiplayer Polling] Error fetching session state:', error);
        }
      });
    }, 1000);
  }

  /**
   * Stop multiplayer polling
   */
  private stopMultiplayerPolling(): void {
    if (this.multiplayerPollingInterval) {
      console.log('[Multiplayer Polling] Stopping session state polling');
      clearInterval(this.multiplayerPollingInterval);
      this.multiplayerPollingInterval = null;
    }
  }

  private handleBonusTrigger(): void {
    this.lastSeenBonusTriggerCount += 1;
    this.openBonusEffectDialog();
  }

  private openBonusEffectDialog(): void {
    this.modalService.open(BonusEffectDialogComponent, { centered: true, size: 'sm' });
  }

  /**
   * Public method to stop polling (called from component)
   */
  public stopPolling(): void {
    this.stopMultiplayerPolling();
  }

  //-------------------------------------------------------------------------------------//
  //------------------------------------- Game Records -----------------------------------//
  //-------------------------------------------------------------------------------------//

  /**
   * Load game records from cookie storage
   */
  private loadGameRecords(): void {
    const records = this.loadGameRecordsFromCookie();
    this.gameRecords = records;
    console.log('Game records loaded from cookie:', records);
  }

  /**
   * Add a new game record and save to cookie
   */
  private addGameRecord(record: GameRecord): void {
    this.gameRecords.push(record);
    this.saveGameRecordsToCookie();
    console.log('Game record added:', record);
    console.log('All records:', this.gameRecords);
  }

  /**
   * Save game records to browser cookie
   */
  private saveGameRecordsToCookie(): void {
    try {
      const jsonString = JSON.stringify(this.gameRecords);
      // Encode to make it cookie-safe
      const encodedRecords = encodeURIComponent(jsonString);
      // Set cookie to expire in 1 year
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      document.cookie = `game_records=${encodedRecords}; expires=${expirationDate.toUTCString()}; path=/`;
    } catch (error) {
      console.error('Error saving game records to cookie:', error);
    }
  }

  /**
   * Load game records from browser cookie
   */
  private loadGameRecordsFromCookie(): GameRecord[] {
    try {
      const cookies = document.cookie.split('; ');
      const recordsCookie = cookies.find(row => row.startsWith('game_records='));
      if (recordsCookie) {
        const encodedRecords = recordsCookie.split('=')[1];
        const jsonString = decodeURIComponent(encodedRecords);
        return JSON.parse(jsonString);
      }
    } catch (error) {
      console.error('Error loading game records from cookie:', error);
    }
    return [];
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

