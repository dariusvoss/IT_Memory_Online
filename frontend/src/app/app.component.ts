import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerIdService } from './shared/services/player-id.service';
import { GameService } from './shared/services/game.service';
import { GameModeSelectionComponent } from './mode-selection/mode-selection.component';
import { environment } from '../environments/environment';
import { HttpClient } from '@angular/common/http';
import { UiScaleService } from './shared/services/ui-scale.service';


@Component({
    selector: 'app-root',
  imports: [CommonModule, GameModeSelectionComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'IT-Memory';
  playerID = '';
  containerWidth: number = 40; // Default 40% for main menu
  readonly scaleOptions = [
    { label: '100%', value: 1.0 },
    { label: '95%', value: 0.95 },
    { label: '90%', value: 0.9 },
    { label: '85%', value: 0.85 },
    { label: '80%', value: 0.8 },
    { label: '75%', value: 0.75 },
    { label: '70%', value: 0.7 },
    { label: '65%', value: 0.65 },
    { label: '60%', value: 0.6 },
    { label: '55%', value: 0.55 },
    { label: '50%', value: 0.5 },
  ];


  constructor(private playerIdService: PlayerIdService,
    private gameService: GameService,
    private http: HttpClient,
    public uiScaleService: UiScaleService
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

  onScaleChanged(rawValue: string): void {
    const parsed = Number(rawValue);

    if (!Number.isNaN(parsed)) {
      this.uiScaleService.setScale(parsed);
    }
  }
}
