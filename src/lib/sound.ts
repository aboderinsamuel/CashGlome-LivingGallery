// Tiny synthesized sound design — no audio files needed.
let ctx: AudioContext | null = null;
let enabled = true;
export const setSound = (on: boolean) => { enabled = on; };

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur: number, gain = 0.06, type: OscillatorType = 'sine') {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05);
}

export const sfx = {
  income() { if (!enabled) return; [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => tone(f, i * 0.07, 0.6, 0.05, 'triangle')); },
  spend() { if (!enabled) return; tone(523.25, 0, 0.25, 0.05, 'sine'); tone(392, 0.08, 0.35, 0.04, 'sine'); },
  restore() { if (!enabled) return; [1318.51, 1567.98, 2093].forEach((f, i) => tone(f, 0.15 + i * 0.11, 1.4, 0.022, 'sine')); tone(659.25, 0.15, 0.9, 0.025, 'triangle'); },
  vault() { if (!enabled) return; [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((f, i) => tone(f, i * 0.06, 0.9, 0.035, 'sine')); },
  badge() { if (!enabled) return; [880, 1108.73, 1318.51, 1760].forEach((f, i) => tone(f, i * 0.09, 1.1, 0.04, 'triangle')); },
  shutter() { if (!enabled) return; tone(2400, 0, 0.03, 0.03, 'square'); tone(1600, 0.05, 0.05, 0.02, 'square'); },
  tap() { if (!enabled) return; tone(1200, 0, 0.06, 0.02, 'sine'); },
  open() { if (!enabled) return; tone(740, 0, 0.12, 0.02, 'sine'); tone(988, 0.04, 0.14, 0.015, 'sine'); },
};
