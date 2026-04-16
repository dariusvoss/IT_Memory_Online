import { Component, inject, OnInit, HostListener, ElementRef, OnDestroy } from '@angular/core';
import { GameService } from '../../../shared/services/game.service';
import { MemoryCardComponent } from './memory-card/memory-card.component';
import { CommonModule } from '@angular/common';
import { TimerService } from '../../../shared/services/timer.service';
import { GameDialogComponent } from '../game-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-board',
  imports: [MemoryCardComponent, CommonModule],
  template: `
    <div class="board" [ngStyle]="{'grid-template-columns': gridTemplateColumns, 'grid-template-rows': gridTemplateRows}">
      @for (card of cards; track card) {
        <app-card 
          style="display: flex; justify-content: center; align-items: center;"  
          [image]="card.image"
          [cardId]="card.id"
          [flipped]="card.flipped"
          [selectableWhenFlipped]="gameService.canUseKartenmediumPreviewCard(card)"
          (cardClicked)="onCardClick(card)">
        </app-card>
      }
    </div>
  `,
  styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit, OnDestroy {
  cards: any[] = [];
  gridTemplateColumns: string = '';
  gridTemplateRows: string = '';
  timerService: TimerService = inject(TimerService);
  gameDialog: GameDialogComponent = inject(GameDialogComponent);
  
  private cardsSubscription: Subscription = new Subscription();

  constructor(public gameService: GameService, private elRef: ElementRef) { }

  ngOnInit() {
    this.cards = this.gameService.getCards();
    this.setGridTemplate();
    
    // Subscribe to card updates from service
    this.cardsSubscription = this.gameService.cards$.subscribe(updatedCards => {
      this.cards = updatedCards;
      this.setGridTemplate();
    });
  }

  ngOnDestroy() {
    if (this.cardsSubscription) {
      this.cardsSubscription.unsubscribe();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.setGridTemplate();
  }

  onCardClick(card: any) {
    // Ist der Spieler nicht am Zug, wird nichts gemacht
    if (this.gameService.canRevealPrivateScoutCard || this.gameService.isPlayerTurn || this.gameService.difficultyGetter === 'None') {
      this.gameService.flipCard(card);
    }
  }

  private setGridTemplate() {
    const cardCount = this.cards.length;
    const containerWidth = this.elRef.nativeElement.querySelector('.board')?.offsetWidth || 800;
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
