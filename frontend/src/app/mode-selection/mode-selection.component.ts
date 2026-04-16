import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MenuComponent } from './menu/menu.component';
import { environment } from '../../environments/environment';
import { ScoreboardComponent } from './scoreboard/scoreboard.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap/modal';
import { SizeDialogComponent } from './size-dialog/size-dialog.component';
import { GameDialogComponent } from './game/game-dialog.component';
import { MatchFoundDialogComponent } from './match-found-dialog/match-found-dialog.component';
import { BonusModeDialogComponent } from './bonus-mode-dialog/bonus-mode-dialog.component';
import { SessionService } from '../shared/services/session.service';
import { GameService } from '../shared/services/game.service';

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
  bonus_effekt = false;
  readonly showBonusSlideToggle = !environment.useBonusDialogIfSlideOff;
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
  ) {
    this.bonus_effekt = this.gameService.bonusEffektEnabled;
  }

  chooseSize() {
      const modalRef_size = this.modalService.open(SizeDialogComponent, { size: 'md', centered: true });

      modalRef_size.result.then(async (result) => {
        if (result) {
          const selectedBonusMode = await this.chooseBonusMode();
          if (selectedBonusMode === null) {
            return;
          }

          this.bonus_effekt = selectedBonusMode;
          this.gameService.setBonusEffekt(selectedBonusMode);

          this.selectedSize = result;
          this.multiplayerState = 'searching';
          this.http.post(`${environment.apiUrl}/matchmaking/join-queue`, {
            player_id: environment.playerId,
            deck_size: this.selectedSize,
            bonus_effekt: selectedBonusMode
          })
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

  private async chooseBonusMode(): Promise<boolean | null> {
    const modalRef = this.modalService.open(BonusModeDialogComponent, { size: 'md', centered: true });
    try {
      return await modalRef.result;
    } catch {
      return null;
    }
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
          this.showMatchFoundDialog(res.game_session_id, res.opponent, res.match_id);
          // this.openBoardDialog(res.game_session_id, res.session);
        } else if (res.status === 'ready') {
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
          }

          this.openBoardDialog(res.game_session_id, res.session);
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

  toggleBonusEffekt(): void {
    this.bonus_effekt = !this.bonus_effekt;
    this.gameService.setBonusEffekt(this.bonus_effekt);
  }

  private checkMultiplayerState(): void {
    this.http.get(`${environment.apiUrl}/matchmaking/status/${environment.playerId}`).subscribe({
      next: (res: any) => {
        if (res.status === 'matched') {
          this.multiplayerState = 'active';
          this.activeSessionId = res.game_session_id;
          this.activeSessionData = res.session;
          this.showMatchFoundDialog(res.game_session_id, res.opponent, res.match_id);
        } else if (res.status === 'ready') {
          this.openBoardDialog(res.game_session_id, res.session);
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

      this.http.post(`${environment.apiUrl}/matchmaking/leave-queue`, {
        player_id: environment.playerId,
        deck_size: this.selectedSize,
        bonus_effekt: this.bonus_effekt
      })
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

  showMatchFoundDialog(sessionId: string, opponentIds: string[], matchId: string) {
    const modalRef = this.modalService.open(MatchFoundDialogComponent, { centered: true, backdrop: 'static' });
    modalRef.componentInstance.gameSessionId = sessionId;
    modalRef.componentInstance.opponentIds = opponentIds;
    modalRef.componentInstance.matchId = matchId;

    modalRef.componentInstance.acceptClicked.subscribe(() => {
      this.acceptMatch(matchId, sessionId, modalRef);
    });

    modalRef.componentInstance.declineClicked.subscribe(() => {
      modalRef.close({ action: 'declined', matchId });
    });

    let dialogHandled = false;
    const statusWatcher = setInterval(() => {
      this.http.get(`${environment.apiUrl}/matchmaking/status/${environment.playerId}`).subscribe({
        next: (res: any) => {
          if (dialogHandled) {
            return;
          }

          const isCurrentMatch = (res.status === 'matched' || res.status === 'ready') && res.match_id === matchId;
          if (!isCurrentMatch) {
            dialogHandled = true;
            modalRef.close({ action: 'match-invalidated', status: res.status });
            return;
          }

          if (res.both_accepted) {
            dialogHandled = true;
            modalRef.close({
              action: 'both-accepted',
              gameSessionId: res.game_session_id,
              session: res.session
            });
            return;
          }

          // If this player already accepted, keep waiting state visible
          if (res.player_accepted) {
            modalRef.componentInstance.waitingForOtherPlayer = true;
          }
        },
        error: (err) => {
          console.error('Error watching match status:', err);
        }
      });
    }, 1500);

    modalRef.result.then((result) => {
      dialogHandled = true;
      clearInterval(statusWatcher);

      if (result.action === 'both-accepted') {
        this.openBoardDialog(result.gameSessionId, result.session);
      } else if (result.action === 'declined') {
        // Reject the match
        this.rejectMatch(result.matchId);
      } else if (result.action === 'match-invalidated') {
        this.activeSessionId = null;
        this.activeSessionData = null;

        if (result.status === 'waiting') {
          this.multiplayerState = 'searching';
          this.startMatchmakingPolling(environment.playerId);
        } else {
          this.multiplayerState = 'idle';
        }
      }
    }).catch((error) => {
      dialogHandled = true;
      clearInterval(statusWatcher);

      // Dialog was closed without action
      console.log('Match dialog closed:', error);
    });
  }

  private acceptMatch(matchId: string, sessionId: string, modalRef: any) {
    this.http.post(`${environment.apiUrl}/matchmaking/accept-match/${matchId}`, {
      player_id: environment.playerId
    }).subscribe({
      next: (res: any) => {
        if (res.status === 'ready' && res.both_accepted) {
          modalRef.close({
            action: 'both-accepted',
            gameSessionId: sessionId,
            session: res.session
          });
          return;
        }

        // waiting_for_other
        modalRef.componentInstance.waitingForOtherPlayer = true;
      },
      error: (err) => {
        console.error('Error accepting match:', err);
        modalRef.componentInstance.waitingForOtherPlayer = false;
      }
    });
  }

  private rejectMatch(matchId: string) {
    this.http.post(`${environment.apiUrl}/matchmaking/reject-match/${matchId}`, {
      player_id: environment.playerId
    }).subscribe({
      next: (res: any) => {
        console.log('[Matchmaking] Match rejected:', res);
        // Reset state and go back to idle
        this.clearActiveMultiplayerState();
        this.multiplayerState = 'idle';
      },
      error: (err) => {
        console.error('Error rejecting match:', err);
        this.clearActiveMultiplayerState();
        this.multiplayerState = 'idle';
      }
    });
  }
}
