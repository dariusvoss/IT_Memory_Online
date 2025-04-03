import { Component, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameDialogComponent } from './size-dialog/game-dialog/game-dialog.component';
import { SizeDialogComponent } from './size-dialog/size-dialog.component';
import { GameService } from './size-dialog/game-dialog/board/services/game.service';
import { CommonModule } from '@angular/common';
import { ScoreboardComponent } from './scoreboard/scoreboard.component';
import { TimerService } from './size-dialog/game-dialog/board/services/timer.service';
import { DifficultyDialogComponent } from './difficulty-dialog/difficulty-dialog.component';

@Component({
  selector: 'app-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})

export class MenuComponent {
  gameService = inject(GameService);
  timer = inject(TimerService);
  private selectedSize: number = 16; // Standardgröße

  constructor(private modalService: NgbModal) {}

  resumeDialog() {
    if (this.gameService.difficultyGetter === 'None') {
      this.timer.startTimer();
    }
    this.modalService.open(GameDialogComponent, { size: 'xl', centered: true });
  }

  restartDialog() {
    this.gameService.resetGame();
  }

  chooseSize(mode: string) {
    const modalRef_size = this.modalService.open(SizeDialogComponent, { size: 'md', centered: true });

    modalRef_size.result.then((result) => {
      if (result) {
        this.selectedSize = result;
        this.openGameDialog(mode);
      }
    }).catch((error) => {
      console.log('SizeDialog dismissed');
    });
  }

  configurePlaythrough(mode: string) {
    if (mode === 'PvB') {
      // DifficultyDialog öffnen, um Schwierigkeit auszuwählen
      const modalRef_difficulty = this.modalService.open(DifficultyDialogComponent, {size: 'lg', centered: true});

      modalRef_difficulty.result.then((result) => {
        if (result) {
          this.gameService.setDifficulty(result);
          console.log('Difficulty ' + {result} + ' selected');
          // SizeDialog öffnen, um Kartensatzgröße auszuwählen
          this.chooseSize(mode);
        }
      }).catch((error) => {
        console.log('DifficultyDialog dismissed');
      })
    } else {
      this.chooseSize(mode);
    }
  }

  openGameDialog(mode: string) {
    if (mode === 'PvT') {
      this.gameService.setDifficulty('None');
    }
    this.gameService.initializeGame(this.selectedSize);
    const modalRef = this.modalService.open(GameDialogComponent, { size: 'xl', centered: true });
    modalRef.componentInstance.mode = this.gameService.difficultyGetter !== 'None' ? 'PvB' : 'PvT'; // Spielmodus übergeben
  }

  openScoreboard() {
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
