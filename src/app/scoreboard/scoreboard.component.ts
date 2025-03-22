import { Component, inject, OnInit } from '@angular/core';
import { GameService } from '../dialog/board/services/game.service';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-scoreboard',
  imports: [CommonModule],
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.css']
})
export class ScoreboardComponent implements OnInit {
  gameService = inject(GameService);
  gameRecords: { date: string; mode: string; difficultyLevel: string; deckSize: string; points: string; rank: string; time: string }[] = [];

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {
    this.gameRecords = this.gameService.getGameRecords();
  }

  closeModal() {
    this.activeModal.close();
  }
}
