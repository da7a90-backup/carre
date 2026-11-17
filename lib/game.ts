// Pure card + game logic for "Carré".
// 16 face/ace cards (K, Q, J, A in 4 suits) + 1 joker ("the odd card").
// 4 players, 2 teams. Goal: hold all 4 cards of one rank (a "carré").

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | 'K' | 'Q' | 'J';
export type CardRank = Rank | 'JOKER';

export interface Card {
  id: string;
  rank: CardRank;
  suit?: Suit;
}

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J'];
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export const JOKER: Card = { id: 'JOKER', rank: 'JOKER' };

export const RANK_LABEL: Record<CardRank, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  JOKER: '★',
};

export function buildRankDeck(): Card[] {
  const cards: Card[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      cards.push({ id: `${r}${s}`, rank: r, suit: s });
    }
  }
  return cards; // 16 cards
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Deal 4 rank-cards to every seat, then hand the joker (the extra non-tribe
 * card) to one random seat — that player starts with 5 cards and must pass.
 */
export function deal(): { hands: Card[][]; startSeat: number } {
  const deck = shuffle(buildRankDeck());
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < 16; i++) {
    hands[i % 4].push(deck[i]);
  }
  const startSeat = Math.floor(Math.random() * 4);
  hands[startSeat] = hands[startSeat].concat({ ...JOKER });
  return { hands, startSeat };
}

/** Returns the completed rank if the 4-card hand is a carré, else null. */
export function carreRank(hand: Card[]): Rank | null {
  if (hand.length !== 4) return null;
  const r = hand[0].rank;
  if (r === 'JOKER') return null;
  return hand.every((c) => c.rank === r) ? (r as Rank) : null;
}

export function hasCarre(hand: Card[]): boolean {
  return carreRank(hand) !== null;
}

export const teamOfSeat = (seat: number): 0 | 1 => (seat % 2 === 0 ? 0 : 1);
export const partnerSeat = (seat: number): number => (seat + 2) % 4;
export const nextSeat = (seat: number): number => (seat + 1) % 4;
