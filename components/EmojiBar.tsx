'use client';

import { EMOJIS } from '@/lib/emojis';

export function EmojiBar({
  current,
  onPick,
}: {
  current: string | null;
  onPick: (emoji: string | null) => void;
}) {
  return (
    <div className="emoji-bar">
      {EMOJIS.map((e) => (
        <button
          key={e}
          className={`ebtn${current === e ? ' active' : ''}`}
          onClick={() => onPick(current === e ? null : e)}
          title="Broadcast this to everyone (signal… or bluff)"
        >
          {e}
        </button>
      ))}
      <button className="ebtn clear" onClick={() => onPick(null)} title="Clear">
        clear
      </button>
    </div>
  );
}
