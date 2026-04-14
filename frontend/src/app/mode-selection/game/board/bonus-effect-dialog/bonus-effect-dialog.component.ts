import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-bonus-effect-dialog',
  imports: [],
  templateUrl: './bonus-effect-dialog.component.html',
  styleUrls: ['./bonus-effect-dialog.component.css']
})
export class BonusEffectDialogComponent {
  @Input() title: string = 'Bonus-Effekt';
  @Input() message: string = '';
  @Input() effectLabel: string = '';
  @Input() effectDescription: string = '';
  @Input() showTriggerHint: boolean = false;

  constructor(public activeModal: NgbActiveModal) {}

  closeDialog(): void {
    this.activeModal.close();
  }
}
