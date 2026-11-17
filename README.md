# ♠ Carré

A 2-vs-2 bluffing card game played entirely peer-to-peer in the browser. Collect
four of a kind, secretly signal your partner, and have **them** call your win —
before a suspicious opponent snipes you. Voice chat is always on.

## The game

- **16 cards**: only faces & aces — Kings, Queens, Jacks, Aces — one in each of
  the four suits (♠♥♦♣). Plus **one Joker** (the "odd card", not part of the four
  tribes) → 17 cards total.
- **4 players, 2 teams.** Your **partner** sits across from you; the two
  **opponents** sit to your sides.
- **Deal:** everyone gets 4 cards; one random player also gets the Joker as a 5th
  card and must pass first.
- **Passing:** whoever holds 5 cards passes one card clockwise
  (you → opponent → partner → other opponent → you…). The holder chooses which
  card to give.
- **Goal — a _carré_:** hold all four suits of one rank (four Kings, four Aces, …).
- **Declaring a win:** you can't call your own win. When you complete a carré you
  secretly signal your partner (see below); **your partner clicks you and calls
  the win.** All hands are revealed at once. Right call → your team wins. Wrong
  call → your team loses.
- **Signals & bluffs:** before the round, partners agree in a **private team chat**
  on an emoji that means _"call my win!"_. During the round every player
  broadcasts an emoji live next to their avatar — use it to signal your partner,
  or to **bluff**. If an opponent **suspects** you're holding a carré they can
  call it: right → they win, wrong → they lose.

## Architecture (built for Vercel Hobby)

Vercel Hobby functions can't be held open for the length of a game, so **there is
no realtime server** — the game is fully peer-to-peer over **WebRTC**.

- **Signaling & discovery:** [PeerJS](https://peerjs.com) (free cloud broker) with
  **Google STUN servers** (`stun.l.google.com`) for NAT traversal.
- **Host election:** the first person to open a room claims a deterministic peer id
  (`carre-v1-<roomId>`) and becomes the **host**. Their browser runs the
  authoritative game engine (`lib/engine.ts`). Everyone else connects to them.
- **Game data** (deals, passes, emojis, team chat, win/bluff calls) flows over
  WebRTC **data channels**, host-authoritative. The host sends each player a
  _redacted_ view — you only ever receive your own cards until the reveal.
- **Audio** is a full WebRTC **mesh** (everyone ↔ everyone), always on, with a
  live speaking indicator.
- **Vercel's only job** is serving the static Next.js app over its CDN — zero
  game-time compute, comfortably inside Hobby limits.

```
app/                     Next.js App Router (all client components)
  page.tsx               Landing — name + create/join
  room/[roomId]/page.tsx Username gate → <Game/>
components/
  Game.tsx               Table, hand, passing, calls, wiring
  PlayingCard.tsx        Hand-drawn SVG cards (K/Q/J/A, Joker, back)
  Seat.tsx EmojiBar.tsx Sidebar.tsx RevealOverlay.tsx
hooks/
  usePeerNet.ts          PeerJS host election + data sync + audio mesh
lib/
  game.ts                Deck, deal, carré detection
  engine.ts              Authoritative room engine (runs on the host)
  protocol.ts            Shared view / action / net-message types
```

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000 in 4 tabs/devices, share the room link
```

> Microphones require a secure context — `localhost` and the Vercel HTTPS URL both
> qualify. Strict/symmetric NATs may need a TURN relay (STUN-only here); add TURN
> servers in `hooks/usePeerNet.ts` if peers can't connect directly.

## Deploy

```bash
vercel deploy
```

No environment variables, no database, no serverless functions to keep warm.
