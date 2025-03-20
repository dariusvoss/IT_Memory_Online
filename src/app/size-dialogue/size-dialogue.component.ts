import { Component } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogComponent } from '../dialog/dialog.component';

@Component({
    selector: 'app-size-dialogue',
    imports: [],
    templateUrl: './size-dialogue.component.html',
    styleUrl: './size-dialogue.component.css'
})
export class SizeDialogueComponent {
  constructor(public activeModal: NgbActiveModal, private modalService: NgbModal) {}

  selectSize(cardCount: number) {
    localStorage.setItem('selectedCardCount', cardCount.toString());  // Kartengröße speichern
    this.activeModal.close();  // Aktuelles Fenster schließen
    this.openGameDialog();  // Spiel starten
  }
  
  openGameDialog() {
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });  // Spielfeld-Dialog öffnen
  }
}
