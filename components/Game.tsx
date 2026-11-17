'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nextSeat, partnerSeat, teamOfSeat } from '@/lib/game';
import type { PlayerView } from '@/lib/protocol';
import { usePeerNet } from '@/hooks/usePeerNet';
import { Seat, type SeatRole } from './Seat';
import { EmojiBar } from './EmojiBar';
import { Sidebar } from './Sidebar';
import { RevealOverlay } from './RevealOverlay';
import { PlayingCard } from './PlayingCard';

const POS = ['bottom', 'right', 'top', 'left'] as const;

export function Game({
  roomId,
  pid,
  name,
}: {
  roomId: string;
  pid: string;
  name: string;
}) {
  const router = useRouter();
  const net = usePeerNet({ roomId, pid, name });
  const { state } = net;
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const onLeave = () => {
    if (window.confirm('Leave this room?')) {
      net.leave();
      setTimeout(() => router.push('/'), 120);
    }
  };

  const myEmoji = useMemo(() => {
    if (!state) return null;
    return state.players.find((p) => p.pid === state.you)?.emoji ?? null;
  }, [state]);

  if (!state) {
    return (
      <div className="room">
        <Topbar
          roomId={roomId}
          net={net}
          onCopy={() => {}}
          copied={false}
          onLeave={onLeave}
          onToggleChat={() => {}}
          showChatToggle={false}
        />
        <div className="main" style={{ gridTemplateColumns: '1fr' }}>
          <div className="table-wrap">
            <div className="table">
              <div className="table-center">
                <div className="waiting">
                  <div className="big">
                    {net.status === 'host-missing'
                      ? 'Reconnecting to the table…'
                      : net.status === 'error'
                        ? net.statusDetail || 'Connection trouble. Please reload.'
                        : 'Connecting to the table'}
                  </div>
                  {net.status === 'error' ? (
                    <button
                      className="btn"
                      style={{ width: 'auto', marginTop: 12 }}
                      onClick={() => window.location.reload()}
                    >
                      ↻ Reload
                    </button>
                  ) : (
                    <div className="dots" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bySeat = (seat: number): PlayerView | undefined =>
    state.players.find((p) => p.seat === seat);

  const mySeat = state.yourSeat;
  const isPlaying = state.phase === 'playing';
  const myTurn = isPlaying && mySeat === state.turnSeat;
  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = state.phase === 'lobby' && connectedCount === 4;

  const turnPlayer = bySeat(state.turnSeat);
  const passTarget = isPlaying ? bySeat(nextSeat(mySeat)) : undefined;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const doPass = () => {
    if (!selected) return;
    net.dispatch({ type: 'pass', cardId: selected });
    setSelected(null);
  };

  // Build the 4 seats, relative to me (me at the bottom).
  const seats = POS.map((pos, rel) => {
    const seatNum = mySeat >= 0 ? (mySeat + rel) % 4 : rel;
    const player = bySeat(seatNum);
    const isSelf = rel === 0 && mySeat >= 0;
    let role: SeatRole = 'empty';
    if (player) {
      if (rel === 0) role = 'you';
      else if (rel === 2) role = 'partner';
      else role = 'opp';
    }
    const isTurn = !!player && isPlaying && player.seat === state.turnSeat;
    const speakingKey = isSelf ? 'self' : player?.peerId ?? '';
    const isSpeaking = !!net.speaking[speakingKey];

    // Partner (rel 2) can be called for a win; opponents (rel 1,3) can be suspected.
    const canCallWin =
      isPlaying && !isSelf && !!player && player.seat === partnerSeat(mySeat);
    const canCallCarre =
      isPlaying &&
      !isSelf &&
      !!player &&
      teamOfSeat(player.seat) !== teamOfSeat(mySeat);

    return (
      <Seat
        key={pos}
        player={player}
        pos={pos}
        role={role}
        isTurn={isTurn}
        isSpeaking={isSpeaking}
        isSelf={isSelf}
        micOn={net.micOn}
        canCallWin={canCallWin}
        canCallCarre={canCallCarre}
        onCallWin={() =>
          player && net.dispatch({ type: 'callWin', target: player.pid })
        }
        onCallCarre={() =>
          player &&
          window.confirm(
            `Suspect ${player.name} is holding a carré? If you're right your team wins; if you're wrong your team loses.`,
          ) &&
          net.dispatch({ type: 'callCarre', target: player.pid })
        }
      />
    );
  });

  return (
    <div className="room">
      <Topbar
        roomId={roomId}
        net={net}
        onCopy={copyLink}
        copied={copied}
        onLeave={onLeave}
        onToggleChat={() => setDrawerOpen((v) => !v)}
        showChatToggle
      />

      <div className="main">
        <div className="table-wrap">
          <div className="table">
            {seats}

            <div className="table-center">
              {state.phase === 'lobby' ? (
                <div className="big">
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    Table {roomId}
                  </div>
                  {connectedCount < 4 ? (
                    <>
                      Waiting for players — <b>{connectedCount}/4</b> seated.
                      <br />
                      Share the link to invite friends.
                    </>
                  ) : (
                    <>Everyone&apos;s here. Agree on your signal, then start.</>
                  )}
                </div>
              ) : state.phase === 'playing' ? (
                <div className="big">
                  {myTurn ? (
                    <span className="turn">
                      You hold the extra card — pass one to {passTarget?.name}.
                    </span>
                  ) : (
                    <>
                      Waiting for <b>{turnPlayer?.name}</b> to pass…
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* your hand */}
          <div className="hand-dock">
            <div className="pass-hint">
              {state.phase === 'lobby' && canStart && net.isHost && (
                <button className="btn ghost" onClick={() => net.dispatch({ type: 'start' })}>
                  ▶ Deal &amp; start the round
                </button>
              )}
              {state.phase === 'lobby' &&
                canStart &&
                !net.isHost &&
                'All 4 seated — waiting for the host to start the round…'}
              {state.phase === 'lobby' && !canStart && 'Waiting for 4 players to begin…'}
              {isPlaying &&
                myTurn &&
                (selected
                  ? `Pass the selected card to ${passTarget?.name}?`
                  : 'Tap a card to pass it onward.')}
              {isPlaying && !myTurn && 'Collect four of a kind. Signal your partner when you do.'}
            </div>

            <div className="hand">
              {state.yourHand.map((card) => {
                const selectable = myTurn;
                return (
                  <div
                    key={card.id}
                    className={`card-slot${selectable ? ' selectable' : ''}${
                      selected === card.id ? ' selected' : ''
                    }`}
                    onClick={() =>
                      selectable &&
                      setSelected(selected === card.id ? null : card.id)
                    }
                  >
                    <PlayingCard card={card} width={92} />
                  </div>
                );
              })}
              {state.yourHand.length === 0 && state.phase !== 'lobby' && (
                <div className="big">Your hand will appear here.</div>
              )}
            </div>

            {myTurn && selected && (
              <button className="btn" style={{ width: 'auto' }} onClick={doPass}>
                → Pass to {passTarget?.name}
              </button>
            )}
          </div>
        </div>

        {drawerOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <Sidebar
          state={state}
          onSendChat={(text) => net.dispatch({ type: 'chat', text })}
          mobileOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </div>

      <EmojiBar
        current={myEmoji}
        onPick={(emoji) => net.dispatch({ type: 'emoji', emoji })}
      />

      {state.phase === 'revealed' && (
        <RevealOverlay
          state={state}
          onReset={() => net.dispatch({ type: 'reset' })}
        />
      )}
    </div>
  );
}

function Topbar({
  roomId,
  net,
  onCopy,
  copied,
  onLeave,
  onToggleChat,
  showChatToggle,
}: {
  roomId: string;
  net: ReturnType<typeof usePeerNet>;
  onCopy: () => void;
  copied: boolean;
  onLeave: () => void;
  onToggleChat: () => void;
  showChatToggle: boolean;
}) {
  return (
    <div className="topbar">
      <span className="logo">♠ CARRÉ</span>
      <span className="roomcode">
        <b>{roomId}</b>
        {net.isHost && <span className="badge" style={{ marginLeft: 8 }}>host</span>}
      </span>
      <div className="spacer" />

      {showChatToggle && (
        <button
          className="icon-btn mobile-only"
          onClick={onToggleChat}
          title="Team chat & log"
        >
          💬
        </button>
      )}

      {net.needsReloadForMic ? (
        <button
          className="icon-btn muted"
          onClick={() => window.location.reload()}
          title="Grant mic permission and reconnect"
        >
          🔇<span className="lbl"> Enable mic</span>
        </button>
      ) : (
        <button
          className={`icon-btn ${net.micOn ? 'on' : 'muted'}`}
          onClick={net.toggleMic}
          title={net.micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {net.micOn ? '🎙️' : '🔇'}
          <span className="lbl">{net.micOn ? ' Mic on' : ' Muted'}</span>
        </button>
      )}

      <button className="icon-btn" onClick={net.unlockAudio} title="If you can't hear anyone">
        🔊<span className="lbl"> Sound</span>
      </button>

      <button className="icon-btn" onClick={onCopy} title="Copy invite link">
        {copied ? '✓' : '🔗'}
        <span className="lbl">{copied ? ' Copied' : ' Invite'}</span>
      </button>

      <button className="icon-btn danger-btn" onClick={onLeave} title="Leave room">
        🚪<span className="lbl"> Leave</span>
      </button>
    </div>
  );
}
