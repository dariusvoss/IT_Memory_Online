import { Component, inject, OnInit, HostListener, ElementRef } from '@angular/core';
import { GameService } from './services/game.service';
import { CardComponent } from './card/card.component';
import { CommonModule } from '@angular/common';
import { TimerService } from './services/timer.service';
import { GameDialogComponent } from '../game-dialog.component';

@Component({
  selector: 'app-board',
  imports: [CardComponent, CommonModule],
  template: `
    <div class="board" [ngStyle]="{'grid-template-columns': gridTemplateColumns, 'grid-template-rows': gridTemplateRows}">
      <app-card 
        style="display: flex; justify-content: center; align-items: center;" 
        *ngFor="let card of cards" 
        [image]="card.image" [cardId]="card.id" [flipped]="card.flipped" (cardClicked)="onCardClick(card)"></app-card>
    </div>
  `,
  styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit {
  cards: any[] = [];
  gridTemplateColumns: string = '';
  gridTemplateRows: string = '';
  timerService: TimerService = inject(TimerService);
  gameDialog: GameDialogComponent = inject(GameDialogComponent);

  constructor(private gameService: GameService, private elRef: ElementRef) { }

  ngOnInit() {
    this.cards = this.gameService.getCards();
    this.setGridTemplate();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.setGridTemplate();
  }

  onCardClick(card: any) {
    if (this.gameService.difficultyGetter === 'None' && !this.timerService.isTimerRunning) {
      this.timerService.startTimer();
      this.gameDialog.currentImage = '../assets/icons/Stop.png';
    }
    // Ist der Spieler nicht am Zug, wird nichts gemacht
    if (this.gameService.isPlayerTurn || this.gameService.difficultyGetter === 'None') {
      this.gameService.flipCard(card);
    }
  }

  private setGridTemplate() {
    const cardCount = this.cards.length;
    const containerWidth = this.elRef.nativeElement.querySelector('.board').offsetWidth;
    const cardWidth = 100;
    let columns: number;
    let rows: number;

    if (containerWidth >= 800) {
      if (cardCount === 16) {
        columns = 4;
        rows = 4;
      } else if (cardCount === 36) {
        columns = 6;
        rows = 6;
      } else if (cardCount === 64) {
        columns = 8;
        rows = 8;
      } else {
        columns = Math.floor(Math.sqrt(cardCount));
        rows = Math.ceil(cardCount / columns);
      }
    } else {
      columns = Math.floor(containerWidth / cardWidth);
      rows = Math.ceil(cardCount / columns);
    }

    this.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    this.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }
}

