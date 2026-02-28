import { Component, inject, OnInit } from '@angular/core';
import { GameService } from '../size-dialog/game-dialog/board/services/game.service';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-scoreboard',
  imports: [],
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.css']
})
export class ScoreboardComponent implements OnInit {
  gameService = inject(GameService);
  gameRecords: { date: string; mode: string; difficultyLevel: string; deckSize: string; points: string; rank: string; time: string }[] = [];

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {
    // Refresh records from backend
    this.gameService.refreshGameRecords().subscribe(
      () => {
        this.gameRecords = this.gameService.getGameRecords();
      },
      (error: any) => {
        console.error('Error loading game records:', error);
        // Fall back to cached records
        this.gameRecords = this.gameService.getGameRecords();
      }
    );
  }

  clearScoreboard() {
    if (confirm('Möchtest du wirklich alle Spielaufzeichnungen löschen?')) {
      this.gameService.clearGameRecords().subscribe(
        () => {
          this.gameRecords = [];
          console.log('Game records cleared');
        },
        (error: any) => console.error('Error clearing game records:', error)
      );
    }
  }

  closeModal() {
    this.activeModal.close();
  }
}
