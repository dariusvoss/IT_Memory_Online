import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class GameService {
  private isPlayerTurn: boolean = true; // Startet mit dem Spieler
  private selectedCards: any[] = [];
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private botMemory: Map<number, number> = new Map(); // Bot speichert Karten (id -> index)
  private difficulty: 'easy' | 'medium' | 'hard' = 'easy'; // Schwierigkeitsstufe

  private cardImages = [
    'assets/images/Sample_Memory_Card_01.jpg',
    'assets/images/Sample_Memory_Card_02.jpg',
    'assets/images/Sample_Memory_Card_03.jpg',
    'assets/images/Sample_Memory_Card_04.jpg',
    'assets/images/Sample_Memory_Card_05.jpg',
    'assets/images/Sample_Memory_Card_06.jpg',
    'assets/images/Sample_Memory_Card_07.jpg',
    'assets/images/Sample_Memory_Card_08.jpg'
  ];

  private cards: { id: number; image: string; flipped: boolean; matched: boolean }[] = [];
  

  constructor() {
    this.initializeGame();
    this.setDifficulty('easy');
  }

  

   /** 🔄 Erstellt das Kartendeck und mischt es */
   initializeGame() {
    this.cards = this.cardImages.flatMap((image, index) => [
      { id: index, image, flipped: false, matched: false },
      { id: index, image, flipped: false, matched: false },
    ]);

    this.cards = this.shuffleCards(this.cards);
    this.selectedCards = [];
    this.pairsFound = 0;
    this.isPlayerTurn = true; // Spieler beginnt
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
      console.log(this.selectedCards);
    }

    if (this.selectedCards.length === 2) {
      setTimeout(() => this.checkMatch(), 1000);
    }
  }

  /** ✅ Prüft, ob zwei Karten zusammenpassen */
  private checkMatch() {
    let isPair = false;
    if (this.selectedCards[0].id === this.selectedCards[1].id) {
      // Karten passen zusammen -> bleiben aufgedeckt
      this.selectedCards.forEach((card) => (card.matched = true));
      this.pairsFound++;
      console.log('Paar gefunden!');
      isPair = true;
    } else {
      // Karten passen nicht -> umdrehen
      this.selectedCards.forEach((card) => (setTimeout(() => card.flipped = false),500));
      console.log('Kein Paar gefunden!');
    }

    this.selectedCards = [];

    // Check, ob alle Paare gefunden wurden
    if (this.pairsFound === this.cardImages.length) {
      if(this.pairsFoundPlayer > this.pairsFoundBot){
        alert('🎉 Glückwunsch! Du hast gewonnen!');
      }else if(this.pairsFoundPlayer < this.pairsFoundBot){
        alert('😢 Schade! Der Bot hat gewonnen!');
      }
      else{
        alert('😐 Unentschieden!');
      }
      return;
    }

    if (!isPair) {
    // Zug wechseln
    this.switchTurn();
    }else if (!this.isPlayerTurn){
      this.pairsFoundBot++;
      setTimeout(() => this.botMove(), 1000); // Bot spielt nach einer kurzen Verzögerung
    }
    else{
      this.pairsFoundPlayer++;
    }
    console.log('Player: ' + this.pairsFoundPlayer + ' Bot: ' + this.pairsFoundBot);
  }

  /** 🔄 Wechselt den Zug zwischen Spieler und Bot */
  private switchTurn() {
    this.isPlayerTurn = !this.isPlayerTurn;

    if (!this.isPlayerTurn) {
      console.log('Bot ist am Zug!');
      setTimeout(() => this.botMove(), 1000); // Bot spielt nach einer kurzen Verzögerung
    } else {
      console.log('Spieler ist am Zug!');
    }
  }
  //-------------------------------------------------------------------------------------//
  //------------------------------------- Bot-Logik -------------------------------------//
  //-------------------------------------------------------------------------------------//

  /** Setzt die Schwierigkeitsstufe */
  setDifficulty(level: 'easy' | 'medium' | 'hard') {
    this.difficulty = level;
  }

  /** 🤖 Bot-Aktion basierend auf Schwierigkeitsgrad */
  botMove() {
    const availableCards = this.getCards().filter(card => !card.flipped && !card.matched);

    if (this.difficulty === 'easy') {
      this.randomBotMove(availableCards);
    } else if (this.difficulty === 'medium') {
      this.mediumBotMove(availableCards);
    } else if (this.difficulty === 'hard') {
      this.hardBotMove(availableCards);
    }
  }

  private randomBotMove(availableCards: any[]) {
    if (availableCards.length < 2) return;

    const firstCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    this.flipCard(firstCard);
    // console.log(firstCard);

    setTimeout(() => {
      const secondAvailable = this.getCards().filter(card => !card.flipped && !card.matched);
      const secondCard = secondAvailable[Math.floor(Math.random() * secondAvailable.length)];
      this.flipCard(secondCard);
      // console.log(secondCard);
    }, 500);
    setTimeout(() => this.checkMatch(), 3000);
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
  rememberCard(card: any) {
    if (!card.matched) {
      this.botMemory.set(card.id, this.getCards().indexOf(card));
    }
  }


}