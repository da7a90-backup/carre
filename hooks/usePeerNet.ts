'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataConnection, MediaConnection, Peer } from 'peerjs';
import { RoomEngine } from '@/lib/engine';
import type { Action, NetMessage, StateView } from '@/lib/protocol';

// Google STUN servers for NAT traversal (no TURN — direct P2P; most home/office
// networks traverse fine. Strict/symmetric NATs would need a TURN relay).
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const GRACE_MS = 60_000; // keep a disconnected player's seat this long
const CONNECT_TIMEOUT_MS = 3000; // per attempt to reach the host
const MAX_HOST_CONNECT_ATTEMPTS = 4; // then assume host is gone and claim it

export type NetStatus = 'connecting' | 'connected' | 'host-missing' | 'error';

interface Options {
  roomId: string;
  pid: string;
  name: string;
}

interface AttachedConn extends DataConnection {
  __pid?: string;
}

export interface PeerNet {
  status: NetStatus;
  isHost: boolean;
  state: StateView | null;
  dispatch: (action: Action) => void;
  micAvailable: boolean;
  micOn: boolean;
  toggleMic: () => void;
  needsReloadForMic: boolean;
  remoteStreams: Record<string, MediaStream>;
  speaking: Record<string, boolean>;
  myPeerId: string;
  unlockAudio: () => void;
}

export function usePeerNet({ roomId, pid, name }: Options): PeerNet {
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [isHost, setIsHost] = useState(false);
  const [state, setState] = useState<StateView | null>(null);
  const [micAvailable, setMicAvailable] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [needsReloadForMic, setNeedsReloadForMic] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [myPeerId, setMyPeerId] = useState('');

  const nameRef = useRef(name);
  nameRef.current = name;

  const peerRef = useRef<Peer | null>(null);
  const roleRef = useRef<'host' | 'client' | null>(null);
  const engineRef = useRef<RoomEngine | null>(null);
  const hostConnRef = useRef<DataConnection | null>(null);
  const connsRef = useRef<Map<string, AttachedConn>>(new Map());
  const graceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const myPeerIdRef = useRef('');
  const localStreamRef = useRef<MediaStream | null>(null);
  const emptyStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const rafRef = useRef<number | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // ---- host broadcast ----
  const hostBroadcast = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    for (const p of eng.pids()) {
      const view = eng.viewFor(p);
      if (p === pid) {
        setState(view);
      } else {
        const conn = connsRef.current.get(p);
        if (conn && conn.open) conn.send({ k: 'state', state: view } as NetMessage);
      }
    }
  }, [pid]);

  const dispatch = useCallback(
    (action: Action) => {
      const eng = engineRef.current;
      if (eng) {
        eng.apply(pid, action);
        hostBroadcast();
      } else {
        const conn = hostConnRef.current;
        if (conn && conn.open) conn.send({ k: 'action', action } as NetMessage);
      }
    },
    [pid, hostBroadcast],
  );

  // ---- speaking analysis ----
  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  const addAnalyser = useCallback(
    (key: string, stream: MediaStream) => {
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      try {
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        analysersRef.current.set(key, an);
      } catch {
        /* ignore */
      }
    },
    [ensureAudioCtx],
  );

  useEffect(() => {
    const loop = () => {
      const next: Record<string, boolean> = {};
      const buf = new Uint8Array(256);
      for (const [key, an] of analysersRef.current) {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        next[key] = Math.sqrt(sum / buf.length) > 0.045;
      }
      setSpeaking((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) if ((prev[k] || false) !== (next[k] || false)) return next;
        return prev;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const attachRemote = useCallback(
    (peerId: string, stream: MediaStream) => {
      setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      addAnalyser(peerId, stream);
    },
    [addAnalyser],
  );

  const removeRemote = useCallback((peerId: string) => {
    setRemoteStreams((prev) => {
      const n = { ...prev };
      delete n[peerId];
      return n;
    });
    analysersRef.current.delete(peerId);
    callsRef.current.delete(peerId);
  }, []);

  const unlockAudio = useCallback(() => {
    audioCtxRef.current?.resume?.();
    for (const el of audioElsRef.current.values()) el.play().catch(() => {});
  }, []);

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) {
      setNeedsReloadForMic(true);
      return;
    }
    const track = s.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  // ---- main lifecycle: mic, then robust host election ----
  useEffect(() => {
    let disposed = false;
    const retryTimers = new Set<ReturnType<typeof setTimeout>>();

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        retryTimers.delete(t);
        if (!disposed) fn();
      }, ms);
      retryTimers.add(t);
      return t;
    };
    const networkish = (type?: string) =>
      type === 'network' ||
      type === 'server-error' ||
      type === 'socket-error' ||
      type === 'socket-closed';

    const run = async () => {
      // 1) mic first, so every call carries the track.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setMicAvailable(true);
        setMicOn(true);
        addAnalyser('self', stream);
      } catch {
        setMicAvailable(false);
        setNeedsReloadForMic(true);
      }
      emptyStreamRef.current = new MediaStream();

      const mod = await import('peerjs');
      const PeerCtor = mod.default;
      if (disposed) return;

      const HOST_ID = `carre-v1-${roomId}`;
      const makePeer = (id?: string): Peer =>
        id
          ? new PeerCtor(id, { debug: 0, config: ICE })
          : new PeerCtor({ debug: 0, config: ICE });

      const setupCallAnswering = (peer: Peer) => {
        peer.on('call', (call) => {
          call.answer(localStreamRef.current ?? emptyStreamRef.current ?? undefined);
          callsRef.current.set(call.peer, call);
          call.on('stream', (remote) => attachRemote(call.peer, remote));
          call.on('close', () => removeRemote(call.peer));
          call.on('error', () => removeRemote(call.peer));
        });
      };

      // ---------- HOST ----------
      const becomeHost = (peer: Peer) => {
        roleRef.current = 'host';
        setIsHost(true);
        hostConnRef.current = null;
        const eng = new RoomEngine(roomId);
        engineRef.current = eng;
        eng.join(pid, nameRef.current, myPeerIdRef.current);
        setStatus('connected');

        peer.on('connection', (conn: AttachedConn) => {
          conn.on('data', (raw) => {
            const msg = raw as NetMessage;
            if (msg.k === 'hello') {
              conn.__pid = msg.pid;
              connsRef.current.set(msg.pid, conn);
              const g = graceRef.current.get(msg.pid);
              if (g) {
                clearTimeout(g);
                graceRef.current.delete(msg.pid);
              }
              eng.join(msg.pid, msg.name, msg.peerId);
              hostBroadcast();
            } else if (msg.k === 'action' && conn.__pid) {
              eng.apply(conn.__pid, msg.action);
              hostBroadcast();
            }
          });
          conn.on('close', () => {
            const dpid = conn.__pid;
            if (!dpid) return;
            if (connsRef.current.get(dpid) === conn) connsRef.current.delete(dpid);
            eng.setConnected(dpid, false);
            hostBroadcast();
            const prev = graceRef.current.get(dpid);
            if (prev) clearTimeout(prev);
            graceRef.current.set(
              dpid,
              setTimeout(() => {
                graceRef.current.delete(dpid);
                // only remove if they never reconnected
                if (!eng.isConnected(dpid)) {
                  eng.remove(dpid);
                  hostBroadcast();
                }
              }, GRACE_MS),
            );
          });
          conn.on('error', () => {});
        });

        hostBroadcast();
      };

      const claimHost = () => {
        if (disposed) return;
        setStatus('connecting');
        const peer = makePeer(HOST_ID);
        peerRef.current = peer;
        let decided = false;
        peer.on('open', (id) => {
          if (disposed) {
            peer.destroy();
            return;
          }
          decided = true;
          myPeerIdRef.current = id;
          setMyPeerId(id);
          setupCallAnswering(peer);
          becomeHost(peer);
        });
        peer.on('disconnected', () => {
          if (!disposed) peer.reconnect();
        });
        peer.on('error', (err: { type?: string }) => {
          if (decided) return;
          if (err.type === 'unavailable-id') {
            decided = true;
            try {
              peer.destroy();
            } catch {}
            joinAsClient();
          } else if (networkish(err.type)) {
            decided = true;
            try {
              peer.destroy();
            } catch {}
            later(claimHost, 1500);
          }
        });
      };

      // ---------- CLIENT ----------
      const connectToHost = (peer: Peer, attempt: number) => {
        if (disposed) return;
        const conn = peer.connect(HOST_ID, { reliable: true });
        hostConnRef.current = conn;
        let opened = false;
        const timeout = later(() => {
          if (opened) return;
          try {
            conn.close();
          } catch {}
          if (attempt + 1 < MAX_HOST_CONNECT_ATTEMPTS) {
            connectToHost(peer, attempt + 1);
          } else {
            // Host seems gone — try to take over as host.
            setStatus('host-missing');
            try {
              peer.destroy();
            } catch {}
            claimHost();
          }
        }, CONNECT_TIMEOUT_MS);

        conn.on('open', () => {
          opened = true;
          clearTimeout(timeout);
          conn.send({
            k: 'hello',
            pid,
            name: nameRef.current,
            peerId: myPeerIdRef.current,
          } as NetMessage);
          setStatus('connected');
        });
        conn.on('data', (raw) => {
          const msg = raw as NetMessage;
          if (msg.k === 'state') setState(msg.state);
        });
        conn.on('close', () => {
          clearTimeout(timeout);
          if (disposed || hostConnRef.current !== conn) return;
          setStatus('host-missing');
          later(() => {
            if (disposed) return;
            if (peer.destroyed) {
              claimHost();
            } else {
              connectToHost(peer, 0);
            }
          }, 1200);
        });
        conn.on('error', () => {
          // open-timeout / close handlers drive recovery
        });
      };

      const joinAsClient = () => {
        if (disposed) return;
        roleRef.current = 'client';
        setIsHost(false);
        engineRef.current = null;
        setStatus('connecting');
        const peer = makePeer();
        peerRef.current = peer;
        peer.on('open', (id) => {
          if (disposed) {
            peer.destroy();
            return;
          }
          myPeerIdRef.current = id;
          setMyPeerId(id);
          setupCallAnswering(peer);
          connectToHost(peer, 0);
        });
        peer.on('disconnected', () => {
          if (!disposed) peer.reconnect();
        });
        peer.on('error', (err: { type?: string }) => {
          if (err.type === 'peer-unavailable') {
            // host not reachable this instant — connectToHost retry handles it
          } else if (networkish(err.type)) {
            try {
              peer.destroy();
            } catch {}
            later(joinAsClient, 1500);
          }
        });
      };

      claimHost();
    };

    run();

    return () => {
      disposed = true;
      for (const t of retryTimers) clearTimeout(t);
      for (const t of graceRef.current.values()) clearTimeout(t);
      graceRef.current.clear();
      for (const call of callsRef.current.values()) call.close();
      callsRef.current.clear();
      hostConnRef.current?.close();
      for (const c of connsRef.current.values()) c.close();
      connsRef.current.clear();
      peerRef.current?.destroy();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, pid]);

  // ---- audio mesh: dial peers we learn about from state ----
  useEffect(() => {
    const peer = peerRef.current;
    if (!peer || !state) return;
    const me = myPeerIdRef.current;
    if (!me) return;
    const liveIds = new Set<string>();
    for (const p of state.players) {
      if (!p.peerId || p.peerId === me || !p.connected) continue;
      liveIds.add(p.peerId);
      if (callsRef.current.has(p.peerId)) continue;
      if (me < p.peerId) {
        const outStream =
          localStreamRef.current ?? emptyStreamRef.current ?? new MediaStream();
        const call = peer.call(p.peerId, outStream);
        if (!call) continue;
        callsRef.current.set(p.peerId, call);
        const target = p.peerId;
        call.on('stream', (remote) => attachRemote(target, remote));
        call.on('close', () => removeRemote(target));
        call.on('error', () => removeRemote(target));
      }
    }
  }, [state, attachRemote, removeRemote]);

  // ---- hidden audio elements per remote stream ----
  useEffect(() => {
    for (const [peerId, el] of audioElsRef.current) {
      if (!remoteStreams[peerId]) {
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(peerId);
      }
    }
    for (const [peerId, stream] of Object.entries(remoteStreams)) {
      let el = audioElsRef.current.get(peerId);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
        el.style.display = 'none';
        document.body.appendChild(el);
        audioElsRef.current.set(peerId, el);
      }
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    }
  }, [remoteStreams]);

  return {
    status,
    isHost,
    state,
    dispatch,
    micAvailable,
    micOn,
    toggleMic,
    needsReloadForMic,
    remoteStreams,
    speaking,
    myPeerId,
    unlockAudio,
  };
}
