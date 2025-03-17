import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {
  constructor(private modalService: NgbModal) {}

  openDialog() {
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });
  }
}
