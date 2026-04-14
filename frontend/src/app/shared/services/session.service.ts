import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface GameSessionState {
  session_id: string;
  status: string;
  game_mode: string;
  difficulty: string;
  board_size: number;
  cards: any[];
  player_points: { [key: string]: number };
  pairs_found: number;
  current_player: string;
  finished: boolean;
  winner?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/session`;
  
  private sessionIdSubject = new BehaviorSubject<string | null>(null);
  public sessionId$ = this.sessionIdSubject.asObservable();
  
  private sessionStateSubject = new BehaviorSubject<GameSessionState | null>(null);
  public sessionState$ = this.sessionStateSubject.asObservable();
  
  private currentSessionId: string | null = null;

  /**
   * Create a new game session
   */
  createSession(
    playerIds: string[],
    difficulty: string,
    boardSize: number,
    gameMode: string = 'singleplayer_time',
    bonusEffekt: boolean = false
  ): Observable<any> {
    const request = {
      player_ids: playerIds,
      difficulty: difficulty,
      board_size: boardSize,
      game_mode: gameMode,
      bonus_effekt: bonusEffekt
    };

    return this.http.post(`${this.apiUrl}/create`, request).pipe(
      tap((response: any) => {
        const sessionId = response.session_id;
        const state = response.data;
        if (sessionId) {
          this.currentSessionId = sessionId;
          this.sessionIdSubject.next(sessionId);
          if (state) {
            this.sessionStateSubject.next(state);
          }
          console.log('Session created:', this.currentSessionId);
        }
      })
    );
  }

  /**
   * Get current session state
   */
  getSessionState(): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.get(`${this.apiUrl}/${this.currentSessionId}`, {
      params: { player_id: environment.playerId }
    }).pipe(
      tap((response: any) => {
        if (response.data) {
          this.sessionStateSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Start the game
   */
  startGame(): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/start`, {}).pipe(
      tap((response: any) => {
        console.log('Game started:', this.currentSessionId);
      })
    );
  }

  /**
   * Flip a card
   */
  flipCard(cardIndex: number): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/flip-card`, {
      card_index: cardIndex,
      player_id: environment.playerId
    }).pipe(
      tap((response: any) => {
        if (response.data) {
          this.sessionStateSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Check for match
   */
  checkMatch(): Observable<any> {
    // Note: check_match is integrated in flip-card response
    // This method exists for consistency
    const state = this.sessionStateSubject.value;
    return new Observable(observer => {
      observer.next(state);
      observer.complete();
    });
  }

  /**
   * Execute bot move
   */
  botMove(): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/bot-move`, {}).pipe(
      tap((response: any) => {
        if (response.data) {
          this.sessionStateSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Check win condition
   */
  checkWin(): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/check-win`, {}).pipe(
      tap((response: any) => {
        console.log('Win check:', response);
      })
    );
  }

  /**
   * Finalize move: flip back unmatched cards and update state
   * Called by Frontend after cardVisibilityDuration (1200ms)
   */
  finalizeMove(): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/finalize-move`, {
      player_id: environment.playerId
    }).pipe(
      tap((response: any) => {
        if (response.data) {
          this.sessionStateSubject.next(response.data);
        }
        console.log('Move finalized');
      })
    );
  }

  triggerBonusEffect(effectId?: string): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/bonus/trigger`, {
      player_id: environment.playerId,
      effect_id: effectId
    }).pipe(
      tap((response: any) => {
        if (response.data) {
          this.sessionStateSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Reset game session
   */
  resetSession(): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/reset`, {}).pipe(
      tap((response: any) => {
        console.log('Session reset:', this.currentSessionId);
      })
    );
  }

  /**
   * Delete/close session
   */
  deleteSession(): Observable<any> {
    if (!this.currentSessionId) {
      return new Observable(observer => {
        observer.next(null);
        observer.complete();
      });
    }

    const sessionId = this.currentSessionId;
    return this.http.delete(`${this.apiUrl}/${sessionId}`).pipe(
      tap((response: any) => {
        this.currentSessionId = null;
        this.sessionIdSubject.next(null);
        this.sessionStateSubject.next(null);
        console.log('Session deleted:', sessionId);
      }),
      catchError((error) => {
        console.error('Error deleting session:', error);
        throw error;
      })
    );
  }

  /**
   * Acknowledge that player has seen finish dialog.
   * Backend cleans multiplayer session/match when both players acknowledged.
   */
  acknowledgeFinish(playerId: string): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/finish-ack`, {
      player_id: playerId
    });
  }

  /**
   * Leave an active multiplayer session.
   */
  leaveSession(playerId: string): Observable<any> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    return this.http.post(`${this.apiUrl}/${this.currentSessionId}/leave`, {
      player_id: playerId
    });
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set session ID (for resuming sessions)
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.sessionIdSubject.next(sessionId);
  }

  /**
   * Get current session state (synchronous)
   */
  getCurrentSessionState(): GameSessionState | null {
    return this.sessionStateSubject.value;
  }
}
