import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-match-found-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-found-dialog.component.html',
  styleUrls: ['./match-found-dialog.component.css']
})
export class MatchFoundDialogComponent {
  @Input() opponentIds: string[] = [];
  @Input() gameSessionId: string = '';

  constructor(public activeModal: NgbActiveModal) {}

  onJoinClick() {
    this.activeModal.close(this.gameSessionId);
  }

  onDeclineClick() {
    this.activeModal.dismiss('declined');
  }
}
