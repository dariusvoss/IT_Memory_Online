import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private selectedCards: any[] = [];
  private pairsFound = 0;

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

  constructor() {
    this.initializeGame();
  }

   /** 🔄 Erstellt das Kartendeck und mischt es */
   initializeGame() {
    const selectedSize = parseInt(localStorage.getItem('selectedCardCount') || '16', 10);
    const selectedImages = this.cardImages.slice(0, selectedSize / 2);  // Nur so viele Bilder wie benötigt

    this.cards = selectedImages.flatMap((image, index) => [
      { id: index, image, flipped: false, matched: false },
      { id: index, image, flipped: false, matched: false },
    ]);

    this.cards = this.shuffleCards(this.cards);
    this.selectedCards = [];
    this.pairsFound = 0;
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
    }

    if (this.selectedCards.length === 2) {
      setTimeout(() => this.checkMatch(), 1000);
    }
  }

  /** ✅ Prüft, ob zwei Karten zusammenpassen */
  private checkMatch() {
    if (this.selectedCards[0].id === this.selectedCards[1].id) {
      // Karten passen zusammen -> bleiben aufgedeckt
      this.selectedCards.forEach((card) => (card.matched = true));
      this.pairsFound++;
    } else {
      // Karten passen nicht -> umdrehen
      this.selectedCards.forEach((card) => (card.flipped = false));
    }

    this.selectedCards = [];

    // Check, ob alle Paare gefunden wurden
    if (this.pairsFound === this.cards.length / 2) {
      alert('🎉 Glückwunsch! Du hast alle Paare gefunden!');
    }
  }
}