import { Component, inject, OnInit, HostListener, ElementRef, OnDestroy } from '@angular/core';
import { GameService } from '../../../shared/services/game.service';
import { MemoryCardComponent } from './memory-card/memory-card.component';
import { CommonModule } from '@angular/common';
import { TimerService } from '../../../shared/services/timer.service';
import { GameDialogComponent } from '../game-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { ImagePreviewDialogComponent } from './image-preview-dialog/image-preview-dialog.component';

@Component({
  selector: 'app-board',
  imports: [MemoryCardComponent, CommonModule],
  template: `
    <div class="board" [class.whirlwind-active]="isWhirlwindAnimating" [ngStyle]="{'grid-template-columns': gridTemplateColumns, 'grid-template-rows': gridTemplateRows}">
      @for (card of cards; track card) {
        <app-card
          style="display: flex; justify-content: center; align-items: center;"
          [image]="card.image"
          [cardId]="card.id"
          [flipped]="card.flipped"
          (cardClicked)="onCardClick(card)">
        </app-card>
      }
    </div>
  `,
  styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit, OnDestroy {
  /** Exact filenames in assets/images/Th_OWL/originale/ keyed by card base name. */
  private readonly originalImageMap: Record<string, string> = {
    Logo1:           'Logo1.png',
    Logo2:           'Logo2.jpg',
    'Hauptgebäude':  'Hauptgebäude.jpg',
    Socke:           'Socke.webp',
    Flasche:         'Flasche.webp',
    Stift:           'Stift.webp',
    Hoodie:          'Hoodie.webp',
    Reform:          'Reform.jpg',
    Lemgo_Geb_17:    'Lemgo_Geb_17.jpg',
    Lemgo_Mensa:     'Lemgo_Mensa.jpg',
    Lemgo_Geb_5:     'Lemgo_Geb_5.jpg',
    Hoexter_Geb_5:   'Hoexter_Geb_5.jpg',
    Detmold_Geb_7:   'Detmold_Geb_7.jpg',
    Detmold_Geb_5:   'Detmold_Geb_5.jpg',
    Audimax:         'Audimax.jpg',
    Detmold_Geb_4:   'Detmold_Geb_4.jpg',
    Bewerben:        'Bewerben.jpg',
    ThFlage:         'ThFlage.jpg',
    ButGebHoxter:    'HauptgebHoxter.jpg',
    Detmold:         'Detmold.jpg',
    Detmold2:        'Detmold2.jpg',
    Detmold3:        'Detmold3.jpg',
    Parkhaus_Lemgo:  'Parkhaus_Lemgo.jpg',
    Becher:          'Becher.jpg',
    Rucksack:        'Rucksack.jpg',
    EinMa:           'EinMa.jpg',
    MalGe:           'MalGe.png',
    Buch:            'Buch.jpg',
    Lemgo_Geb_alt:   'Lemgo_Geb_alt.jpg',
    GiBoDay:         'GiBoDay.jpg',
    ThWerbeartikel:  'ThWerbeartikel.jpg',
    Werbung:         'Werbung.jpg',
  };

  cards: any[] = [];
  gridTemplateColumns: string = '';
  gridTemplateRows: string = '';
  isWhirlwindAnimating: boolean = false;
  timerService: TimerService = inject(TimerService);
  gameDialog: GameDialogComponent = inject(GameDialogComponent);
  private modalService = inject(NgbModal);

  private cardsSubscription: Subscription = new Subscription();
  private whirlwindSubscription: Subscription = new Subscription();
  private whirlwindAnimationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(public gameService: GameService, private elRef: ElementRef) { }

  ngOnInit() {
    this.cards = this.gameService.getCards();
    this.setGridTemplate();

    // Subscribe to card updates from service
    this.cardsSubscription = this.gameService.cards$.subscribe(updatedCards => {
      this.cards = updatedCards;
      this.setGridTemplate();
    });

    this.whirlwindSubscription = this.gameService.whirlwindAnimation$.subscribe((durationMs: number) => {
      this.isWhirlwindAnimating = true;

      if (this.whirlwindAnimationTimer) {
        clearTimeout(this.whirlwindAnimationTimer);
      }

      this.whirlwindAnimationTimer = setTimeout(() => {
        this.isWhirlwindAnimating = false;
        this.whirlwindAnimationTimer = null;
      }, durationMs);
    });
  }

  ngOnDestroy() {
    if (this.cardsSubscription) {
      this.cardsSubscription.unsubscribe();
    }

    if (this.whirlwindSubscription) {
      this.whirlwindSubscription.unsubscribe();
    }

    if (this.whirlwindAnimationTimer) {
      clearTimeout(this.whirlwindAnimationTimer);
      this.whirlwindAnimationTimer = null;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.setGridTemplate();
  }

  onCardClick(card: any) {
    if (card.flipped) {
      this.openImagePreview(card.image);
      return;
    }

    // Ist der Spieler nicht am Zug, wird nichts gemacht
    if (this.gameService.canRevealPrivateScoutCard || this.gameService.isPlayerTurn || this.gameService.difficultyGetter === 'None') {
      this.gameService.flipCard(card);
    }
  }

  private openImagePreview(cardImagePath: string): void {
    const imageUrl = this.resolveOriginalImageUrl(cardImagePath);
    if (!imageUrl) {
      return;
    }

    const modalRef = this.modalService.open(ImagePreviewDialogComponent, {
      size: 'xl',
      centered: true
    });

    modalRef.componentInstance.imageUrl = imageUrl;
    modalRef.componentInstance.imageTitle = this.getImageTitle(cardImagePath);
  }

  private resolveOriginalImageUrl(cardImagePath: string): string | null {
    const fileName = cardImagePath.split('/').pop();
    if (!fileName) {
      return null;
    }

    const match = fileName.match(/^Memory_Card_\d+_(.+)\.[^.]+$/);
    if (!match) {
      return null;
    }

    const baseName = match[1];
    const originalFileName = this.originalImageMap[baseName];
    if (!originalFileName) {
      return null;
    }

    return `assets/images/Th_OWL/originale/${originalFileName}`;
  }

  private getImageTitle(cardImagePath: string): string {
    const fileName = cardImagePath.split('/').pop() ?? '';
    const match = fileName.match(/^Memory_Card_\d+_(.+)\.[^.]+$/);
    return (match?.[1] ?? 'Bildvorschau').replace(/_/g, ' ');
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

