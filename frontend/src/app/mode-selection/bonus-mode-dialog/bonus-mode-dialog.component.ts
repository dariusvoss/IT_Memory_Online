import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-bonus-mode-dialog',
  imports: [],
  templateUrl: './bonus-mode-dialog.component.html',
  styleUrl: './bonus-mode-dialog.component.css'
})
export class BonusModeDialogComponent {
  @Input() showBotAutoUseInfo = false;

  constructor(public activeModal: NgbActiveModal) {}

  chooseBonusMode(enabled: boolean): void {
    this.activeModal.close(enabled);
  }

  closeDialog(): void {
    this.activeModal.dismiss();
  }
}
