import { Component } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-size-dialog',
    imports: [],
    templateUrl: './size-dialog.component.html',
    styleUrl: './size-dialog.component.css'
})
export class SizeDialogComponent {
  private selectedCardCount: number = 16; // standard size
  constructor(public activeModal: NgbActiveModal) {}

  selectSize(cardCount: number) {
    this.selectedCardCount = cardCount;
    this.activeModal.close(this.selectedCardCount);  // Close the modal and return the number of cards
  }
}
