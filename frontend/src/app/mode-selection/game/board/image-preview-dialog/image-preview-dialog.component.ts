import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-image-preview-dialog',
  imports: [],
  templateUrl: './image-preview-dialog.component.html',
  styleUrls: ['./image-preview-dialog.component.css']
})
export class ImagePreviewDialogComponent {
  @Input() imageUrl: string = '';
  @Input() imageTitle: string = 'Bildvorschau';

  constructor(public activeModal: NgbActiveModal) {}

  closeDialog(): void {
    this.activeModal.close();
  }
}
