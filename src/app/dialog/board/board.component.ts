import { Component, OnInit } from '@angular/core';
import { GameService } from './services/game.service';
import { CardComponent } from './card/card.component';
import { CommonModule } from '@angular/common';


@Component({
    selector: 'app-board',
    imports: [CardComponent, CommonModule],
    template: `
    <div class="board">
      <app-card *ngFor="let card of cards" [image]="card.image" [cardId]="card.id" [flipped]="card.flipped" (cardClicked)="onCardClick(card)"></app-card>
    </div>
  `,
    styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit {
  cards: any[] = [];

  constructor(private gameService: GameService) {}

  ngOnInit() {
    this.cards = this.gameService.getCards();
  }

  onCardClick(card: any) {
    // Ist der Spieler am nicht Zug wird nichts gemacht
    if(this.gameService.isPlayerTurn || this.gameService.difficultyGetter === 'none') {
    this.gameService.flipCard(card);
    }
  }
}

