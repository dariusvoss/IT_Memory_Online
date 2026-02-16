import { Component, Input, Output, EventEmitter } from '@angular/core';


@Component({
    selector: 'app-card',
    imports: [],
    template: `
    <div class="memory-card" [class.flipped]="flipped" (click)="onClick()">
      @if (flipped) {
        <img [src]="image"/>
      } @else {
        <div class="memory-card-back"></div>
      }
    </div>
  `,
    styleUrls: ['./memory-card.component.css']
})
export class MemoryCardComponent {
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
