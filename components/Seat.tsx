'use client';

import type { PlayerView } from '@/lib/protocol';
import { PlayingCard } from './PlayingCard';

export type SeatRole = 'you' | 'partner' | 'opp' | 'empty';

const ROLE_LABEL: Record<SeatRole, string> = {
  you: 'You',
  partner: 'Partner',
  opp: 'Opponent',
  empty: '',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Seat({
  player,
  pos,
  role,
  isTurn,
  isSpeaking,
  isSelf,
  micOn,
  canCallWin,
  canCallCarre,
  onCallWin,
  onCallCarre,
}: {
  player?: PlayerView;
  pos: 'bottom' | 'right' | 'top' | 'left';
  role: SeatRole;
  isTurn: boolean;
  isSpeaking: boolean;
  isSelf: boolean;
  micOn: boolean;
  canCallWin: boolean;
  canCallCarre: boolean;
  onCallWin?: () => void;
  onCallCarre?: () => void;
}) {
  if (!player) {
    return (
      <div className={`seat pos-${pos}`}>
        <div className="avatar offline">·</div>
        <div className="nameplate" style={{ opacity: 0.6 }}>
          Waiting…
        </div>
      </div>
    );
  }

  return (
    <div className={`seat pos-${pos}`}>
      <div
        className={`avatar${isTurn ? ' turn' : ''}${
          player.connected ? '' : ' offline'
        }`}
      >
        {initials(player.name)}
        {player.emoji && <div className="emoji-bubble">{player.emoji}</div>}
        <div
          className={`mic${isSelf ? (micOn ? ' on' : '') : ' on'}${
            isSpeaking ? ' speaking' : ''
          }`}
          title={isSelf ? (micOn ? 'Your mic is on' : 'Your mic is off') : 'In voice chat'}
        >
          {isSelf ? (micOn ? '🎙️' : '🔇') : '🔊'}
        </div>
      </div>

      <div className="nameplate">
        <span className={`team-dot t${player.team}`} />
        <span>{player.name}</span>
        {isSelf && <span className="you-tag">(you)</span>}
      </div>
      <div className="role">
        {ROLE_LABEL[role]}
        {isTurn ? ' · has the extra card' : ''}
      </div>

      {player.handCount > 0 && (
        <div className="mini-cards">
          {Array.from({ length: player.handCount }).map((_, i) => (
            <PlayingCard key={i} faceDown width={34} />
          ))}
        </div>
      )}

      {canCallWin && (
        <button className="call-btn win" onClick={onCallWin}>
          ✓ Call {player.name}&apos;s win
        </button>
      )}
      {canCallCarre && (
        <button className="call-btn carre" onClick={onCallCarre}>
          👀 Suspect carré
        </button>
      )}
    </div>
  );
}
