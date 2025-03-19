import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-size-dialogue',
    templateUrl: './size-dialogue.component.html',
    styleUrl: './size-dialogue.component.css'
})
export class SizeDialogueComponent {
  constructor(public activeModal: NgbActiveModal) {}
  
    closeModal() {
      this.activeModal.close();
    }
}
