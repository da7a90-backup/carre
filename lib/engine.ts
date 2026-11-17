// Authoritative game engine. Runs inside the HOST peer's browser.
// It owns the full truth (all hands); it emits a redacted StateView per player
// which the host ships to each peer over a WebRTC data channel.

import {
  type Card,
  carreRank,
  deal,
  nextSeat,
  partnerSeat,
  teamOfSeat,
} from './game';
import type {
  Action,
  ChatMessage,
  GameResult,
  Phase,
  PlayerView,
  StateView,
} from './protocol';

interface EnginePlayer {
  pid: string;
  name: string;
  seat: number;
  connected: boolean;
  emoji: string | null;
  peerId: string | null;
}

export class RoomEngine {
  readonly roomId: string;
  phase: Phase = 'lobby';
  private players = new Map<string, EnginePlayer>();
  private hands: Record<string, Card[]> = {};
  private turnSeat = -1;
  private log: string[] = ['Room created. Waiting for 4 players…'];
  private chat: ChatMessage[] = [];
  private result: GameResult | null = null;
  private revealedHands: Record<string, Card[]> | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  // ---------- membership ----------

  private seated(): EnginePlayer[] {
    return [...this.players.values()]
      .filter((p) => p.seat >= 0)
      .sort((a, b) => a.seat - b.seat);
  }

  private bySeat(seat: number): EnginePlayer | undefined {
    return this.seated().find((p) => p.seat === seat);
  }

  private nextFreeSeat(): number {
    const taken = new Set(this.seated().map((p) => p.seat));
    for (let s = 0; s < 4; s++) if (!taken.has(s)) return s;
    return -1;
  }

  /** Returns the full list of pids after the change (for broadcasting). */
  join(pid: string, name: string, peerId: string | null): void {
    const existing = this.players.get(pid);
    if (existing) {
      existing.connected = true;
      existing.peerId = peerId;
      if (name) existing.name = name;
      return;
    }
    const seat = this.nextFreeSeat();
    this.players.set(pid, {
      pid,
      name: name || `Player ${this.players.size + 1}`,
      seat,
      connected: true,
      emoji: null,
      peerId,
    });
    if (seat >= 0) this.push(`${name || 'A player'} sat down (seat ${seat + 1}).`);
  }

  setConnected(pid: string, connected: boolean): void {
    const p = this.players.get(pid);
    if (p && p.connected !== connected) {
      p.connected = connected;
      if (!connected) this.push(`${p.name} disconnected.`);
    }
  }

  pids(): string[] {
    return [...this.players.keys()];
  }

  // ---------- actions ----------

  apply(fromPid: string, action: Action): void {
    switch (action.type) {
      case 'emoji': {
        const p = this.players.get(fromPid);
        if (p) p.emoji = action.emoji;
        break;
      }
      case 'chat': {
        const p = this.players.get(fromPid);
        if (!p || p.seat < 0 || this.phase !== 'lobby') break;
        const text = String(action.text ?? '').slice(0, 300).trim();
        if (!text) break;
        this.chat.push({ from: fromPid, fromName: p.name, text, ts: Date.now() });
        if (this.chat.length > 200) this.chat = this.chat.slice(-200);
        break;
      }
      case 'start':
        this.startGame();
        break;
      case 'pass':
        this.doPass(fromPid, action.cardId);
        break;
      case 'callWin':
        this.doCallWin(fromPid, action.target);
        break;
      case 'callCarre':
        this.doCallCarre(fromPid, action.target);
        break;
      case 'reset':
        this.resetToLobby();
        break;
    }
  }

  private startGame(): void {
    const seated = this.seated();
    if (seated.length !== 4 || !seated.every((p) => p.connected)) return;
    if (this.phase === 'playing') return;

    const { hands, startSeat } = deal();
    this.hands = {};
    for (const p of seated) {
      this.hands[p.pid] = hands[p.seat];
      p.emoji = null;
    }
    this.turnSeat = startSeat;
    this.phase = 'playing';
    this.result = null;
    this.revealedHands = null;
    const starter = this.bySeat(startSeat);
    this.log = [
      'Cards dealt. The game begins!',
      `${starter?.name ?? 'A player'} holds the extra card and passes first.`,
    ];
  }

  private doPass(pid: string, cardId: string): void {
    if (this.phase !== 'playing') return;
    const p = this.players.get(pid);
    if (!p || p.seat !== this.turnSeat) return;
    const hand = this.hands[pid];
    if (!hand || hand.length !== 5) return;
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx < 0) return;

    const [card] = hand.splice(idx, 1);
    const toSeat = nextSeat(p.seat);
    const target = this.bySeat(toSeat);
    if (!target) {
      hand.splice(idx, 0, card);
      return;
    }
    this.hands[target.pid] = (this.hands[target.pid] ?? []).concat(card);
    this.turnSeat = toSeat;
    this.push(`${p.name} passed a card to ${target.name}.`);
  }

  private revealAll(): void {
    const snap: Record<string, Card[]> = {};
    for (const p of this.seated()) snap[p.pid] = (this.hands[p.pid] ?? []).slice();
    this.revealedHands = snap;
    this.phase = 'revealed';
  }

  private doCallWin(callerPid: string, targetPid: string): void {
    if (this.phase !== 'playing') return;
    const caller = this.players.get(callerPid);
    const target = this.players.get(targetPid);
    if (!caller || !target || caller.seat < 0 || target.seat < 0) return;
    if (caller.pid === target.pid) return;
    if (partnerSeat(caller.seat) !== target.seat) return; // partners only

    const rank = carreRank(this.hands[target.pid] ?? []);
    const success = rank !== null;
    const callerTeam = teamOfSeat(caller.seat);
    const winnerTeam: 0 | 1 = success ? callerTeam : (((callerTeam + 1) % 2) as 0 | 1);

    this.revealAll();
    this.result = {
      kind: 'win',
      calledByName: caller.name,
      targetName: target.name,
      success,
      winnerTeam,
      reason: success
        ? `${caller.name} called ${target.name}'s carré of ${rank}s — confirmed!`
        : `${caller.name} called a win on ${target.name}, but there was no carré. The call fails.`,
    };
    this.push(this.result.reason);
  }

  private doCallCarre(callerPid: string, targetPid: string): void {
    if (this.phase !== 'playing') return;
    const caller = this.players.get(callerPid);
    const target = this.players.get(targetPid);
    if (!caller || !target || caller.seat < 0 || target.seat < 0) return;
    if (caller.pid === target.pid) return;
    if (teamOfSeat(caller.seat) === teamOfSeat(target.seat)) return; // opponents only

    const rank = carreRank(this.hands[target.pid] ?? []);
    const success = rank !== null; // correctly suspected a carré
    const callerTeam = teamOfSeat(caller.seat);
    const winnerTeam: 0 | 1 = success ? callerTeam : (((callerTeam + 1) % 2) as 0 | 1);

    this.revealAll();
    this.result = {
      kind: 'carre',
      calledByName: caller.name,
      targetName: target.name,
      success,
      winnerTeam,
      reason: success
        ? `${caller.name} busted ${target.name}'s hidden carré of ${rank}s — the suspicion was right!`
        : `${caller.name} suspected ${target.name} of a carré, but was wrong. The bluff holds.`,
    };
    this.push(this.result.reason);
  }

  private resetToLobby(): void {
    this.phase = 'lobby';
    this.hands = {};
    this.turnSeat = -1;
    this.result = null;
    this.revealedHands = null;
    for (const p of this.players.values()) p.emoji = null;
    this.log = ['New round. Agree on your signal and press Start when ready.'];
  }

  private push(text: string): void {
    this.log.push(text);
    if (this.log.length > 200) this.log = this.log.slice(-200);
  }

  // ---------- redacted view ----------

  viewFor(pid: string): StateView {
    const me = this.players.get(pid);
    const mySeat = me?.seat ?? -1;
    const myTeam = mySeat >= 0 ? teamOfSeat(mySeat) : -1;

    const players: PlayerView[] = this.seated().map((p) => ({
      pid: p.pid,
      name: p.name,
      seat: p.seat,
      team: teamOfSeat(p.seat),
      connected: p.connected,
      emoji: p.emoji,
      handCount: this.hands[p.pid]?.length ?? 0,
      peerId: p.peerId,
    }));

    const chat = this.chat.filter((m) => {
      const s = this.players.get(m.from)?.seat ?? -1;
      return s >= 0 && teamOfSeat(s) === myTeam;
    });

    return {
      roomId: this.roomId,
      phase: this.phase,
      you: pid,
      yourSeat: mySeat,
      players,
      turnSeat: this.turnSeat,
      yourHand: this.hands[pid] ?? [],
      log: this.log.slice(-60),
      chat,
      result: this.result,
      revealedHands: this.phase === 'revealed' ? this.revealedHands : null,
    };
  }
}
