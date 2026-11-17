'use client';

import { carreRank, teamOfSeat } from '@/lib/game';
import type { StateView } from '@/lib/protocol';
import { PlayingCard } from './PlayingCard';

export function RevealOverlay({
  state,
  onReset,
}: {
  state: StateView;
  onReset: () => void;
}) {
  const result = state.result;
  const revealed = state.revealedHands;
  if (!result || !revealed) return null;

  const myTeam = state.yourSeat >= 0 ? teamOfSeat(state.yourSeat) : -1;
  const iWon = myTeam === result.winnerTeam;

  return (
    <div className="overlay">
      <div className="modal">
        <div className={`result-banner ${iWon ? 'win' : 'lose'}`}>
          {iWon ? '🏆 Your team wins!' : '💥 Your team loses'}
        </div>
        <p style={{ textAlign: 'center' }}>{result.reason}</p>

        <div className="reveal-grid">
          {state.players.map((p) => {
            const hand = revealed[p.pid] ?? [];
            const rank = carreRank(hand);
            return (
              <div
                key={p.pid}
                className={`reveal-player${rank ? ' carre' : ''}`}
              >
                <div className="rp-name">
                  <span className={`team-dot t${p.team}`} />
                  {p.name}
                  {rank && (
                    <span className="badge" style={{ marginLeft: 'auto' }}>
                      CARRÉ of {rank}s
                    </span>
                  )}
                </div>
                <div className="reveal-hand">
                  {hand.map((c) => (
                    <PlayingCard key={c.id} card={c} width={46} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button className="btn" onClick={onReset}>
          ♻ Play again
        </button>
      </div>
    </div>
  );
}
