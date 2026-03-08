import { Component, OnInit } from '@angular/core';
import { PlayerIdService } from './shared/services/player-id.service';
import { GameService } from './shared/services/game.service';
import { GameModeSelectionComponent } from './mode-selection/mode-selection.component';
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
  containerWidth: number = 40; // Default 40% for main menu


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
        console.log('[AppComponent] Player ID initialized:', playerId);
      },
      error: (err) => {
        console.error('[AppComponent] Failed to initialize player ID:', err);
      }
    });

  }

  onModeChanged(mode: 'none' | 'singleplayer' | 'multiplayer'): void {
    // Adjust container width based on current mode
    if (mode === 'singleplayer') {
      this.containerWidth = 70; // 70% for singleplayer with multiple cards
    } else {
      this.containerWidth = 40; // 40% for main menu or multiplayer
    }
  }
}
