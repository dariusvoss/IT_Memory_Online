import { Component, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BoardComponent } from './board/board.component';
import { CommonModule } from '@angular/common';
import { GameService } from './board/services/game.service';
import { TimerService } from './board/services/timer.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dialog',
  imports: [BoardComponent, CommonModule],
  templateUrl: './game-dialog.component.html',
  styleUrls: ['./game-dialog.component.css']
})
export class GameDialogComponent implements OnInit, OnDestroy {
  @Input() mode: string = ''; // Spielmodus als Eingabeparameter
  gameService = inject(GameService);
  private timer: TimerService = inject(TimerService);
  private currentTime: number = 0;
  private gameEndedSubscription: Subscription = new Subscription;
  currentImage: string ='../assets/icons/Stop.png';

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {
    if (this.mode === 'PvT') {
      this.timer.getTimer().subscribe(time => this.currentTime = time); // Subscribe to the timer observable
    }

    this.gameEndedSubscription = this.gameService.gameEnded.subscribe(() => {
      this.closeModal();
    });
  }

  ngOnDestroy() {
    if (this.gameEndedSubscription) {
      this.gameEndedSubscription.unsubscribe();
    }
  }

  get time(): string {
    return this.timer.getFormattedTimer(); // Dynamisch aus dem Service abrufen
  }

  get botPoints(): number {
    return this.gameService.pairsFoundBotGetter; // Dynamisch aus dem Service abrufen
  }

  get playerPoints(): number {
    return this.gameService.pairsFoundPlayerGetter; // Dynamisch aus dem Service abrufen
  }

  get isPlayerTurn(): boolean {
    return this.gameService.isPlayerTurn; // Dynamisch aus dem Service abrufen
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


  closeModal() {
    this.timer.stopTimer();
    this.activeModal.close();
  }
}
