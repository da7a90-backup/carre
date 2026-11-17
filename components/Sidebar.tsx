'use client';

import { useEffect, useRef, useState } from 'react';
import type { StateView } from '@/lib/protocol';

export function Sidebar({
  state,
  onSendChat,
  mobileOpen = false,
  onClose,
}: {
  state: StateView;
  onSendChat: (text: string) => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  const [text, setText] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const chatOpen = state.phase === 'lobby';

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [state.chat, state.log, tab]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSendChat(t);
    setText('');
  };

  return (
    <div className={`sidebar${mobileOpen ? ' open' : ''}`}>
      <div className="tabs">
        <button
          className={tab === 'chat' ? 'active' : ''}
          onClick={() => setTab('chat')}
        >
          🔒 Team chat
        </button>
        <button
          className={tab === 'log' ? 'active' : ''}
          onClick={() => setTab('log')}
        >
          📜 Game log
        </button>
        <button className="drawer-close mobile-only" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {tab === 'chat' ? (
        <>
          <div className="panel-body" ref={bodyRef}>
            {state.yourSeat < 0 ? (
              <div className="chat-closed">You are spectating.</div>
            ) : (
              <>
                <div className="chat-closed" style={{ marginBottom: 8 }}>
                  Private to your team. Agree on the emoji that means{' '}
                  <b style={{ color: 'var(--gold)' }}>“call my win!”</b>
                </div>
                {state.chat.length === 0 && (
                  <div className="chat-closed">No messages yet.</div>
                )}
                {state.chat.map((m, i) => (
                  <div
                    key={i}
                    className={`chat-msg${m.from === state.you ? ' me' : ''}`}
                  >
                    <span className="who">
                      {m.from === state.you ? 'You' : m.fromName}:
                    </span>{' '}
                    {m.text}
                  </div>
                ))}
              </>
            )}
          </div>
          {chatOpen && state.yourSeat >= 0 ? (
            <div className="chat-input">
              <input
                type="text"
                value={text}
                maxLength={300}
                placeholder="Message your partner…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button className="btn" onClick={send}>
                Send
              </button>
            </div>
          ) : (
            <div className="chat-closed">
              🔒 Team chat is closed once the round starts — talk by voice &
              emoji now.
            </div>
          )}
        </>
      ) : (
        <div className="panel-body" ref={bodyRef}>
          {state.log.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
