'use client';

const PID_KEY = 'carre_pid';
const NAME_KEY = 'carre_name';

export function getPid(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(PID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(PID_KEY, id);
  }
  return id;
}

export function getName(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(NAME_KEY) ?? '';
}

export function setName(name: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(NAME_KEY, name.trim().slice(0, 20));
}

export function makeRoomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const buf = new Uint32Array(7);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 7; i++) s += alphabet[buf[i] % alphabet.length];
  return s;
}
