import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TimerService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api/game';
  
  private secondsElapsed = 0;
  private timer$ = new BehaviorSubject<number>(this.secondsElapsed);
  private intervalSubscription: any;
  isTimerRunning = false;

  constructor() {
    console.log('TimerService');
  }

  startTimer() {
    if (!this.intervalSubscription) {
      this.isTimerRunning = true;
      
      // Also notify backend
      this.http.post(`${this.apiUrl}/start-timer`, {}).subscribe(
        () => console.log('Backend timer started'),
        error => console.error('Error starting backend timer:', error)
      );
      
      // Run local timer
      this.intervalSubscription = interval(1000)
        .pipe(map(() => ++this.secondsElapsed))
        .subscribe((seconds) => this.timer$.next(seconds));
    }
  }

  stopTimer() {
    if (this.intervalSubscription) {
      this.isTimerRunning = false;
      this.intervalSubscription.unsubscribe();
      this.intervalSubscription = null;
      
      // Also notify backend
      this.http.post(`${this.apiUrl}/stop-timer`, {}).subscribe(
        () => console.log('Backend timer stopped'),
        error => console.error('Error stopping backend timer:', error)
      );
    }
  }

  resetTimer() {
    this.stopTimer();
    this.secondsElapsed = 0;
    this.timer$.next(this.secondsElapsed);
    
    // Also notify backend
    this.http.post(`${this.apiUrl}/reset`, {}).subscribe(
      () => console.log('Backend timer reset'),
      error => console.error('Error resetting backend timer:', error)
    );
  }

  getTimer() {
    return this.timer$.asObservable();
  }

  getFormattedTimer() {
    const time = this.timer$.getValue();
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  getElapsedSeconds(): number {
    return this.secondsElapsed;
  }
}