import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { ScoreboardComponent } from '../../../../scoreboard/scoreboard.component';

@Component({
  selector: 'app-finish-dialog',
  imports: [CommonModule],
  templateUrl: './finish-dialog.component.html',
  styleUrls: ['./finish-dialog.component.css']
})
export class FinishDialogComponent {
  @Input() time: string = ''; // Zeit, die der Spieler zum Finden aller Paare benötigt hat 
  @Input() rank: string = ''; // Rang, den der Spieler mit seiner Zeit erreicht hat
  @Input() playerPoints: number = 0; // Punkte des Spielers
  @Input() botPoints: number = 0; // Punkte des Bots
  @Input() difficulty: string = ''; // Schwierigkeitsgrad
  @Input() message: string = ''; // Nachricht an den Spieler

  constructor(public activeModal: NgbActiveModal, private modalService: NgbModal) {}

  closeDialog() {
    this.activeModal.close();
  }

  openScoreboard() {
    this.closeDialog();
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
