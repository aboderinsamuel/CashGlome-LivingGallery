// The overture: one piece of music, played only under the house announcement, and only very low.
// Browsers only allow sound after a tap, so nothing here plays on its own. The file is optional: if
// public/audio/overture.mp3 isn't there, every call is a quiet no-op and the sound button never shows.
const SRC = './audio/overture.mp3';
const KEY = 'cg-sound';

let el: HTMLAudioElement | null = null;
let ok: boolean | null = null;
let fadeTimer = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** The person turned the sound off before; we remember that. */
export const soundMuted = () => { try { return localStorage.getItem(KEY) === 'off'; } catch { return false; } };
export const onOverture = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const overtureState = () => ({ available: ok === true, playing: !!el && !el.paused, muted: soundMuted() });

function audio() {
  if (el) return el;
  el = new Audio(SRC);
  el.preload = 'auto';
  el.volume = 0;
  el.addEventListener('canplaythrough', () => { ok = true; emit(); }, { once: true });
  el.addEventListener('error', () => { ok = false; emit(); });
  el.addEventListener('play', emit); el.addEventListener('pause', emit); el.addEventListener('ended', emit);
  return el;
}

/** Start fetching it early (on the cover), so Begin plays without a gap. */
export function prepareOverture() { audio(); }

function fadeTo(target: number, ms: number, then?: () => void) {
  const a = el; if (!a) return;
  clearInterval(fadeTimer);
  const from = a.volume, start = performance.now();
  fadeTimer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / ms);
    a.volume = Math.max(0, Math.min(1, from + (target - from) * (1 - Math.pow(1 - t, 2))));
    if (t >= 1) { clearInterval(fadeTimer); then?.(); }
  }, 40);
}

/** Under the house announcement: a very low fade in. Browsers allow it because a tap (sending the first line) came first. */
export function playOverture(volume = 0.12) {
  if (soundMuted() || ok === false) return;
  const a = audio();
  a.play().then(() => fadeTo(volume, 2600)).catch(() => { /* blocked or missing: stay silent */ });
}

/** The announcement is over: let it go. */
export function endOverture(ms = 2400) {
  if (!el || el.paused) return;
  fadeTo(0, ms, () => el?.pause());
}

/** Kept for older callers: the music never stays on in the app. */
export const settleOverture = () => endOverture();

export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  if (on) playOverture(); else if (el) fadeTo(0, 500, () => el?.pause());
  emit();
}
