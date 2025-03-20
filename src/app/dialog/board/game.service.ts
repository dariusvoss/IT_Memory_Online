import { Inject, Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class GameService {
  isPlayerTurn: boolean = true; // Startet mit dem Spieler
  private selectedCards: any[] = [];
  private pairsFound = 0;
  private pairsFoundPlayer = 0;
  private pairsFoundBot = 0;
  private botMemory: Map<number, number> = new Map(); // Bot speichert Karten (id -> index)
  private difficulty: 'easy' | 'medium' | 'hard' | 'none'  = 'none'; // Schwierigkeitsstufe
  private botDelay = 3000; // Verzögerung für den Bot
  private delay = 1000; // Verzögerung verzögerung allgemein
  private visibleDelay = 1500; // Verzögerung für das Umdrehen der Karten

  public get pairsFoundPlayerGetter(): number {
    return this.pairsFoundPlayer; 
  }
  public get pairsFoundBotGetter(): number { 
    return this.pairsFoundBot; 
  } 

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
  

  /** Setzt die Schwierigkeitsstufe */
  setDifficulty(level: 'easy' | 'medium' | 'hard' | 'none') {
   this.difficulty = level;
  //  console.log(this.difficulty);
 }
  

  constructor() {
    console.log(this.difficulty);
    this.initializeGame();
    // this.setDifficulty('easy');
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

      // ist der Bot am Zug und die Schwierigkeit ist medium oder hard, wird die Karte gemerkt
      if(this.difficulty === 'medium' && !this.isPlayerTurn){
        this.rememberCard(card);
      }else if(this.difficulty === 'hard' ){ // Der Bot merkt sich immer die Karten auch wenn der Spieler am Zug ist
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
      // console.log('Paar gefunden!');
      isPair = true;
    } else {
      // Karten passen nicht -> umdrehen
      this.selectedCards.forEach((card) => (setTimeout(() => card.flipped = false, this.visibleDelay)));
      // console.log('Kein Paar gefunden!');
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
    // Wenn kein Paar gefunden wurde, wird gewechselt
    if (!isPair) {
    // Zug wechseln
    this.switchTurn();
    }else if (!this.isPlayerTurn){
      this.pairsFoundBot++;
      setTimeout(() => this.botMove(), this.delay); // Bot spielt nach einer kurzen Verzögerung
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

    if (this.difficulty === 'easy') {
      this.randomBotMove(availableCards);
      // console.log('easy');
    } else if (this.difficulty === 'medium') {
      this.mediumBotMove(availableCards);
      // this.botDelay = Math.round(this.botDelay * 1.05);  // Verzögerung für den Bot verlängert sich bei jedem Zug
      // console.log('medium');
    } else if (this.difficulty === 'hard') {
      this.hardBotMove(availableCards);
      // this.botDelay = Math.round(this.botDelay * 1.07);  // Verzögerung für den Bot verlängert sich bei jedem Zug
      // console.log('hard');
    }else if (this.difficulty === 'none') {
      this.isPlayerTurn = true;
    }
    console.log(this.botDelay);
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
    console.log('bot hard');

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