import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TimerService {
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
    }
  }

  resetTimer() {
    this.stopTimer();
    this.secondsElapsed = 0;
    this.timer$.next(this.secondsElapsed);
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
}