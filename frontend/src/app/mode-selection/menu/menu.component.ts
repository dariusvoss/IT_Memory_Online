import { Component, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameDialogComponent } from '../game/game-dialog.component';
import { SizeDialogComponent } from '../size-dialog/size-dialog.component';
import { GameService } from '../../shared/services/game.service';
import { ScoreboardComponent } from '../scoreboard/scoreboard.component';
import { TimerService } from '../../shared/services/timer.service';
import { DifficultyDialogComponent } from './difficulty-dialog/difficulty-dialog.component';
import { BonusModeDialogComponent } from '../bonus-mode-dialog/bonus-mode-dialog.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-menu',
  imports: [],
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
    this.gameService.deleteSessionAndResetState().subscribe(
      () => console.log('Session deleted and game restarted from menu'),
      error => console.error('Error deleting session and restarting game:', error)
    );
  }

  chooseSize(mode: string) {
    const modalRef_size = this.modalService.open(SizeDialogComponent, { size: 'md', centered: true });

    modalRef_size.result.then(async (result) => {
      if (result) {
        const selectedBonusMode = await this.chooseBonusMode();
        if (selectedBonusMode === null) {
          return;
        }

        this.gameService.setBonusEffekt(selectedBonusMode);
        this.selectedSize = result;
        this.openGameDialog(mode);
      }
    }).catch((error) => {
      console.log('SizeDialog dismissed');
    });
  }

  private async chooseBonusMode(): Promise<boolean | null> {
    if (!environment.useBonusDialogIfSlideOff) {
      return this.gameService.bonusEffektEnabled;
    }

    if (this.gameService.bonusEffektEnabled) {
      // Debug-bypass: if slide toggle is active, skip dialog
      return true;
    }

    const modalRef = this.modalService.open(BonusModeDialogComponent, { size: 'md', centered: true });
    try {
      return await modalRef.result;
    } catch {
      return null;
    }
  }

  configurePlaythrough(mode: string) {
    if (mode === 'PvB') {
      // DifficultyDialog öffnen, um Schwierigkeit auszuwählen
      const modalRef_difficulty = this.modalService.open(DifficultyDialogComponent, {size: 'lg', centered: true});

      modalRef_difficulty.result.then((result) => {
        if (result) {
          this.gameService.setDifficulty(result).subscribe(
            () => {
              console.log('Difficulty ' + result + ' selected');
              // SizeDialog öffnen, um Kartensatzgröße auszuwählen
              this.chooseSize(mode);
            },
            error => console.error('Error setting difficulty:', error)
          );
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
      this.gameService.setDifficulty('None').subscribe(
        () => this.initializeAndOpenGame(mode),
        error => console.error('Error setting difficulty:', error)
      );
    } else {
      this.initializeAndOpenGame(mode);
    }
  }

  private initializeAndOpenGame(mode: string) {
    this.gameService.initializeGame(this.selectedSize).subscribe(
      () => {
        const modalRef = this.modalService.open(GameDialogComponent, { size: 'xl', centered: true });
        modalRef.componentInstance.mode = this.gameService.difficultyGetter !== 'None' ? 'PvB' : 'PvT';
      },
      error => console.error('Error initializing game:', error)
    );
  }

  openScoreboard() {
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
