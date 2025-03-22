import { Component, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogComponent } from '../dialog/dialog.component';
import { SizeDialogueComponent } from '../size-dialogue/size-dialogue.component';
import { GameService } from '../dialog/board/services/game.service';
import { CommonModule } from '@angular/common';
import { ScoreboardComponent } from '../scoreboard/scoreboard.component';
import { TimerService } from '../dialog/board/services/timer.service';

@Component({
  selector: 'app-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {
  gameService = inject(GameService);
  timer = inject(TimerService);   
  private isDifficultChanged: boolean = false;
  private selectedSize: number = 16; // Standardgröße

  constructor(private modalService: NgbModal) {}

  selectHard() {
    this.isDifficultChanged = true;
    this.gameService.setDifficulty('Schwer');
    console.log('Hard selected');
  }

  selectMedium() {
    this.isDifficultChanged = true;
    this.gameService.setDifficulty('Mittel');
    console.log('Medium selected');
  }

  selectEasy() {
    this.isDifficultChanged = true;
    this.gameService.setDifficulty('Leicht');
    console.log('Easy selected');
  }

  resumeDialog() {
    if (this.gameService.difficultyGetter === 'none') {
      this.timer.startTimer();
    }
    this.modalService.open(DialogComponent, { size: 'lg', centered: true });
  }

  restartDialog() {
    this.gameService.resetGame();
  }

  chooseSize(mode: string) {
    const modalRef = this.modalService.open(SizeDialogueComponent);

    modalRef.result.then((result) => {
      if (result) {
        this.selectedSize = result;
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
      this.gameService.setDifficulty('Leicht');
    }
    this.gameService.initializeGame(this.selectedSize);
    const modalRef = this.modalService.open(DialogComponent, { size: 'xl', centered: true });
    modalRef.componentInstance.mode = 'PvB'; // Spielmodus übergeben
  }

  openPvTDialog() {
    this.gameService.setDifficulty('None');
    this.gameService.initializeGame(this.selectedSize);
    const modalRef = this.modalService.open(DialogComponent, { size: 'xl', centered: true });
    modalRef.componentInstance.mode = 'PvT'; // Spielmodus übergeben
  }

  openScoreboard() {
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
