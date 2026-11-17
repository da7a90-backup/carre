// Mints short-lived ICE servers (Cloudflare STUN + TURN) for WebRTC.
// This is a SHORT request/response (one call to Cloudflare) — not a sustained
// connection — so it's fine on Vercel Hobby. The API token stays server-side.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GOOGLE_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export async function GET() {
  const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!tokenId || !apiToken) {
    // No TURN configured — STUN-only (works on most non-symmetric NATs).
    return Response.json({ iceServers: GOOGLE_STUN });
  }

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );
    if (!res.ok) {
      return Response.json({ iceServers: GOOGLE_STUN });
    }
    const data = (await res.json()) as {
      iceServers?: unknown;
    };
    const cf = Array.isArray(data.iceServers)
      ? data.iceServers
      : data.iceServers
        ? [data.iceServers]
        : [];
    return Response.json(
      { iceServers: [...cf, ...GOOGLE_STUN] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ iceServers: GOOGLE_STUN });
  }
}
