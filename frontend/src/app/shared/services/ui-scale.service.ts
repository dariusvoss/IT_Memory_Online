import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiScaleService {
  private readonly storageKey = 'uiScale';
  private readonly minScale = 0.5;
  private readonly maxScale = 1;

  private readonly scaleState = signal<number>(this.readInitialScale());
  readonly scale = computed(() => this.scaleState());

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.applyScale(this.scaleState());
  }

  setScale(value: number): void {
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, value));
    this.scaleState.set(clamped);
    localStorage.setItem(this.storageKey, String(clamped));
    this.applyScale(clamped);
  }

  private readInitialScale(): number {
    const rawValue = localStorage.getItem(this.storageKey);
    const parsed = rawValue ? Number(rawValue) : 1;

    if (Number.isNaN(parsed)) {
      return 1;
    }

    return Math.min(this.maxScale, Math.max(this.minScale, parsed));
  }

  private applyScale(value: number): void {
    this.document.documentElement.style.setProperty('--app-scale', String(value));
  }
}
