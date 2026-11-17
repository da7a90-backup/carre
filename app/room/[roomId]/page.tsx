'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getName, getPid, setName as persistName } from '@/lib/identity';
import { Game } from '@/components/Game';

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = (params.roomId || '').toLowerCase();

  const [pid, setPid] = useState('');
  const [name, setName] = useState('');
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPid(getPid());
    const n = getName();
    setName(n);
    setInput(n);
    if (n) setReady(true);
  }, []);

  const confirm = () => {
    const n = input.trim();
    if (!n) return;
    persistName(n);
    setName(n);
    setReady(true);
  };

  if (!pid) return null;

  if (!ready) {
    return (
      <div className="landing">
        <div className="landing-card">
          <div className="brand">
            <span className="pips">♠♥♦♣</span>
            <h1>CARRÉ</h1>
          </div>
          <p className="sub">
            You&apos;re joining table <b style={{ color: 'var(--gold)' }}>{roomId}</b>.
            Pick a name to take a seat.
          </p>
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              value={input}
              maxLength={20}
              autoFocus
              placeholder="e.g. Nedhirou"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
            />
          </label>
          <button className="btn" disabled={!input.trim()} onClick={confirm}>
            Take a seat
          </button>
        </div>
      </div>
    );
  }

  return <Game roomId={roomId} pid={pid} name={name} />;
}
