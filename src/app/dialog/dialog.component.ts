import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BoardComponent } from './board/board.component';
import { CommonModule } from '@angular/common';
import { GameService } from './board/services/game.service';
import { TimerService } from './board/services/timer.service';

@Component({
    selector: 'app-dialog',
    imports: [BoardComponent, CommonModule],
    templateUrl: './dialog.component.html',
    styleUrls: ['./dialog.component.css']
})
export class DialogComponent {
  gameService = inject(GameService);
  private timer : TimerService = inject(TimerService);
  private currentTime: number = 0;

  constructor(public activeModal: NgbActiveModal) { 
    this.timer.startTimer();
    this.timer.getTimer().subscribe(time => this.currentTime = time); // Subscribe to the timer observable
  }

  get time(): string {
    return this.timer.getFomateTimer(); // Dynamisch aus dem Service abrufen
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

  closeModal() {
    this.timer.stopTimer();
    this.activeModal.close();
  }
}
