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
  // audio
  micAvailable: boolean;
  micOn: boolean;
  toggleMic: () => void;
  needsReloadForMic: boolean;
  remoteStreams: Record<string, MediaStream>; // peerId -> stream
  speaking: Record<string, boolean>; // peerId (or 'self') -> speaking
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
  const engineRef = useRef<RoomEngine | null>(null);
  const hostConnRef = useRef<DataConnection | null>(null);
  const connsRef = useRef<Map<string, AttachedConn>>(new Map());
  const myPeerIdRef = useRef('');
  const localStreamRef = useRef<MediaStream | null>(null);
  const emptyStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());

  // speaking detection
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

  // ---- speaking analysis loop ----
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
        const rms = Math.sqrt(sum / buf.length);
        next[key] = rms > 0.045;
      }
      setSpeaking((prev) => {
        // only update when something changed to avoid re-renders
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

  // ---- remote media helpers ----
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
    for (const el of audioElsRef.current.values()) {
      el.play().catch(() => {});
    }
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

  // ---- main lifecycle ----
  useEffect(() => {
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      // 1) acquire mic BEFORE any call so every connection carries the track.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (destroyed) {
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
      if (destroyed) return;

      const hostId = `carre-v1-${roomId}`;

      const makePeer = (id?: string): Peer =>
        id
          ? new PeerCtor(id, { debug: 1, config: ICE })
          : new PeerCtor({ debug: 1, config: ICE });

      const setupCallAnswering = (peer: Peer) => {
        peer.on('call', (call) => {
          call.answer(localStreamRef.current ?? emptyStreamRef.current ?? undefined);
          callsRef.current.set(call.peer, call);
          call.on('stream', (remote) => attachRemote(call.peer, remote));
          call.on('close', () => removeRemote(call.peer));
          call.on('error', () => removeRemote(call.peer));
        });
      };

      const initHost = (peer: Peer) => {
        const eng = new RoomEngine(roomId);
        engineRef.current = eng;
        eng.join(pid, nameRef.current, myPeerIdRef.current);
        setIsHost(true);
        setStatus('connected');

        peer.on('connection', (conn: AttachedConn) => {
          conn.on('data', (raw) => {
            const msg = raw as NetMessage;
            if (msg.k === 'hello') {
              conn.__pid = msg.pid;
              connsRef.current.set(msg.pid, conn);
              eng.join(msg.pid, msg.name, msg.peerId);
              hostBroadcast();
            } else if (msg.k === 'action' && conn.__pid) {
              eng.apply(conn.__pid, msg.action);
              hostBroadcast();
            }
          });
          conn.on('close', () => {
            if (conn.__pid) {
              connsRef.current.delete(conn.__pid);
              eng.setConnected(conn.__pid, false);
              hostBroadcast();
            }
          });
          conn.on('error', () => {});
        });

        hostBroadcast();
      };

      const initClient = (peer: Peer) => {
        setIsHost(false);
        const conn = peer.connect(hostId, { reliable: true });
        hostConnRef.current = conn;
        conn.on('open', () => {
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
          if (!destroyed) setStatus('host-missing');
        });
        conn.on('error', () => {
          if (!destroyed) setStatus('host-missing');
        });
      };

      const becomeClient = () => {
        const peer = makePeer();
        peerRef.current = peer;
        setupCallAnswering(peer);
        peer.on('open', (id) => {
          if (destroyed) {
            peer.destroy();
            return;
          }
          myPeerIdRef.current = id;
          setMyPeerId(id);
          initClient(peer);
        });
        peer.on('error', (err: { type?: string }) => {
          if (err.type === 'peer-unavailable') {
            // Host id vanished (host left). Try to claim host after a beat.
            setStatus('host-missing');
            if (!destroyed) {
              retryTimer = setTimeout(() => {
                if (destroyed) return;
                peer.destroy();
                tryHost();
              }, 2500);
            }
          } else if (err.type !== 'unavailable-id') {
            setStatus('error');
          }
        });
      };

      const tryHost = () => {
        const peer = makePeer(hostId);
        peerRef.current = peer;
        setupCallAnswering(peer);
        peer.on('open', (id) => {
          if (destroyed) {
            peer.destroy();
            return;
          }
          myPeerIdRef.current = id;
          setMyPeerId(id);
          initHost(peer);
        });
        peer.on('error', (err: { type?: string }) => {
          if (err.type === 'unavailable-id') {
            // Someone already hosts this room → become a client.
            peer.destroy();
            if (!destroyed) becomeClient();
          } else if (err.type === 'network' || err.type === 'server-error') {
            setStatus('error');
          }
        });
      };

      tryHost();
    };

    run();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
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
    for (const p of state.players) {
      if (!p.peerId || p.peerId === me || !p.connected) continue;
      if (callsRef.current.has(p.peerId)) continue;
      // deterministic initiator to avoid double-calling
      if (me < p.peerId) {
        const outStream =
          localStreamRef.current ?? emptyStreamRef.current ?? new MediaStream();
        const call = peer.call(p.peerId, outStream);
        if (!call) continue;
        callsRef.current.set(p.peerId, call);
        const pid2 = p.peerId;
        call.on('stream', (remote) => attachRemote(pid2, remote));
        call.on('close', () => removeRemote(pid2));
        call.on('error', () => removeRemote(pid2));
      }
    }
  }, [state, attachRemote, removeRemote]);

  // ---- render hidden audio elements for each remote stream ----
  useEffect(() => {
    // prune elements for streams that went away
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
