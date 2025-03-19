import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BoardComponent } from './board/board.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-dialog',
    imports: [BoardComponent, CommonModule],
    templateUrl: './dialog.component.html',
    styleUrls: ['./dialog.component.css']
})
export class DialogComponent {
  constructor(public activeModal: NgbActiveModal) {}

  closeModal() {
    this.activeModal.close();
  }
}
