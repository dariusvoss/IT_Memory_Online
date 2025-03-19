import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-card',
    imports: [CommonModule],
    template: `
    <div class="card" [class.flipped]="flipped" (click)="onClick()">
      <img *ngIf="flipped" [src]="image" />
      <div *ngIf="!flipped" class="card-back"></div>
    </div>
  `,
    styleUrls: ['./card.component.css']
})
export class CardComponent {
  @Input() image!: string;
  @Input() cardId!: number;
  @Input() flipped = false;
  @Output() cardClicked = new EventEmitter<void>();

  onClick() {
    if (!this.flipped) {
      this.cardClicked.emit();
    }
  }
}
