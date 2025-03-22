import { Component, inject, OnInit } from '@angular/core';
import { GameService } from './services/game.service';
import { CardComponent } from './card/card.component';
import { CommonModule, Time } from '@angular/common';
import { TimerService } from './services/timer.service';

@Component({
  selector: 'app-board',
  imports: [CardComponent, CommonModule],
  template: `
    <div class="board" [ngStyle]="{'grid-template-columns': gridTemplateColumns, 'grid-template-rows': gridTemplateRows}">
      <app-card style="display: flex; justify-content: center; align-items: center; " *ngFor="let card of cards" [image]="card.image" [cardId]="card.id" [flipped]="card.flipped" (cardClicked)="onCardClick(card)"></app-card>
    </div>
  `,
  styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit {
  cards: any[] = [];
  gridTemplateColumns: string = '';
  gridTemplateRows: string = '';
  timerService: TimerService =  inject(TimerService);

  constructor(private gameService: GameService) {}

  ngOnInit() {
    this.cards = this.gameService.getCards();
    this.setGridTemplate();
  }

  onCardClick(card: any) {
    if(this.gameService.difficultyGetter === 'None' && !this.timerService.isTimerRunning) {
      this.timerService.startTimer();
    } 
    // Ist der Spieler nicht am Zug wird nichts gemacht
    if(this.gameService.isPlayerTurn || this.gameService.difficultyGetter === 'None') {
    this.gameService.flipCard(card);
    }
  }

  private setGridTemplate() {
    const cardCount = this.cards.length;
    const gridSize = Math.sqrt(cardCount);
    this.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    this.gridTemplateRows = `repeat(${gridSize}, 1fr)`;
  }
}

