import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PlayerIdService {
  private apiUrl = `${environment.apiUrl}/player`;
  private playerId: string | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Get or create player ID
   * Checks cookie first, then backend if needed
   */
  getPlayerId(): Observable<string> {
    if (this.playerId) {
      return new Observable(obs => {
        obs.next(this.playerId!);
        obs.complete();
      });
    }

    const cookieId = this.getPlayerIdFromCookie();
    if (cookieId) {
      this.playerId = cookieId;
      return new Observable(obs => {
        obs.next(cookieId);
        obs.complete();
      });
    }

    // Create new ID on backend - send empty object as body
    return new Observable(obs => {
      this.http.get<{ player_id: string }>(`${this.apiUrl}/create-id`, {})
        .subscribe({
          next: (response) => {
            this.playerId = response.player_id;
            this.setPlayerIdCookie(this.playerId);
            obs.next(this.playerId);
            obs.complete();
          },
          error: (err) => {
            console.error('Error creating player ID:', err);
            obs.error(err);
          }
        });
    });
  }

  private getPlayerIdFromCookie(): string | null {
    const name = 'player_id=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookies = decodedCookie.split(';');

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length);
      }
    }
    return null;
  }

  public setPlayerIdCookie(playerId: string): void {
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    document.cookie = `player_id=${playerId}; expires=${expirationDate.toUTCString()}; path=/`;
  }
}
