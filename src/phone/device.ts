// The phone itself: is this one, where is its keyboard, can it buzz.
import { useEffect, useState } from 'react';

const PHONE = '(max-width: 560px)';

/** True on phone-width screens in a browser. The desktop apps never take this path. */
export function usePhone() {
  const [phone, setPhone] = useState(() => !window.glome?.isDesktop && window.matchMedia(PHONE).matches);
  useEffect(() => {
    if (window.glome?.isDesktop) return;
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (phone) document.documentElement.dataset.phone = ''; else delete document.documentElement.dataset.phone;
  }, [phone]);
  return phone;
}

/** Keeps the layout exactly as tall as what is visible, so the box sits on top of the keyboard.
 *  Sets --vvh (visible height) and --vvt (its offset) on <html>, and data-kb while the keyboard is up. */
export function useKeyboardViewport(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let full = window.innerHeight;
    const set = () => {
      const h = vv?.height ?? window.innerHeight;
      if (h > full) full = h;
      root.style.setProperty('--vvh', `${Math.round(h)}px`);
      root.style.setProperty('--vvt', `${Math.round(vv?.offsetTop ?? 0)}px`);
      if (full - h > 140) root.dataset.kb = ''; else delete root.dataset.kb;
    };
    const turned = () => { full = window.innerHeight; set(); };
    set();
    vv?.addEventListener('resize', set); vv?.addEventListener('scroll', set);
    window.addEventListener('orientationchange', turned);
    return () => {
      vv?.removeEventListener('resize', set); vv?.removeEventListener('scroll', set);
      window.removeEventListener('orientationchange', turned);
      root.style.removeProperty('--vvh'); root.style.removeProperty('--vvt'); delete root.dataset.kb;
    };
  }, [on]);
}

let hapticsOn = true;
export const setHaptics = (on: boolean) => { hapticsOn = on; };
/** A touch you can feel. Android browsers vibrate; iPhone Safari has no vibration and stays silent. */
export function haptic(kind: 'tap' | 'lift' | 'done' = 'tap') {
  if (!hapticsOn || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(kind === 'tap' ? 10 : kind === 'lift' ? [8, 50, 16] : [10, 40, 10, 40, 24]); } catch { /* not allowed yet */ }
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
