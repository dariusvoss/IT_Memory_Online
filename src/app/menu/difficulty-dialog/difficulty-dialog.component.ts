import { Component } from '@angular/core';
import { GameService } from '../size-dialog/game-dialog/board/services/game.service';

@Component({
  selector: 'app-difficulty-dialog',
  imports: [],
  templateUrl: './difficulty-dialog.component.html',
  styleUrl: './difficulty-dialog.component.css'
})
export class DifficultyDialogComponent {
  constructor(private gameService: GameService) {}

  selectDifficulty(difficulty: 'Leicht' | 'Mittel' | 'Schwer') {
    this.gameService.setDifficulty(difficulty);
    console.log(`${difficulty} selected`);
  }
}
