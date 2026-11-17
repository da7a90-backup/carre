'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getName, makeRoomId, setName as persistName } from '@/lib/identity';

export default function Landing() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    setName(getName());
  }, []);

  const go = (roomId: string) => {
    persistName(name);
    router.push(`/room/${roomId}`);
  };

  const create = () => {
    if (!name.trim()) return;
    go(makeRoomId());
  };

  const join = () => {
    const c = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!name.trim() || !c) return;
    go(c);
  };

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="brand">
          <span className="pips">♠♥♦♣</span>
          <h1>CARRÉ</h1>
        </div>
        <p className="sub">
          A 2-vs-2 bluffing card game. Collect four of a kind, secretly signal
          your partner, and have them call your win — before a suspicious
          opponent snipes you. Voice chat is always on.
        </p>

        <label className="field">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder="e.g. Nedhirou"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </label>

        <button className="btn" disabled={!name.trim()} onClick={create}>
          ♠ Create a table
        </button>

        <div style={{ height: 18 }} />

        <label className="field">
          <span>Have a room code?</span>
          <input
            type="text"
            value={code}
            placeholder="e.g. k7m2p9x"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
        </label>
        <button
          className="btn secondary"
          disabled={!name.trim() || !code.trim()}
          onClick={join}
        >
          Join table
        </button>

        <p className="hint">
          Share the room link with 3 friends — 4 players, 2 teams. No account
          needed.
        </p>
      </div>
    </div>
  );
}
