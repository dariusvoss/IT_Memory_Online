import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogComponent } from '../dialog/dialog.component';
import { SizeDialogueComponent } from '../size-dialogue/size-dialogue.component';
import { GameService } from '../dialog/board/game.service';

@Component({
    selector: 'app-menu',
    imports: [],
    templateUrl: './menu.component.html',
    styleUrl: './menu.component.css'
})
export class MenuComponent {
  protected difficulty: 'Einfach' | 'Mittel' | 'Schwer' = 'Einfach';
  private isDifficultChanged: boolean = false;

  constructor(private modalService: NgbModal, private gameService : GameService) {  }

selectHard() {
  this.isDifficultChanged = true;
  this.difficulty = 'Schwer';
  this.gameService.setDifficulty('hard');
  console.log('Hard selected');
}

selectMedium() {
  this.isDifficultChanged = true;
  this.difficulty = 'Mittel';
  this.gameService.setDifficulty('medium');
  console.log('Medium selected');
}

selectEasy() {
  this.isDifficultChanged = true;
  this.difficulty = 'Einfach';
  this.gameService.setDifficulty('easy');
  console.log('Easy selected');
}

 

  openDialog() {
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });
  }

  openChooseSize() {
    this.modalService.open(SizeDialogueComponent, { size: 'md', centered: true });
  }

  openPvBDialog() {
    // console.log('Difficulty Dialog');
    if (!this.isDifficultChanged) {
      this.gameService.setDifficulty('easy');
    }
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });
  }
}
