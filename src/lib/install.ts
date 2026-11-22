// Putting CashGlome on the home screen. Chrome and Edge offer an install prompt we can hold and show when asked;
// Safari on iPhone and iPad has none, so there we say where Add to Home Screen lives.
import { useEffect, useState } from 'react';

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let held: PromptEvent | null = null;
const CHANGED = 'cg-install';
const changed = () => window.dispatchEvent(new Event(CHANGED));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); held = e as PromptEvent; changed(); });
  window.addEventListener('appinstalled', () => { held = null; changed(); });
}

export type InstallState = 'installed' | 'ready' | 'ios' | 'none';

export function installState(): InstallState {
  if (typeof window === 'undefined' || window.glome?.isDesktop) return 'none';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  if (held) return 'ready';
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'none';
}

/** Shows the browser's own install prompt. True when the person said yes. */
export async function promptInstall(): Promise<boolean> {
  if (!held) return false;
  const e = held;
  held = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  changed();
  return outcome === 'accepted';
}

export function useInstall(): InstallState {
  const [s, setS] = useState(installState);
  useEffect(() => {
    const r = () => setS(installState());
    window.addEventListener(CHANGED, r);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', r);
    return () => { window.removeEventListener(CHANGED, r); mq.removeEventListener('change', r); };
  }, []);
  return s;
}

const LATER = 'cg-install-later';
/** The one gentle suggestion on Today: asked once, and "Not now" is kept for good. */
export const installLater = () => { try { return localStorage.getItem(LATER) === '1'; } catch { return false; } };
export const setInstallLater = () => { try { localStorage.setItem(LATER, '1'); } catch { /* fine */ } changed(); };
