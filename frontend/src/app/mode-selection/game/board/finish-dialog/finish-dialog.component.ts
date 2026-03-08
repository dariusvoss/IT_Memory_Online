import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScoreboardComponent } from '../../../scoreboard/scoreboard.component';

@Component({
  selector: 'app-finish-dialog',
  imports: [],
  templateUrl: './finish-dialog.component.html',
  styleUrls: ['./finish-dialog.component.css']
})
export class FinishDialogComponent {
  @Input() time: string = ''; // Time taken by player to find all pairs 
  @Input() rank: string = ''; // Rank achieved by player (A-E) based on their time
  @Input() playerPoints: number = 0; // Player's points
  @Input() botPoints: number = 0; // Bot's points
  @Input() difficulty: string = ''; // Difficulty level
  @Input() message: string = ''; // Message to the player

  constructor(public activeModal: NgbActiveModal, private modalService: NgbModal) {}

  closeDialog() {
    this.activeModal.close();
  }

  openScoreboard() {
    this.closeDialog();
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
