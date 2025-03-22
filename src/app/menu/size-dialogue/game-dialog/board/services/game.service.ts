import { Injectable, EventEmitter } from '@angular/core';
import { TimerService } from './timer.service';
import { FinishDialogComponent } from '../finish-dialog/finish-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';


@Injectable({
  providedIn: 'root'
})
export class GameService {
  isPlayerTurn: boolean = true; // Startet mit dem Spieler
  gameStarted: boolean = false; // Gibt an, ob ein Spieldurchlauf bereits gestartet wurde
  gameEnded: EventEmitter<void> = new EventEmitter<void>(); // Event-Emitter für das Spielende
  private selectedCards: any[] = [];
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private botMemory: Map<number, number> = new Map(); // Bot speichert Karten (id -> index)
  private difficulty: 'Leicht' | 'Mittel' | 'Schwer' | 'None' = 'Leicht'; // Schwierigkeitsstufe
  private deckSize: string = '';
  // private botDelay = 3000; // Verzögerung für den Bot
  private delay = 800; // Verzögerung verzögerung allgemein
  private visibleDelay = 500; // Verzögerung für das Umdrehen der Karten


  //-------------------------------------------------------------------------------------//
  //----------------------------------- Getter/Setter -----------------------------------//
  //-------------------------------------------------------------------------------------//

  public get pairsFoundPlayerGetter(): number {
    return this.pairsFoundPlayer;
  }

  public get pairsFoundBotGetter(): number {
    return this.pairsFoundBot;
  }

  public get difficultyGetter(): string {
    return this.difficulty;
  }

  public setDifficulty(level: 'Leicht' | 'Mittel' | 'Schwer' | 'None') {
    this.difficulty = level;
    //  console.log(this.difficulty);
  } 

  private getSelectedSize(selectedSize: number): string {
    if (selectedSize === 16) {
      this.deckSize = 'Klein (16 Karten)';
    } else if (selectedSize === 36) {
      this.deckSize = 'Mittel (36 Karten)';
    } else if (selectedSize === 64) {
      this.deckSize = 'Groß (64 Karten)';
    }
    return this.deckSize;
  }

  public getGameRecords() {
    return this.gameRecords;
  }

  //--------------------------------------------------------------------------------------//
  //------------------------------------- Game-Logik -------------------------------------//
  //--------------------------------------------------------------------------------------//


  private cardImages = [
    'assets/images/Memory_Card_01.jpg',
    'assets/images/Memory_Card_02.jpg',
    'assets/images/Memory_Card_03.jpg',
    'assets/images/Memory_Card_04.jpg',
    'assets/images/Memory_Card_05.jpg',
    'assets/images/Memory_Card_06.jpg',
    'assets/images/Memory_Card_07.jpg',
    'assets/images/Memory_Card_08.jpg',
    'assets/images/Memory_Card_09.jpg',
    'assets/images/Memory_Card_10.jpg',
    'assets/images/Memory_Card_11.jpg',
    'assets/images/Memory_Card_12.jpg',
    'assets/images/Memory_Card_13.jpg',
    'assets/images/Memory_Card_14.jpg',
    'assets/images/Memory_Card_15.jpg',
    'assets/images/Memory_Card_16.jpg',
    'assets/images/Memory_Card_17.jpg',
    'assets/images/Memory_Card_18.jpg',
    'assets/images/Memory_Card_19.jpg',
    'assets/images/Memory_Card_20.jpg',
    'assets/images/Memory_Card_21.jpg',
    'assets/images/Memory_Card_22.jpg',
    'assets/images/Memory_Card_23.jpg',
    'assets/images/Memory_Card_24.jpg',
    'assets/images/Memory_Card_25.jpg',
    'assets/images/Memory_Card_26.jpg',
    'assets/images/Memory_Card_27.jpg',
    'assets/images/Memory_Card_28.jpg',
    'assets/images/Memory_Card_29.jpg',
    'assets/images/Memory_Card_30.jpg',
    'assets/images/Memory_Card_31.jpg',
    'assets/images/Memory_Card_32.jpg'
  ];

  private cards: { id: number; image: string; flipped: boolean; matched: boolean }[] = [];
  private gameRecords: { date: string; mode: string; difficultyLevel: string; deckSize: string; points: string; rank: string; time: string }[] = [];
  private selectedImages: string[] = [];

  constructor(private timerService: TimerService, private modalService: NgbModal) {
    console.log('GameService');
  }

  /** 🔄 Erstellt das Kartendeck und mischt es */
  initializeGame(cardCount: number) {
    const selectedSize = cardCount;
    this.selectedImages = this.cardImages.slice(0, selectedSize / 2);

    this.cards = this.selectedImages.flatMap((image, index) => [
      { id: index, image, flipped: false, matched: false },
      { id: index, image, flipped: false, matched: false },
    ]);

    this.cards = this.shuffleCards(this.cards);
    this.selectedCards = [];
    this.pairsFound = 0;
    this.gameStarted = true;

    if (this.difficulty !== 'None') {
    // Bot-Logik initialisieren, falls erforderlich
    }
  }

  /**Setzt den GameService in seinen Initialzustand zurück, sodass der Spieler ein neues Spiel starten kann*/
  resetGame() {
    this.cards.forEach(card => {
      card.flipped = false;
      card.matched = false;
    });
    this.selectedCards = [];
    this.pairsFound = 0;
    this.pairsFoundPlayer = 0;
    this.pairsFoundBot = 0;
    this.botMemory.clear();
    this.gameStarted = false;
    this.isPlayerTurn = true;
    this.timerService.resetTimer();
    this.difficulty = 'Leicht';
  }

  /** 🎴 Mischt die Karten mit dem Fisher-Yates-Algorithmus */
  private shuffleCards(cards: any[]): any[] {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  /** 📋 Gibt das aktuelle Kartendeck zurück */
  getCards() {
    return this.cards;
  }

  /** 🎭 Karte umdrehen */
  flipCard(card: any) {

    if (this.selectedCards.length < 2 && !card.flipped && !card.matched) {
      card.flipped = true;
      this.selectedCards.push(card);

      // ist der Bot am Zug und die Schwierigkeit ist medium oder hard, wird die Karte gemerkt
      if (this.difficulty === 'Mittel' && !this.isPlayerTurn) {
        this.rememberCard(card);
      } else if (this.difficulty === 'Schwer') { // Der Bot merkt sich immer die Karten auch wenn der Spieler am Zug ist
        this.rememberCard(card);
      }
      // console.log(this.selectedCards);
      // console.log(this.botMemory);
    }

    if (this.selectedCards.length === 2) {
      setTimeout(() => this.checkMatch(), this.delay);
    }
  }

  /** ✅ Prüft, ob zwei Karten zusammenpassen */
  private checkMatch() {
    let isPair = false;
    if (this.selectedCards[0].id === this.selectedCards[1].id) {
      // Karten passen zusammen -> bleiben aufgedeckt
      this.selectedCards.forEach((card) => (card.matched = true));
      this.pairsFound++;
      if (this.difficulty === 'None' || this.isPlayerTurn) {
        this.pairsFoundPlayer++;
      } else {  // Bot
        this.pairsFoundBot++; // Bot hat ein Paar gefunden 
      }
      isPair = true;
    } else {
      // Karten passen nicht -> umdrehen
      this.selectedCards.forEach((card) => (setTimeout(() => card.flipped = false, this.visibleDelay)));
    }

    this.selectedCards = [];

    // Check, ob alle Paare gefunden wurden
    if (isPair) {
      setTimeout(() => { if (this.checkWin()) return; }, this.delay / 2);
    }

    // Wenn kein Paar gefunden wurde, wird gewechselt
    if (!isPair) {
      // Zug wechseln (nur, wenn Spieler im Modus "Spieler vs. Bot" spielt)
      if (this.difficulty !== 'None') {
        this.switchTurn();
      }
    } else if (!this.isPlayerTurn) {
      setTimeout(() => this.botMove(), this.delay); // Bot spielt nach einer kurzen Verzögerung
    }
  }

  private calculateRank(time: string, deckSize: number): string {
    const [minutes, seconds] = time.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;

    if (deckSize === 16) {
      if (totalSeconds < 60) return 'A';
      if (totalSeconds < 120) return 'B';
      if (totalSeconds < 180) return 'C';
      if (totalSeconds < 240) return 'D';
      return 'E';
    } else if (deckSize === 36) {
      if (totalSeconds < 120) return 'A';
      if (totalSeconds < 240) return 'B';
      if (totalSeconds < 360) return 'C';
      if (totalSeconds < 480) return 'D';
      return 'E';
    } else if (deckSize === 64) {
      if (totalSeconds < 180) return 'A';
      if (totalSeconds < 360) return 'B';
      if (totalSeconds < 540) return 'C';
      if (totalSeconds < 720) return 'D';
      return 'E';
    }
    return 'E';
  }

  checkWin() {
    if (this.pairsFound === this.selectedImages.length) {
      this.timerService.stopTimer();
      let finTime = this.timerService.getFormattedTimer();
      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleString();
      console.log('Spiel beendet!' + this.difficulty);
      // Öffne den Finish-Dialog und speichere die Referenz
      const modalRef = this.modalService.open(FinishDialogComponent, { centered: true });
      modalRef.componentInstance.time = finTime;
      modalRef.componentInstance.playerPoints = this.pairsFoundPlayer;
      modalRef.componentInstance.botPoints = this.pairsFoundBot;
      modalRef.componentInstance.difficulty = this.difficulty;

      if (this.difficulty !== 'None') {
        if (this.pairsFoundPlayer > this.pairsFoundBot) {
          modalRef.componentInstance.message = '🎉 Glückwunsch! Du hast gewonnen!';
        } else if (this.pairsFoundPlayer < this.pairsFoundBot) {
          modalRef.componentInstance.message = '😢 Schade! Der Bot hat gewonnen!';
        } else {
          modalRef.componentInstance.message = '😐 Unentschieden!';
        }
        this.gameRecords.push({
          date: formattedDate,
          mode: 'Spieler vs. Bot',
          difficultyLevel: this.difficulty,
          deckSize: this.getSelectedSize(this.cards.length),
          points: `${this.pairsFoundPlayer}`,
          rank: '-',
          time: '-'
        });
      } else {
        modalRef.componentInstance.message = '🎉 Glückwunsch! Du hast alle Paare gefunden!';
        const rank = this.calculateRank(finTime, this.cards.length);
        this.gameRecords.push({
          date: formattedDate,
          mode: 'Spieler vs. Zeit',
          difficultyLevel: '-',
          deckSize: this.getSelectedSize(this.cards.length),
          points: '-',
          rank: rank,
          time: finTime
        });
      }
      this.resetGame();
      this.gameEnded.emit(); //Signalisierung des Spielendes
      return true;
    }
    return false;
  }

  /** 🔄 Wechselt den Zug zwischen Spieler und Bot */
  private switchTurn() {
    this.isPlayerTurn = !this.isPlayerTurn;

    if (!this.isPlayerTurn && this.difficulty !== 'None') {
      console.log('Bot ist am Zug!');
      setTimeout(() => this.botMove(), this.delay); // Bot spielt nach einer kurzen Verzögerung
    } else {
      console.log('Spieler ist am Zug!');
    }
  }

  //-------------------------------------------------------------------------------------//
  //------------------------------------- Bot-Logik -------------------------------------//
  //-------------------------------------------------------------------------------------//

  /** 🤖 Bot-Aktion basierend auf Schwierigkeitsgrad */
  botMove() {
    const availableCards = this.getCards().filter(card => !card.flipped && !card.matched);

    if (this.difficulty === 'Leicht') {
      this.randomBotMove(availableCards);
      // console.log('easy');
    } else if (this.difficulty === 'Mittel') {
      this.mediumBotMove(availableCards);
      // this.botDelay = Math.round(this.botDelay * 1.05);  // Verzögerung für den Bot verlängert sich bei jedem Zug
      // console.log('medium');
    } else if (this.difficulty === 'Schwer') {
      this.hardBotMove(availableCards);
      // this.botDelay = Math.round(this.botDelay * 1.07);  // Verzögerung für den Bot verlängert sich bei jedem Zug
      // console.log('hard');
    } else if (this.difficulty === 'None') {
      this.isPlayerTurn = true;
    }
    // console.log(this.botDelay);
  }

  private randomBotMove(availableCards: any[]) {
    if (availableCards.length < 2) return;
    // console.log(availableCards.length);
    const firstCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    this.flipCard(firstCard);
    // console.log(firstCard);

    setTimeout(() => {
      const secondAvailable = this.getCards().filter(card => !card.flipped && !card.matched);
      const secondCard = secondAvailable[Math.floor(Math.random() * secondAvailable.length)];
      this.flipCard(secondCard);
      // console.log(secondCard);
    }, this.delay);
    // setTimeout(() =>{console.log('hallo'); this.checkMatch();}, 100000);// wird nicht ausgeführt
  }

  private mediumBotMove(availableCards: any[]) {
    if (availableCards.length < 2) return;

    // Prüfen, ob der Bot ein Paar kennt
    for (const [id, index] of this.botMemory) {
      const pair = availableCards.filter(card => card.id === id);
      if (pair.length === 2) {
        pair.forEach(card => this.flipCard(card));
        return;
      }
    }

    // Zufällige Auswahl, wenn kein Paar bekannt ist
    this.randomBotMove(availableCards);
  }

  private hardBotMove(availableCards: any[]) {
    if (availableCards.length < 2) return;
    // console.log('bot hard');

    // Prüfen, ob der Bot ein Paar kennt (inkl. Spieler-Karten)
    for (const [id, index] of this.botMemory) {
      const pair = availableCards.filter(card => card.id === id);
      if (pair.length === 2) {
        pair.forEach(card => this.flipCard(card));
        return;
      }
    }

    // Zufällige Auswahl, wenn kein Paar bekannt ist
    this.randomBotMove(availableCards);
  }

  /** 🧠 Bot merkt sich Karten */
  // mögliche Verbesserung: Bot merkt sich nur die Karten letzten 3 züge (botMemory.size <= 3)
  rememberCard(card: any) {
    if (!card.matched) {
      this.botMemory.set(card.id, this.getCards().indexOf(card));
      console.log('Bot merkt sich Karte ' + card.id + ' an Position ' + this.getCards().indexOf(card));
      console.log(this.botMemory);
    }
  }
}
