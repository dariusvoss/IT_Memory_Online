import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PlayerIdService } from './menu/size-dialog/game-dialog/board/services/player-id.service';
import { GameService } from './menu/size-dialog/game-dialog/board/services/game.service';
import { GameModeSelectionComponent } from './menu/mode-selection/mode-selection.component';
import { environment } from '../environments/environment';
import { HttpClient } from '@angular/common/http';


@Component({
    selector: 'app-root',
    imports: [GameModeSelectionComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'IT-Memory';
  playerID = '';


  constructor(private playerIdService: PlayerIdService,
    private gameService: GameService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // console.log('AppComponent initialized');

    // Initialize player ID on app start
    this.playerIdService.getPlayerId().subscribe({
      next: (playerId) => {
        environment.playerId = playerId;
        console.log('Player ID initialized:', playerId);
      },
      error: (err) => {
        console.error('Failed to initialize player ID:', err);
      }
    });

  }
}
