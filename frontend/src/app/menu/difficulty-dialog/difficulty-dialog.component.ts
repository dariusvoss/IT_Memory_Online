import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-difficulty-dialog',
  imports: [],
  templateUrl: './difficulty-dialog.component.html',
  styleUrl: './difficulty-dialog.component.css'
})
export class DifficultyDialogComponent {
  constructor(public activeModal: NgbActiveModal) {}

  selectDifficulty(difficulty: string) {
    this.activeModal.close(difficulty);
  }
}
