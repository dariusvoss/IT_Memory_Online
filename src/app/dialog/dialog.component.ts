import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-dialog',
    templateUrl: './dialog.component.html',
    styleUrls: ['./dialog.component.css'],
    providers: [NgbActiveModal]
})
export class DialogComponent {
  constructor(public activeModal: NgbActiveModal) {}
  closeModal() {
    this.activeModal.close();
  }
}
