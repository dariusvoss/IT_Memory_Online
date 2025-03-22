import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-finish-dialog',
  imports: [CommonModule],
  templateUrl: './finish-dialog.component.html',
  styleUrl: './finish-dialog.component.css'
})
export class FinishDialogComponent {
  @Input() time: string = ''; // Zeit des Spiels
  @Input() playerPoints: number = 0; // Punkte des Spielers
  @Input() botPoints: number = 0; // Punkte des Bots
  @Input() difficulty: string = ''; // Schwierigkeitsgrad
  @Input() message: string = ''; // Nachricht an den Spieler

  constructor(public activeModal: NgbActiveModal) {}

  closeDialog() {
    this.activeModal.close();
  }
}
