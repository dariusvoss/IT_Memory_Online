import { Injectable, EventEmitter } from '@angular/core';
import { TimerService } from './timer.service';
import { FinishDialogComponent } from '../finish-dialog/finish-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';


@Injectable({
  providedIn: 'root'
})
export class GameService {
  isPlayerTurn: boolean = true; // Spieler ist als erstes am Zug
  gameStarted: boolean = false; // Gibt an, ob ein Spieldurchlauf bereits gestartet wurde
  gameEnded: EventEmitter<void> = new EventEmitter<void>(); // Event-Emitter für das Spielende
  private selectedCards: any[] = [];
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private botMemory: Map<number, number> = new Map(); // Bot speichert Karten (index -> id)
  private difficulty: 'Leicht' | 'Mittel' | 'Schwer' | 'None' = 'Leicht'; // Schwierigkeitsstufe
  private deckSize: string = '';
  private delay = 800; // Verzögerung allgemein
  private visibleDelay = 500; // Verzögerung für das Umdrehen der Karten nach dem Aufdecken


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
  //------------------------------------ Score-cookie ------------------------------------// 
  //--------------------------------------------------------------------------------------//

  /* encodeURIComponent: Kodiert den JSON-String, um sicherzustellen, dass er in Cookies gespeichert werden kann.
  // path=/: Der Cookie ist für die gesamte Website verfügbar.
  // max-age=31536000: Der Cookie ist 1 Jahr gültig (31536000 Sekunden). */
  private saveScoreboardToCookies() {
    const jsonString = JSON.stringify(this.gameRecords); // Scoreboard in JSON umwandeln
    document.cookie = `scoreboard=${encodeURIComponent(jsonString)}; path=/; max-age=31536000`; // 1 Jahr gültig
  }

  private loadScoreboardFromCookies(): any[] {  
    const cookies = document.cookie.split('; ');
    const scoreboardCookie = cookies.find(row => row.startsWith('scoreboard='));
    if (scoreboardCookie) {
      const jsonString = decodeURIComponent(scoreboardCookie.split('=')[1]);
      return JSON.parse(jsonString); // JSON in ein Array umwandeln
    }
    return []; // Leeres Array zurückgeben, wenn kein Scoreboard gefunden wurde
  }


  private addGameRecord(record: { date: string; mode: string; difficultyLevel: string; deckSize: string; points: string; rank: string; time: string }) {
    this.gameRecords.push(record);
    this.saveScoreboardToCookies(); // Speichere das Scoreboard nach jedem neuen Eintrag
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
    this.gameRecords = this.loadScoreboardFromCookies();
    console.log(this.gameRecords);
  }

  /** Initialisiert den Kartenstapel mit der gewählten Anzahl an Karten, ebenso wie die Bot-Logik */
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
      this.botMemory.clear();
      console.log('Bot-Logik initialisiert!');
    }
  }

  /** Setzt den GameService in seinen Initialzustand zurück, sodass der Spieler ein neues Spiel starten kann */
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

  /** Mischt die Karten mit dem Fisher-Yates-Algorithmus */
  private shuffleCards(cards: any[]): any[] {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  /** Gibt das aktuelle Kartendeck zurück */
  getCards() {
    return this.cards;
  }

  /** Dreht eine Karte um */
  flipCard(card: any) {

    if (this.selectedCards.length < 2 && !card.flipped && !card.matched) {
      card.flipped = true;
      this.selectedCards.push(card);

      // Ist der Bot am Zug und die Schwierigkeit ist 'Mittel' oder 'Schwer', wird die Karte gemerkt
      if (this.difficulty === 'Mittel' && !this.isPlayerTurn) {
        this.rememberCard(card);
      } else if (this.difficulty === 'Schwer') { // Der Bot merkt sich alle aufgedeckten Karten, auch wenn der Spieler am Zug ist
        this.rememberCard(card);
      }
    }

    if (this.selectedCards.length === 2) {
      setTimeout(() => this.checkMatch(), this.delay);
    }
  }

  /** Prüft, ob zwei Karten zusammenpassen */
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

      // Entferne die Karten des Paares aus dem botMemory
      this.selectedCards.forEach((card) => {
        if (this.botMemory.has(this.getCards().indexOf(card))) {
          this.botMemory.delete(this.getCards().indexOf(card));
          console.log(`Karte ${card.id} aus botMemory entfernt.`);
        }
      });
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
      let timerank = this.calculateRank(finTime, this.cards.length);
      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleString();

      const record = {
        date: formattedDate,
        mode: this.difficulty !== 'None' ? 'Spieler vs. Bot' : 'Spieler vs. Zeit',
        difficultyLevel: this.difficulty !== 'None' ? this.difficulty : '-',
        deckSize: this.getSelectedSize(this.cards.length),
        points: this.difficulty !== 'None' ? `${this.pairsFoundPlayer}` : '-',
        rank: this.difficulty === 'None' ? this.calculateRank(finTime, this.cards.length) : '-',
        time: this.difficulty === 'None' ? finTime : '-'
      };

      console.log('Spiel beendet!' + this.difficulty);
      // Öffne den Finish-Dialog und speichere die Referenz
      const modalRef = this.modalService.open(FinishDialogComponent, { centered: true });
      modalRef.componentInstance.time = finTime;
      modalRef.componentInstance.rank = timerank;
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
      } else {
        modalRef.componentInstance.message = '🎉 Glückwunsch! Du hast alle Paare gefunden!';
      }
      this.addGameRecord(record);
      console.log(this.gameRecords);
      this.resetGame();
      this.gameEnded.emit(); //Signalisierung des Spielendes
      return true;
    }
    return false;
  }

  /** Wechselt den Zug zwischen Spieler und Bot */
  private switchTurn() {
    setTimeout(() => {this.isPlayerTurn = !this.isPlayerTurn
      if (!this.isPlayerTurn && this.difficulty !== 'None') {
        console.log('Bot ist am Zug!');
        setTimeout(() => this.botMove(), this.delay); // Bot spielt nach einer kurzen Verzögerung
      } else {
        console.log('Spieler ist am Zug!');
      }
    } , this.visibleDelay);
  }

  //-------------------------------------------------------------------------------------//
  //------------------------------------- Bot-Logik -------------------------------------//
  //-------------------------------------------------------------------------------------//

  /** Bot-Aktion basierend auf Schwierigkeitsgrad */
  botMove() {
    const availableCards = this.getCards().filter(card => !card.flipped && !card.matched);

    if (this.difficulty === 'Leicht') {
      this.randomBotMove(availableCards);
    } else if (this.difficulty === 'Mittel' || 'Schwer') {
      this.botMemoryMove(availableCards);
    } else if (this.difficulty === 'None') {
      this.isPlayerTurn = true;
    }
  }

  /** Bot deckt zwei zufällige Karten auf */
  private randomBotMove(availableCards: any[]) {
    if (availableCards.length < 2) return;
    const firstCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    this.flipCard(firstCard);

    setTimeout(() => {
      const secondAvailable = this.getCards().filter(card => !card.flipped && !card.matched);
      const secondCard = secondAvailable[Math.floor(Math.random() * secondAvailable.length)];
      this.flipCard(secondCard);
    }, this.delay);
  }

  /** Bot schaut in botMemory, ob er sich zwei Karten für ein Paar gemerkt hat und deckt diese dann auf, ansonsten deckt er zwei zufällige Karten auf*/
  private botMemoryMove(availableCards: any[]) {
    if (availableCards.length < 2) return;

    // Prüfen, ob der Bot ein Paar kennt (zwei Einträge mit dem selben Value)
    let pairs: [number, number] | null = null;

    for (const [key1, value1] of this.botMemory) {
      for (const [key2, value2] of this.botMemory) {
        if (key1 !== key2 && value1 === value2) {
          pairs = [key1, key2]; // Speichere das erste gefundene Paar
          break;
        }
      }
      if (pairs) break; // Abbrechen, wenn ein Paar gefunden wurde
    }

    if (pairs) {
      const [index1, index2] = pairs;
      const card1 = availableCards.find(card => this.getCards().indexOf(card) === index1);
      const card2 = availableCards.find(card => this.getCards().indexOf(card) === index2);

      if (card1 && card2) {
        this.flipCard(card1);
        console.log(`Bot nimmt gemerkte Karte ${card1.id} an Index ${index1}.`);
        setTimeout(() => {
          this.flipCard(card2);
          console.log(`Bot nimmt gemerkte Karte ${card2.id} an Index ${index2}.`);
        }, this.delay); // Verzögerung beim Aufdecken der zweiten Karte
      }
      
      return;
    }

    // Zufällige Auswahl, wenn kein Paar bekannt ist
    this.randomBotMove(availableCards);
  }

  /** Bot merkt sich Karten */
  private rememberCard(card: any) {
    const maxMemorySize = this.getMaxMemorySize(); // Maximale Anzahl der Karten, die sich der Bot merken kann

    if (!card.matched) {
      // Wenn die Karte bereits in der Queue ist, nichts tun
      if (this.botMemory.has(this.getCards().indexOf(card))) return;

      // Wenn die Queue voll ist, das älteste Element entfernen
      if (this.botMemory.size >= maxMemorySize) {
        const firstKey = this.botMemory.keys().next().value; // Erstes Element in der Map
        if (firstKey !== undefined) {
          this.botMemory.delete(firstKey);
        }
      }

      // Neue Karte hinzufügen
      this.botMemory.set(this.getCards().indexOf(card), card.id);
      console.log('Bot merkt sich Karte ' + card.id + ' an Position ' + this.getCards().indexOf(card));
    }
  }

  private getMaxMemorySize(): number {
    const cardCount = this.cards.length;

    if (cardCount === 16) {
      return 4; // 4 Karten für Kartensatzgröße Klein (16 Karten)
    } else if (cardCount === 36) {
      return 8; // 8 Karten für Kartensatzgröße Mittel (36 Karten)
    } else if (cardCount === 64) {
      return 10; // 10 Karten für Kartensatzgröße Groß (64 Karten)
    }

    return 2; // Standardwert, falls keine Größe passt
  }
}
