import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() matchId: string = '';
  @Output() acceptClicked = new EventEmitter<void>();
  @Output() declineClicked = new EventEmitter<void>();

  waitingForOtherPlayer = false;

  onJoinClick() {
    if (this.waitingForOtherPlayer) {
      return;
    }

    this.waitingForOtherPlayer = true;
    this.acceptClicked.emit();
  }

  onDeclineClick() {
    this.declineClicked.emit();
  }
}
