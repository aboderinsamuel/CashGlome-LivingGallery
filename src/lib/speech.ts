// One way to listen, whatever the platform:
// - browsers: the Web Speech API (Chrome, Edge, Safari);
// - the Windows app: Windows' own offline recogniser, through Electron;
// - anywhere else: reported as unavailable, so the button can say so instead of failing silently.

export interface ListenHandlers {
  onReady?: () => void;
  onText: (text: string, final: boolean) => void; // the whole transcript so far
  onLevel?: (level: number) => void; // 0..1
  onError: (message: string) => void;
  onEnd: () => void;
}
export interface Listening { stop: () => void }

type SR = {
  start: () => void; stop: () => void; abort: () => void;
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onerror: (e: { error: string }) => void; onend: () => void; onstart: () => void;
};
const SpeechCtor = (): (new () => SR) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function voiceSupport(): 'windows' | 'web' | null {
  if (window.glome?.isDesktop) return window.glome.speech ? 'windows' : null;
  return SpeechCtor() ? 'web' : null;
}

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it for CashGlome and try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow it for CashGlome and try again.',
  'no-speech': 'Didn’t catch anything. Tap the mic and speak a little closer.',
  'audio-capture': 'No microphone found.',
  'no-mic': 'No microphone found.',
  network: 'Voice needs an internet connection in this browser. You can type instead.',
  'no-recognizer': 'Windows speech recognition isn’t installed. Add it in Settings › Time & language › Speech.',
  engine: 'Voice stopped unexpectedly. Try again, or type instead.',
  unsupported: 'Voice isn’t available here yet. You can type instead.',
};
export const voiceMessage = (code: string) => MESSAGES[code] ?? MESSAGES.engine;

export function listen(h: ListenHandlers): Listening {
  const kind = voiceSupport();
  if (kind === 'windows') return listenWindows(h);
  if (kind === 'web') return listenWeb(h);
  setTimeout(() => { h.onError(voiceMessage('unsupported')); h.onEnd(); }, 0);
  return { stop: () => {} };
}

function listenWindows(h: ListenHandlers): Listening {
  const api = window.glome!.speech!;
  let finals = '';
  let heard = false;
  const off = api.on((e) => {
    if (e.type === 'ready') h.onReady?.();
    else if (e.type === 'partial') { heard = true; h.onText((finals + ' ' + String(e.value)).trim(), false); }
    else if (e.type === 'final') { heard = true; finals = (finals + ' ' + String(e.value)).trim(); h.onText(finals, true); }
    else if (e.type === 'level') h.onLevel?.(Number(e.value));
    else if (e.type === 'error') h.onError(voiceMessage(String(e.value)));
    else if (e.type === 'end') { off(); if (!heard) h.onError(voiceMessage('no-speech')); h.onEnd(); }
  });
  api.start();
  return { stop: () => { api.stop(); } };
}

function listenWeb(h: ListenHandlers): Listening {
  const r = new (SpeechCtor()!)();
  r.lang = navigator.language || 'en-US';
  r.interimResults = true;
  r.continuous = true;
  let finals = '';
  let heard = false;
  let silence: ReturnType<typeof setTimeout> | undefined;
  const quietStop = () => { clearTimeout(silence); silence = setTimeout(() => r.stop(), 2200); };
  r.onstart = () => { h.onReady?.(); quietStop(); };
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finals = (finals + ' ' + res[0].transcript).trim();
      else interim += res[0].transcript;
    }
    heard = true;
    h.onText((finals + ' ' + interim).trim(), !interim);
    h.onLevel?.(0.4 + Math.random() * 0.5);
    quietStop();
  };
  r.onerror = (e) => { if (e.error !== 'aborted') h.onError(voiceMessage(e.error)); };
  r.onend = () => { clearTimeout(silence); if (!heard) h.onLevel?.(0); h.onEnd(); };
  try { r.start(); } catch { h.onError(voiceMessage('engine')); h.onEnd(); }
  return { stop: () => { clearTimeout(silence); r.stop(); } };
}
