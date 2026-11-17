import type { Card } from './game';

export type Phase = 'lobby' | 'playing' | 'revealed';

export interface PlayerView {
  pid: string;
  name: string;
  seat: number;
  team: 0 | 1;
  connected: boolean;
  emoji: string | null;
  handCount: number;
  peerId: string | null; // WebRTC address, used to form the audio mesh
}

export interface ChatMessage {
  from: string; // pid
  fromName: string;
  text: string;
  ts: number;
}

export interface GameResult {
  winnerTeam: 0 | 1;
  reason: string;
  calledByName: string;
  targetName: string;
  kind: 'win' | 'carre';
  success: boolean;
}

/** Personalized snapshot sent to one player (their own hand is full; others hidden). */
export interface StateView {
  roomId: string;
  phase: Phase;
  you: string; // pid
  yourSeat: number;
  players: PlayerView[]; // seat-ordered
  turnSeat: number; // seat currently holding 5 cards (must pass); -1 in lobby
  yourHand: Card[];
  log: string[];
  chat: ChatMessage[]; // only messages visible to your team
  result: GameResult | null;
  revealedHands: Record<string, Card[]> | null; // pid -> hand, only when revealed
}

// Player intent, applied by the host engine. Carried over a data channel.
export type Action =
  | { type: 'start' }
  | { type: 'pass'; cardId: string }
  | { type: 'emoji'; emoji: string | null }
  | { type: 'chat'; text: string }
  | { type: 'callWin'; target: string }
  | { type: 'callCarre'; target: string }
  | { type: 'reset' };

// Data-channel envelopes between peers.
export type NetMessage =
  | { k: 'hello'; pid: string; name: string; peerId: string }
  | { k: 'action'; action: Action }
  | { k: 'state'; state: StateView };
