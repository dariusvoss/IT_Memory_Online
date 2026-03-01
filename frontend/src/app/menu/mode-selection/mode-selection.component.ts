import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';   // <– add this
import { MenuComponent } from '../menu.component';
import { environment } from '../../../environments/environment';
import { ScoreboardComponent } from '../scoreboard/scoreboard.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap/modal';
import { SizeDialogComponent } from '../size-dialog/size-dialog.component';

@Component({
  selector: 'app-mode-selection',
  standalone: true,
  imports: [CommonModule, MenuComponent],
  templateUrl: './mode-selection.component.html',
  styleUrl: './mode-selection.component.css'
})
export class GameModeSelectionComponent {
  selectedMode: 'none' | 'singleplayer' | 'multiplayer' = 'none';
  private selectedSize: number = -1; // Standardgröße

  constructor(private http: HttpClient, private modalService: NgbModal) {}      // <– inject HttpClient

  chooseSize() {
      const modalRef_size = this.modalService.open(SizeDialogComponent, { size: 'md', centered: true });

      modalRef_size.result.then((result) => {
        if (result) {
          this.selectedSize = result;
          this.http.post(`${environment.apiUrl}/matchmaking/join-queue`, { player_id: environment.playerId, deck_size: this.selectedSize })
        .subscribe({
          next: response => console.log('Player joined queue response:', response),
          error: err => console.error('Error joining queue:', err)
        });
          // this.openGameDialog(mode);
        }
      }).catch((error) => {
        console.log('SizeDialog dismissed');
      });
    }

  selectSingleplayer(): void {
    this.selectedMode = 'singleplayer';
  }

  selectMultiplayer(): void {
    this.selectedMode = 'multiplayer';
    this.chooseSize();
  }

  goBack(): void {
    if (this.selectedMode === 'multiplayer') {
      this.http.post(`${environment.apiUrl}/matchmaking/leave-queue`, { player_id: environment.playerId, deck_size: this.selectedSize })
      .subscribe({
        next: response => {console.log('Player left queue response:', response); this.selectedSize = -1;},
        error: err => console.error('Error leaving queue:', err)
      });
    }
    this.selectedMode = 'none';
  }

  openScoreboard(): void {
    this.modalService.open(ScoreboardComponent, { size: 'lg', centered: true });
  }
}
