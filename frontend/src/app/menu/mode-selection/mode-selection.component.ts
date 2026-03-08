import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MenuComponent } from '../menu.component';
import { environment } from '../../../environments/environment';
import { ScoreboardComponent } from '../scoreboard/scoreboard.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap/modal';
import { SizeDialogComponent } from '../size-dialog/size-dialog.component';
import { GameDialogComponent } from '../size-dialog/game-dialog/game-dialog.component';
import { MatchFoundDialogComponent } from './match-found-dialog/match-found-dialog.component';
import { SessionService } from '../size-dialog/game-dialog/board/services/session.service';
import { GameService } from '../size-dialog/game-dialog/board/services/game.service';

@Component({
  selector: 'app-mode-selection',
  standalone: true,
  imports: [CommonModule, MenuComponent],
  templateUrl: './mode-selection.component.html',
  styleUrl: './mode-selection.component.css'
})
export class GameModeSelectionComponent {
  selectedMode: 'none' | 'singleplayer' | 'multiplayer' = 'none';
  multiplayerState: 'idle' | 'searching' | 'active' = 'idle';
  private selectedSize: number = -1; // Standard size
  pollingInterval: ReturnType<typeof setInterval> | undefined;
  activeSessionId: string | null = null;
  activeSessionData: any = null;
  private gameService = inject(GameService);

  @Output() selectedModeChange = new EventEmitter<'none' | 'singleplayer' | 'multiplayer'>();

  constructor(
    private http: HttpClient,
    private modalService: NgbModal,
    private sessionService: SessionService
  ) {}

  chooseSize() {
      const modalRef_size = this.modalService.open(SizeDialogComponent, { size: 'md', centered: true });

      modalRef_size.result.then((result) => {
        if (result) {
          this.selectedSize = result;
          this.multiplayerState = 'searching';
          this.http.post(`${environment.apiUrl}/matchmaking/join-queue`, { player_id: environment.playerId, deck_size: this.selectedSize })
        .subscribe({
          next: response => console.log('Player joined queue response:', response),
          error: err => console.error('Error joining queue:', err)
        });
          // this.openGameDialog(mode);
          this.startMatchmakingPolling(environment.playerId);
        }
      }).catch((error) => {
        // this.chooseSize();
        console.log('SizeDialog dismissed');
      });
    }

  startMatchmakingPolling(playerId: string) {
    console.log('[Matchmaking] Starting polling for player:', playerId);
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this.http.get(`${environment.apiUrl}/matchmaking/status/${playerId}`).subscribe((res: any) => {
        if (res.status === 'matched') {
          console.log('[Matchmaking] Match found! Session:', res.session);
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
          }

          this.multiplayerState = 'active';
          this.activeSessionId = res.game_session_id;
          this.activeSessionData = res.session;

          // Show Match-Found dialog
          this.showMatchFoundDialog(res.game_session_id, res.opponent);
          // this.openBoardDialog(res.game_session_id, res.session);
        } else if (res.status === 'waiting') {
          this.multiplayerState = 'searching';
        } else if (res.status === 'not_in_queue') {
          this.multiplayerState = 'idle';
        }
      });
    }, 2000);
  }

  openBoardDialog(sessionId: string, sessionData?: any) {
    this.multiplayerState = 'active';
    this.activeSessionId = sessionId;
    this.activeSessionData = sessionData;
    this.sessionService.setCurrentSessionId(sessionId);

    const modalRef = this.modalService.open(GameDialogComponent, { size: 'xl', centered: true });
    modalRef.componentInstance.mode = 'PvP';
    modalRef.componentInstance.sessionId = sessionId;
    modalRef.componentInstance.sessionData = sessionData;

    modalRef.result.then((result) => {
      this.handleGameDialogClosed(result);
    }).catch((result) => {
      this.handleGameDialogClosed(result);
    });
  }

  private handleGameDialogClosed(result: any): void {
    if (result === 'game-ended') {
      this.clearActiveMultiplayerState();
      this.selectedMode = 'none';
      this.selectedModeChange.emit(this.selectedMode);
      return;
    }

    if (this.selectedMode === 'multiplayer' && this.activeSessionId) {
      this.multiplayerState = 'active';
    }
  }

  selectSingleplayer(): void {
    this.clearActiveMultiplayerState();
    // Also reset GameService state to clear any remaining game board from previous multiplayer session
    this.gameService.deleteSessionAndResetState().subscribe(
      () => console.log('GameService reset for singleplayer mode'),
      error => console.error('Error resetting game service:', error)
    );
    this.selectedMode = 'singleplayer';
    this.selectedModeChange.emit(this.selectedMode);
  }

  selectMultiplayer(): void {
    this.selectedMode = 'multiplayer';
    this.selectedModeChange.emit(this.selectedMode);
    this.checkMultiplayerState();
  }

  private checkMultiplayerState(): void {
    this.http.get(`${environment.apiUrl}/matchmaking/status/${environment.playerId}`).subscribe({
      next: (res: any) => {
        if (res.status === 'matched') {
          this.multiplayerState = 'active';
          this.activeSessionId = res.game_session_id;
          this.activeSessionData = res.session;
        } else if (res.status === 'waiting') {
          this.multiplayerState = 'searching';
          this.startMatchmakingPolling(environment.playerId);
        } else {
          this.multiplayerState = 'idle';
          this.chooseSize();
        }
      },
      error: (err) => {
        console.error('Error checking multiplayer status:', err);
        this.multiplayerState = 'idle';
        this.chooseSize();
      }
    });
  }

  leaveActiveGame(): void {
    if (!this.activeSessionId) {
      return;
    }

    this.sessionService.setCurrentSessionId(this.activeSessionId);
    this.sessionService.leaveSession(environment.playerId).subscribe({
      next: (response) => {
        console.log('Left active multiplayer game:', response);
        this.clearActiveMultiplayerState();
        this.selectedMode = 'none';
        this.selectedModeChange.emit(this.selectedMode);
      },
      error: (err) => {
        console.error('Error leaving active multiplayer game:', err);
      }
    });
  }

  goBack(): void {
    if (this.selectedMode === 'multiplayer' && this.multiplayerState === 'searching') {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }

      this.http.post(`${environment.apiUrl}/matchmaking/leave-queue`, { player_id: environment.playerId, deck_size: this.selectedSize })
      .subscribe({
        next: response => {console.log('Player left queue response:', response); this.selectedSize = -1;},
        error: err => console.error('Error leaving queue:', err)
      });
    }

    this.selectedMode = 'none';
    this.selectedModeChange.emit(this.selectedMode);
  }

  private clearActiveMultiplayerState(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.multiplayerState = 'idle';
    this.activeSessionId = null;
    this.activeSessionData = null;
    this.selectedSize = -1;
  }

  openScoreboard(): void {
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }

  showMatchFoundDialog(sessionId: string, opponentId: string) {
    const modalRef = this.modalService.open(MatchFoundDialogComponent, { centered: true, backdrop: 'static' });
    modalRef.componentInstance.gameSessionId = sessionId;
    modalRef.componentInstance.opponentName = opponentId;

    modalRef.result.then((result) => {
      if (result) {
        // Join the game session and open the game dialog
        this.openBoardDialog(result);
      }
    }).catch((error) => {
      // Dialog was declined
      console.log('Match declined');
    });
  }
}
