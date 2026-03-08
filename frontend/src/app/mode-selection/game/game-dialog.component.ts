import { Component, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BoardComponent } from './board/board.component';
import { GameService } from '../../shared/services/game.service';
import { TimerService } from '../../shared/services/timer.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dialog',
  imports: [BoardComponent],
  templateUrl: './game-dialog.component.html',
  styleUrls: ['./game-dialog.component.css']
})
export class GameDialogComponent implements OnInit, OnDestroy {
  @Input() mode: string = ''; // Game mode as entry parameter
  @Input() sessionId: string = '';
  @Input() sessionData: any;
  gameService = inject(GameService);
  private timer: TimerService = inject(TimerService);
  private currentTime: number = 0;
  private gameEndedSubscription: Subscription = new Subscription;
  currentImage: string ='../assets/icons/Stop.png';

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {
    if (this.sessionId) {
      this.gameService.initializeMultiplayerSession(this.sessionId, this.sessionData).subscribe({
        next: () => console.log('Multiplayer session loaded:', this.sessionId),
        error: (error) => console.error('Error loading multiplayer session:', error)
      });
    }

    if (this.mode === 'PvT' || this.gameService.gameModeGetter === 'singleplayer_time') {
      this.timer.getTimer().subscribe(time => this.currentTime = time); // Subscribe to the timer observable
    }

    this.gameEndedSubscription = this.gameService.gameEnded.subscribe(() => {
      this.closeModal('game-ended');
    });
  }

  ngOnDestroy() {
    if (this.gameEndedSubscription) {
      this.gameEndedSubscription.unsubscribe();
    }
    // Stop multiplayer polling when dialog is closed
    this.gameService.stopPolling();
  }

  get time(): string {
    return this.timer.getFormattedTimer();
  }

  get botPoints(): number {
    return this.gameService.pairsFoundBotGetter;
  }

  get playerPoints(): number {
    return this.gameService.pairsFoundPlayerGetter;
  }

  get isPlayerTurn(): boolean {
    return this.gameService.isPlayerTurn;
  }

  stopResumeTimerBtn() {
    if (this.timer.isTimerRunning) {
      this.timer.stopTimer();
      this.currentImage = '../assets/icons/Play.png';
    } else {
      this.timer.startTimer();
      this.currentImage = '../assets/icons/Stop.png';
    }
  }


  closeModal(reason: string = 'closed') {
    this.timer.stopTimer();
    this.activeModal.close(reason);
  }
}
