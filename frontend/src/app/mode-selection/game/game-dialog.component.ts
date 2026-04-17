import { Component, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BoardComponent } from './board/board.component';
import { GameService } from '../../shared/services/game.service';
import { TimerService } from '../../shared/services/timer.service';
import { Subscription } from 'rxjs';

interface BonusEffectSlot {
  id: string;
  label: string;
  description: string;
  iconPath: string;
  isReady: boolean;
  isUsed: boolean;
  isAssigned: boolean;
  isClickable: boolean;
}

interface BonusEffectCatalogEntry {
  id: string;
  label: string;
  description: string;
  iconPath: string;
}

@Component({
  selector: 'app-dialog',
  imports: [BoardComponent],
  templateUrl: './game-dialog.component.html',
  styleUrls: ['./game-dialog.component.css']
})
export class GameDialogComponent implements OnInit, OnDestroy {
  @Input() mode: string = ''; // Game mode as entry parameter
  @Input() sessionId: string = '';
  @Input() sessionData: any;
  gameService = inject(GameService);
  private timer: TimerService = inject(TimerService);
  private currentTime: number = 0;
  private gameEndedSubscription: Subscription = new Subscription;
  readonly bonusPlaceholderPath = 'assets/icons/effect-placeholder.svg';

  private readonly bonusEffectCatalog: BonusEffectCatalogEntry[] = [
    {
      id: 'time_bonus',
      label: 'Zeitbonus',
      description: 'Reduziert deine aktuelle Zeit.',
      iconPath: 'assets/icons/time_bonus.svg'
    },
    {
      id: 'skip_turn',
      label: 'Aussetzen',
      description: 'Gegner setzt die nächste Runde aus.',
      iconPath: 'assets/icons/skip_turn.svg'
    },
    {
      id: 'scouting_bonus',
      label: 'Scouting-Bonus',
      description: 'Zusätzliche Karte nur für dich aufdecken.',
      iconPath: 'assets/icons/scouting_bonus.svg'
    },
    {
      id: 'card_medium',
      label: 'Kartenmedium',
      description: 'Partnerkarte privat sehen.',
      iconPath: 'assets/icons/card_medium.svg'
    },
    {
      id: 'whirlwind',
      label: 'Wirbelwind',
      description: 'Mischt alle Karten neu durch.',
      iconPath: 'assets/icons/whirlwind.svg'
    }
  ];

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {
    if (this.sessionId) {
      this.gameService.initializeMultiplayerSession(this.sessionId, this.sessionData).subscribe({
        next: () => console.log('Multiplayer session loaded:', this.sessionId),
        error: (error) => console.error('Error loading multiplayer session:', error)
      });
    }

    if (this.mode === 'PvT' || this.gameService.gameModeGetter === 'singleplayer_time') {
      this.timer.getTimer().subscribe(time => this.currentTime = time); // Subscribe to the timer observable
    }

    this.gameEndedSubscription = this.gameService.gameEnded.subscribe(() => {
      this.closeModal('game-ended');
    });
  }

  ngOnDestroy() {
    if (this.gameEndedSubscription) {
      this.gameEndedSubscription.unsubscribe();
    }
    // Stop multiplayer polling when dialog is closed
    this.gameService.stopPolling();
  }

  get time(): string {
    return this.timer.getFormattedTimer();
  }

  get botPoints(): number {
    return this.gameService.pairsFoundBotGetter;
  }

  get playerPoints(): number {
    return this.gameService.pairsFoundPlayerGetter;
  }

  get isPlayerTurn(): boolean {
    return this.gameService.isPlayerTurn;
  }

  get showManualBonusButton(): boolean {
    return this.gameService.showManualBonusButton;
  }

  get canTriggerBonusEffect(): boolean {
    return this.gameService.canTriggerBonusEffect;
  }

  get bonusButtonLabel(): string {
    return this.gameService.readyBonusEffectLabel;
  }

  get currentImage(): string {
    return this.timer.isTimerRunning ? '../assets/icons/Stop.png' : '../assets/icons/Play.png';
  }

  get showBonusSidebar(): boolean {
    return this.gameService.showManualBonusButton;
  }

  get bonusEffectSlots(): BonusEffectSlot[] {
    const currentBonusState = this.gameService.currentBonusState;
    const readyEffects = currentBonusState?.ready_effects ?? [];
    const usedEffects = currentBonusState?.used_effects ?? [];
    const readyEffectIds = new Set(readyEffects.map(effect => effect.id));
    const usedEffectIds = new Set(usedEffects.map(effect => effect.id));

    return this.bonusEffectCatalog
      .filter((effect) => this.isEffectVisibleForCurrentMode(effect.id))
      .map((effect) => {
      const matchingReadyEffect = readyEffects.find(readyEffect => readyEffect.id === effect.id);
      const matchingUsedEffect = usedEffects.find(usedEffect => usedEffect.id === effect.id);
      const isReady = readyEffectIds.has(effect.id);
      const isUsed = usedEffectIds.has(effect.id);
      const isAssigned = isReady || isUsed;

      return {
        id: effect.id,
        label: matchingReadyEffect?.label ?? matchingUsedEffect?.label ?? effect.label,
        description: matchingReadyEffect?.description ?? matchingUsedEffect?.description ?? effect.description,
        iconPath: effect.iconPath,
        isReady,
        isUsed,
        isAssigned,
        isClickable: isReady && this.canTriggerBonusEffect && !isUsed
      };
    });
  }

  private isEffectVisibleForCurrentMode(effectId: string): boolean {
    const isTimeMode = this.gameService.gameModeGetter === 'singleplayer_time';

    if (effectId === 'time_bonus') {
      return isTimeMode;
    }

    if (effectId === 'skip_turn') {
      return !isTimeMode;
    }

    return true;
  }

  triggerBonusEffect(): void {
    this.gameService.triggerReadyBonusEffect();
  }

  triggerBonusEffectById(effectId: string): void {
    if (!this.canTriggerBonusEffect) {
      return;
    }

    this.gameService.triggerReadyBonusEffect(effectId);
  }

  handleBonusImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.src.endsWith('effect-placeholder.svg')) {
      return;
    }

    target.src = this.bonusPlaceholderPath;
  }

  stopResumeTimerBtn() {
    if (this.timer.isTimerRunning) {
      this.timer.stopTimer();
    } else {
      this.timer.startTimer();
    }
  }


  closeModal(reason: string = 'closed') {
    this.timer.stopTimer();
    this.activeModal.close(reason);
  }
}
