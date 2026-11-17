'use client';

import { useId } from 'react';
import { type Card, type Suit } from '@/lib/game';

const SUIT_PATH: Record<Suit, string> = {
  H: 'M12 21.3C12 21.3 2.8 14.3 2.8 8.6C2.8 5.5 5.2 3.3 8.1 3.3C10 3.3 11.3 4.4 12 5.6C12.7 4.4 14 3.3 15.9 3.3C18.8 3.3 21.2 5.5 21.2 8.6C21.2 14.3 12 21.3 12 21.3Z',
  D: 'M12 2.3L20.3 12L12 21.7L3.7 12Z',
  S: 'M12 2.6C12 2.6 3.8 9 3.8 14.1C3.8 16.8 5.6 18.5 7.9 18.5C9.2 18.5 10.3 17.9 10.9 17C10.7 18.8 10 20.4 8.7 21.4L15.3 21.4C14 20.4 13.3 18.8 13.1 17C13.7 17.9 14.8 18.5 16.1 18.5C18.4 18.5 20.2 16.8 20.2 14.1C20.2 9 12 2.6 12 2.6Z',
  C: '',
};

const SUIT_COLOR: Record<Suit, string> = {
  H: '#b3202e',
  D: '#b3202e',
  S: '#16181f',
  C: '#16181f',
};
const SUIT_GLYPH: Record<Suit, string> = { H: '♥', D: '♦', S: '♠', C: '♣' };

function SuitShape({ suit, color }: { suit: Suit; color: string }) {
  if (suit === 'C') {
    return (
      <g fill={color}>
        <circle cx="12" cy="7.6" r="4.4" />
        <circle cx="7.6" cy="13.2" r="4.4" />
        <circle cx="16.4" cy="13.2" r="4.4" />
        <path d="M10.4 13C10.4 17 9.7 20 8.6 21.5L15.4 21.5C14.3 20 13.6 17 13.6 13Z" />
      </g>
    );
  }
  return <path d={SUIT_PATH[suit]} fill={color} />;
}

function Pip({
  suit,
  color,
  x,
  y,
  size,
}: {
  suit: Suit;
  color: string;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24">
      <SuitShape suit={suit} color={color} />
    </svg>
  );
}

// Court ornaments, drawn centered on local origin (base near y=11).
function Ornament({ rank, gold, dark, accent }: { rank: 'K' | 'Q' | 'J'; gold: string; dark: string; accent: string }) {
  if (rank === 'Q') {
    return (
      <g stroke={dark} strokeWidth="0.7" strokeLinejoin="round">
        <path d="M-18 10 C-17 1 -12 0 -9 5 C-7 -5 0 -8 0 -8 C0 -8 7 -5 9 5 C12 0 17 1 18 10 Z" fill={gold} />
        <rect x="-18" y="9.5" width="36" height="5" rx="1.6" fill={gold} />
        <circle cx="-9" cy="3" r="1.7" fill="#fff4d2" stroke="none" />
        <circle cx="0" cy="-9" r="2.1" fill={accent} stroke="none" />
        <circle cx="9" cy="3" r="1.7" fill="#fff4d2" stroke="none" />
        <circle cx="-9" cy="12" r="1" fill={dark} stroke="none" />
        <circle cx="0" cy="12" r="1" fill={dark} stroke="none" />
        <circle cx="9" cy="12" r="1" fill={dark} stroke="none" />
      </g>
    );
  }
  if (rank === 'J') {
    return (
      <g stroke={dark} strokeWidth="0.7" strokeLinejoin="round">
        <path d="M0 -14 C-3.4 -6.5 -3.4 -1 0 2.5 C3.4 -1 3.4 -6.5 0 -14 Z" fill={gold} />
        <path d="M0 2.5 C-7.5 -3 -12.5 -1 -11.5 5 C-10.5 10.5 -4 8.5 0 3.5 Z" fill={gold} />
        <path d="M0 2.5 C7.5 -3 12.5 -1 11.5 5 C10.5 10.5 4 8.5 0 3.5 Z" fill={gold} />
        <rect x="-8.5" y="3.5" width="17" height="3.4" rx="1.4" fill={gold} />
        <path d="M-4.5 6.5 L0 15 L4.5 6.5 Z" fill={gold} />
        <circle cx="0" cy="-3" r="1.5" fill={accent} stroke="none" />
      </g>
    );
  }
  return (
    <g stroke={dark} strokeWidth="0.7" strokeLinejoin="round">
      <path d="M-20 10 L-16 -6 L-8 2.5 L0 -13 L8 2.5 L16 -6 L20 10 Z" fill={gold} />
      <rect x="-20" y="9.5" width="40" height="5" rx="1.6" fill={gold} />
      <circle cx="-16" cy="-6" r="2" fill="#fff4d2" stroke="none" />
      <circle cx="0" cy="-13" r="2.5" fill={accent} stroke="none" />
      <circle cx="16" cy="-6" r="2" fill="#fff4d2" stroke="none" />
      <circle cx="-11" cy="12" r="1.1" fill={dark} stroke="none" />
      <circle cx="0" cy="12" r="1.1" fill={dark} stroke="none" />
      <circle cx="11" cy="12" r="1.1" fill={dark} stroke="none" />
    </g>
  );
}

export function PlayingCard({
  card,
  faceDown = false,
  width = 86,
}: {
  card?: Card;
  faceDown?: boolean;
  width?: number;
}) {
  const height = Math.round(width * 1.4);
  const uid = useId().replace(/[:]/g, '');
  const ivory = `iv-${uid}`;
  const goldId = `gd-${uid}`;
  const tintId = `tn-${uid}`;
  const gold = `url(#${goldId})`;
  const goldDark = '#8a6a1f';

  const Defs = () => (
    <defs>
      <linearGradient id={ivory} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#fffdf6" />
        <stop offset="1" stopColor="#f3eede" />
      </linearGradient>
      <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f3d884" />
        <stop offset="0.5" stopColor="#d7ab45" />
        <stop offset="1" stopColor="#a9801f" />
      </linearGradient>
    </defs>
  );

  if (faceDown || !card) {
    return (
      <svg className="pc" width={width} height={height} viewBox="0 0 100 140">
        <defs>
          <linearGradient id={`bk-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#223a63" />
            <stop offset="1" stopColor="#152442" />
          </linearGradient>
          <pattern id={`lt-${uid}`} width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 6.5H13M6.5 0V13" stroke="rgba(227,179,65,0.22)" strokeWidth="1.1" />
          </pattern>
          <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3d884" />
            <stop offset="1" stopColor="#a9801f" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#fff" />
        <rect x="4" y="4" width="92" height="132" rx="8" fill={`url(#bk-${uid})`} />
        <rect x="4" y="4" width="92" height="132" rx="8" fill={`url(#lt-${uid})`} />
        <rect x="8" y="8" width="84" height="124" rx="6" fill="none" stroke={gold} strokeWidth="1.3" opacity="0.8" />
        <g transform="translate(50 70)">
          <path d="M0 -26L19 0L0 26L-19 0Z" fill="none" stroke={gold} strokeWidth="1.6" />
          <path d="M0 -17L13 0L0 17L-13 0Z" fill={gold} opacity="0.95" />
          <text x="0" y="5.5" fontSize="16" fontWeight="800" fontFamily="Georgia, serif" fill="#152442" textAnchor="middle">C</text>
        </g>
      </svg>
    );
  }

  if (card.rank === 'JOKER') {
    const purple = '#6a3fb5';
    return (
      <svg className="pc" width={width} height={height} viewBox="0 0 100 140">
        <Defs />
        <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill={`url(#${ivory})`} stroke="#d9cfb0" strokeWidth="0.9" />
        <rect x="6.5" y="6.5" width="87" height="127" rx="7" fill="none" stroke={purple} strokeWidth="1" opacity="0.5" />
        <rect x="8.6" y="8.6" width="82.8" height="122.8" rx="5.6" fill="none" stroke={gold} strokeWidth="0.7" opacity="0.6" />
        <g fontFamily="Georgia, serif" fill={purple}>
          <text x="10" y="22" fontSize="15" fontWeight="800" textAnchor="middle">★</text>
          <text x="90" y="124" fontSize="15" fontWeight="800" textAnchor="middle" transform="rotate(180 90 119)">★</text>
        </g>
        <g transform="translate(50 62)">
          <path d="M-20 10C-22 -6 -14 -16 0 -16C14 -16 22 -6 20 10Z" fill={purple} />
          <path d="M-20 10L-30 -2" stroke={purple} strokeWidth="5" strokeLinecap="round" />
          <path d="M20 10L30 -2" stroke={purple} strokeWidth="5" strokeLinecap="round" />
          <path d="M0 -16L0 -28" stroke={purple} strokeWidth="5" strokeLinecap="round" />
          <circle cx="-31" cy="-3" r="3.4" fill={gold} />
          <circle cx="31" cy="-3" r="3.4" fill={gold} />
          <circle cx="0" cy="-29" r="3.4" fill={gold} />
          <circle cx="0" cy="16" r="13" fill="#f6e7c8" />
          <circle cx="-5" cy="13" r="1.8" fill="#16181f" />
          <circle cx="5" cy="13" r="1.8" fill="#16181f" />
          <path d="M-6 20C-3 24 3 24 6 20" fill="none" stroke="#16181f" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <text x="50" y="114" fontSize="12.5" fontWeight="800" letterSpacing="2.5" fontFamily="Georgia, serif" fill={purple} textAnchor="middle">JOKER</text>
      </svg>
    );
  }

  const suit = card.suit!;
  const color = SUIT_COLOR[suit];
  const rank = card.rank;
  const accent = suit === 'H' || suit === 'D' ? '#8a6a1f' : '#b3202e';

  return (
    <svg className="pc" width={width} height={height} viewBox="0 0 100 140">
      <Defs />
      <defs>
        <linearGradient id={tintId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.1" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* body + double frame */}
      <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill={`url(#${ivory})`} stroke="#d9cfb0" strokeWidth="0.9" />
      <rect x="6.5" y="6.5" width="87" height="127" rx="7" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <rect x="8.6" y="8.6" width="82.8" height="122.8" rx="5.6" fill="none" stroke={gold} strokeWidth="0.7" opacity="0.55" />

      {/* corner indices */}
      <g>
        <text x="10.5" y="23" fontSize="16" fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif" fill={color} textAnchor="middle">{rank}</text>
        <Pip suit={suit} color={color} x={6.5} y={25} size={8} />
      </g>
      <g transform="rotate(180 50 70)">
        <text x="10.5" y="23" fontSize="16" fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif" fill={color} textAnchor="middle">{rank}</text>
        <Pip suit={suit} color={color} x={6.5} y={25} size={8} />
      </g>

      {rank === 'A' ? (
        <g>
          <circle cx="50" cy="70" r="31" fill="none" stroke={gold} strokeWidth="1" opacity="0.5" />
          <circle cx="50" cy="70" r="27" fill="none" stroke={color} strokeWidth="0.8" opacity="0.28" />
          <Pip suit={suit} color={color} x={25} y={45} size={50} />
          <Pip suit={suit} color="#c9a23a" x={47} y={37} size={6} />
          <Pip suit={suit} color="#c9a23a" x={47} y={97} size={6} />
        </g>
      ) : (
        <g>
          <rect x="16" y="18" width="68" height="104" rx="8" fill={`url(#${tintId})`} stroke={gold} strokeWidth="0.7" opacity="0.9" />
          <g transform="translate(50 34)">
            <Ornament rank={rank} gold={gold} dark={goldDark} accent={accent} />
          </g>
          <line x1="26" y1="72" x2="37" y2="72" stroke={gold} strokeWidth="1.2" />
          <line x1="63" y1="72" x2="74" y2="72" stroke={gold} strokeWidth="1.2" />
          <text x="50" y="85" fontSize="40" fontWeight="800" fontFamily="Georgia, 'Times New Roman', serif" fill={color} textAnchor="middle">{rank}</text>
          <Pip suit={suit} color={color} x={42} y={95} size={16} />
        </g>
      )}
    </svg>
  );
}
