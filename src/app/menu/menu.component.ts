import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogComponent } from '../dialog/dialog.component';
import { SizeDialogueComponent } from '../size-dialogue/size-dialogue.component';
import { GameService } from '../dialog/board/services/game.service';

@Component({
    selector: 'app-menu',
    imports: [],
    templateUrl: './menu.component.html',
    styleUrl: './menu.component.css'
})
export class MenuComponent {
  protected difficulty: 'Einfach' | 'Mittel' | 'Schwer' = 'Einfach';
  private isDifficultChanged: boolean = false;
  private selectedCardCount: number = 16; // Standardgröße

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
    this.gameService.setDifficulty('none');
  }

  chooseSize(mode: string) {
    const modalRef = this.modalService.open(SizeDialogueComponent);

    modalRef.result.then((result) => {
      if (result) {
        this.selectedCardCount = result;
        this.openGameDialog(mode);
      }
    }).catch((error) => {
      console.log('Dialog dismissed');
    });
  }

  openGameDialog(mode: string) {
    if (mode === 'PvB') {
      this.openPvBDialog();
    } else if (mode === 'PvT') {
      this.openPvTDialog();
    }
  }

  openPvBDialog() {
    if (!this.isDifficultChanged) {
      this.gameService.setDifficulty('easy');
    }
    this.gameService.initializeGame(this.selectedCardCount);  // Spielfeld initialisieren
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });
  }

  openPvTDialog() {
    // Logik zum Öffnen des PvT-Dialogs
  }
}
