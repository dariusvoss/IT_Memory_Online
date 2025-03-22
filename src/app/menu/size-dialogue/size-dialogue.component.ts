import { Component } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-size-dialogue',
    imports: [],
    templateUrl: './size-dialogue.component.html',
    styleUrl: './size-dialogue.component.css'
})
export class SizeDialogueComponent {
  private selectedCardCount: number = 16; // Standardgröße
  constructor(public activeModal: NgbActiveModal) {}

  selectSize(cardCount: number) {
    this.selectedCardCount = cardCount;  // Größe setzen
    this.activeModal.close(this.selectedCardCount);  // Aktuelles Fenster schließen
  }
}
