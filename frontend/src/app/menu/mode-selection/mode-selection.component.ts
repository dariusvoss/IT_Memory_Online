import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';   // <– add this
import { MenuComponent } from '../menu.component';
import { environment } from '../../../environments/environment';
import { ScoreboardComponent } from '../scoreboard/scoreboard.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap/modal';

@Component({
  selector: 'app-mode-selection',
  standalone: true,
  imports: [CommonModule, MenuComponent, ScoreboardComponent],
  templateUrl: './mode-selection.component.html',
  styleUrl: './mode-selection.component.css'
})
export class GameModeSelectionComponent {
  selectedMode: 'none' | 'singleplayer' | 'multiplayer' = 'none';

  constructor(private http: HttpClient, private modalService: NgbModal) {}      // <– inject HttpClient

  selectSingleplayer(): void {
    this.selectedMode = 'singleplayer';
  }

  selectMultiplayer(): void {
    this.selectedMode = 'multiplayer';
    this.http.post(`${environment.apiUrl}/matchmaking/join-queue`, { player_id: environment.playerId })
      .subscribe({
        next: response => console.log('Player joined queue response:', response),
        error: err => console.error('Error joining queue:', err)
      });
  }

  goBack(): void {
    this.selectedMode = 'none';
    this.http.post(`${environment.apiUrl}/matchmaking/leave-queue`, { player_id: environment.playerId })
      .subscribe({
        next: response => console.log('Player left queue response:', response),
        error: err => console.error('Error leaving queue:', err)
      });
  }

  openScoreboard(): void {
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
