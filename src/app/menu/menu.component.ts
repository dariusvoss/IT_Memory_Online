import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogComponent } from '../dialog/dialog.component';
import { SizeDialogueComponent } from '../size-dialogue/size-dialogue.component';

@Component({
    selector: 'app-menu',
    templateUrl: './menu.component.html',
    styleUrl: './menu.component.css'
})
export class MenuComponent {
  constructor(private modalService: NgbModal) {}

  openDialog() {
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });
  }

  openChooseSize() {
    this.modalService.open(SizeDialogueComponent, { centered: true});
  }
}
