'use client';

import { type Card, type Suit } from '@/lib/game';

const SUIT_PATH: Record<Suit, string> = {
  H: 'M12 21.3C12 21.3 2.8 14.3 2.8 8.6C2.8 5.5 5.2 3.3 8.1 3.3C10 3.3 11.3 4.4 12 5.6C12.7 4.4 14 3.3 15.9 3.3C18.8 3.3 21.2 5.5 21.2 8.6C21.2 14.3 12 21.3 12 21.3Z',
  D: 'M12 2.3L20.3 12L12 21.7L3.7 12Z',
  S: 'M12 2.6C12 2.6 3.8 9 3.8 14.1C3.8 16.8 5.6 18.5 7.9 18.5C9.2 18.5 10.3 17.9 10.9 17C10.7 18.8 10 20.4 8.7 21.4L15.3 21.4C14 20.4 13.3 18.8 13.1 17C13.7 17.9 14.8 18.5 16.1 18.5C18.4 18.5 20.2 16.8 20.2 14.1C20.2 9 12 2.6 12 2.6Z',
  C: '',
};

const SUIT_COLOR: Record<Suit, string> = {
  H: '#c62828',
  D: '#c62828',
  S: '#15181f',
  C: '#15181f',
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

/** A suit symbol drawn at (x,y) with the given pixel size, on the 0..100x140 card grid. */
function Pip({
  suit,
  color,
  x,
  y,
  size,
  flip = false,
}: {
  suit: Suit;
  color: string;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={flip ? { transform: `rotate(180deg)`, transformOrigin: `${x + size / 2}px ${y + size / 2}px` } : undefined}
    >
      <SuitShape suit={suit} color={color} />
    </svg>
  );
}

function Crown({ rank, color }: { rank: 'K' | 'Q' | 'J'; color: string }) {
  const gold = '#d9a62e';
  const goldDark = '#a9801f';
  if (rank === 'Q') {
    return (
      <g>
        <path
          d="M5 20C5 12.5 8.5 10.5 11 14.5C12.8 8.5 16 6.5 20 6.5C24 6.5 27.2 8.5 29 14.5C31.5 10.5 35 12.5 35 20Z"
          fill={gold}
          stroke={goldDark}
          strokeWidth="1"
        />
        <rect x="5" y="20" width="30" height="3.4" rx="1" fill={gold} stroke={goldDark} strokeWidth="0.6" />
        <circle cx="11" cy="13" r="1.8" fill="#f5e6b8" />
        <circle cx="20" cy="5.5" r="2" fill="#f5e6b8" />
        <circle cx="29" cy="13" r="1.8" fill="#f5e6b8" />
      </g>
    );
  }
  if (rank === 'J') {
    return (
      <g>
        <path d="M8 21L20 6L32 21Z" fill={color} opacity="0.18" />
        <path
          d="M7 20L9.5 11L15 15.5L20 8L25 15.5L30.5 11L33 20Z"
          fill={gold}
          stroke={goldDark}
          strokeWidth="1"
        />
        <rect x="7" y="20" width="26" height="3" rx="1" fill={gold} stroke={goldDark} strokeWidth="0.6" />
        <path d="M20 8C20 4 22 2 24 1" fill="none" stroke={goldDark} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="24.4" cy="0.8" r="1.6" fill="#e05d4a" />
      </g>
    );
  }
  return (
    <g>
      <path
        d="M4 20L6 8L13 15L20 4L27 15L34 8L36 20Z"
        fill={gold}
        stroke={goldDark}
        strokeWidth="1"
      />
      <rect x="4" y="20" width="32" height="3.4" rx="1" fill={gold} stroke={goldDark} strokeWidth="0.6" />
      <circle cx="6" cy="8" r="2" fill="#f5e6b8" />
      <circle cx="20" cy="4" r="2.2" fill="#e05d4a" />
      <circle cx="34" cy="8" r="2" fill="#f5e6b8" />
    </g>
  );
}

function CornerIndex({
  rank,
  suit,
  color,
  flip,
}: {
  rank: string;
  suit?: Suit;
  color: string;
  flip?: boolean;
}) {
  const tx = flip ? 100 : 0;
  const ty = flip ? 140 : 0;
  return (
    <g transform={flip ? `translate(${tx} ${ty}) rotate(180)` : undefined}>
      <text
        x="9"
        y="20"
        fontSize="17"
        fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={color}
        textAnchor="middle"
      >
        {rank}
      </text>
      {suit && (
        <text x="9" y="34" fontSize="14" fill={color} textAnchor="middle">
          {SUIT_GLYPH[suit]}
        </text>
      )}
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

  if (faceDown || !card) {
    return (
      <svg className="pc" width={width} height={height} viewBox="0 0 100 140">
        <defs>
          <linearGradient id="backg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b1b1b" />
            <stop offset="1" stopColor="#5e0f0f" />
          </linearGradient>
          <pattern id="lattice" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="12" height="12" fill="none" />
            <path d="M0 6H12M6 0V12" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" />
          </pattern>
        </defs>
        <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#fff" />
        <rect x="4" y="4" width="92" height="132" rx="8" fill="url(#backg)" />
        <rect x="4" y="4" width="92" height="132" rx="8" fill="url(#lattice)" />
        <rect x="9" y="9" width="82" height="122" rx="6" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" />
        <g transform="translate(50 70)">
          <path d="M0 -22L20 0L0 22L-20 0Z" fill="none" stroke="#e3b341" strokeWidth="2" />
          <path d="M0 -13L12 0L0 13L-12 0Z" fill="#e3b341" opacity="0.9" />
          <text x="0" y="5" fontSize="15" fontWeight="800" fontFamily="Georgia, serif" fill="#5e0f0f" textAnchor="middle">C</text>
        </g>
      </svg>
    );
  }

  if (card.rank === 'JOKER') {
    const purple = '#6a3fb5';
    return (
      <svg className="pc" width={width} height={height} viewBox="0 0 100 140">
        <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#fff" stroke="#d9d2c0" strokeWidth="1" />
        <CornerIndex rank="★" color={purple} />
        <CornerIndex rank="★" color={purple} flip />
        <g transform="translate(50 60)">
          {/* jester hat */}
          <path d="M-20 10C-22 -6 -14 -16 0 -16C14 -16 22 -6 20 10Z" fill={purple} />
          <path d="M-20 10L-30 -2" stroke={purple} strokeWidth="5" strokeLinecap="round" />
          <path d="M20 10L30 -2" stroke={purple} strokeWidth="5" strokeLinecap="round" />
          <path d="M0 -16L0 -28" stroke={purple} strokeWidth="5" strokeLinecap="round" />
          <circle cx="-31" cy="-3" r="3.4" fill="#e3b341" />
          <circle cx="31" cy="-3" r="3.4" fill="#e3b341" />
          <circle cx="0" cy="-29" r="3.4" fill="#e3b341" />
          {/* face */}
          <circle cx="0" cy="16" r="13" fill="#f6e7c8" />
          <circle cx="-5" cy="13" r="1.8" fill="#15181f" />
          <circle cx="5" cy="13" r="1.8" fill="#15181f" />
          <path d="M-6 20C-3 24 3 24 6 20" fill="none" stroke="#15181f" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <text x="50" y="112" fontSize="13" fontWeight="800" letterSpacing="2" fontFamily="Georgia, serif" fill={purple} textAnchor="middle">JOKER</text>
      </svg>
    );
  }

  const suit = card.suit!;
  const color = SUIT_COLOR[suit];
  const rank = card.rank;

  return (
    <svg className="pc" width={width} height={height} viewBox="0 0 100 140">
      <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#fff" stroke="#d9d2c0" strokeWidth="1" />
      <CornerIndex rank={rank} suit={suit} color={color} />
      <CornerIndex rank={rank} suit={suit} color={color} flip />

      {rank === 'A' ? (
        <>
          <rect x="16" y="18" width="68" height="104" rx="8" fill="none" stroke={color} strokeWidth="1" opacity="0.25" />
          <Pip suit={suit} color={color} x={27} y={46} size={46} />
        </>
      ) : (
        <>
          <rect x="17" y="19" width="66" height="102" rx="8" fill={color} opacity="0.06" stroke={color} strokeWidth="1" strokeOpacity="0.35" />
          {/* top & bottom ornaments */}
          <g transform="translate(30 27)">
            <Crown rank={rank} color={color} />
          </g>
          <g transform="translate(70 113) rotate(180)">
            <Crown rank={rank} color={color} />
          </g>
          {/* flanking pips */}
          <Pip suit={suit} color={color} x={22} y={63} size={13} />
          <Pip suit={suit} color={color} x={65} y={63} size={13} flip />
          {/* central medallion */}
          <circle cx="50" cy="70" r="16.5" fill="#fff" stroke={color} strokeWidth="2.4" />
          <circle cx="50" cy="70" r="13" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
          <text
            x="50"
            y="79"
            fontSize="26"
            fontWeight="800"
            fontFamily="Georgia, 'Times New Roman', serif"
            fill={color}
            textAnchor="middle"
          >
            {rank}
          </text>
        </>
      )}
    </svg>
  );
}
