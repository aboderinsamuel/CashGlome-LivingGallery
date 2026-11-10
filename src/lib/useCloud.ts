// Runs the cloud sync in the background while someone is signed in, and shares its status with Settings.
import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { cloudConfigured, lastSynced, onSession, syncOnce } from './cloud';
import type { Action } from './store';
import type { State } from './types';

export interface SyncStatus { session: Session | null; phase: 'off' | 'idle' | 'syncing' | 'error'; at: number | null; error?: string; recovering?: boolean }
export const doneRecovering = () => setStatus({ recovering: false });
let status: SyncStatus = { session: null, phase: 'off', at: lastSynced() };
const subs = new Set<() => void>();
const setStatus = (p: Partial<SyncStatus>) => { status = { ...status, ...p }; subs.forEach((f) => f()); };
export const useSyncStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => status);
/** Ask for a sync now (Settings → Sync now, or after signing in). */
export const syncNow = () => window.dispatchEvent(new Event('cashglome-sync'));

export function useCloudSync(state: State, dispatch: (a: Action) => void) {
  const latest = useRef(state);
  latest.current = state;
  const running = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    if (!cloudConfigured) return;
    return onSession((session, recovering) => setStatus({ session, phase: session ? 'idle' : 'off', error: undefined, ...(recovering ? { recovering } : {}) }));
  }, []);

  useEffect(() => {
    if (!cloudConfigured) return;
    const run = async () => {
      const session = status.session;
      if (!session || !navigator.onLine) return;
      if (running.current) { again.current = true; return; }
      running.current = true;
      setStatus({ phase: 'syncing' });
      try {
        const r = await syncOnce(latest.current, session);
        if (r.remote) dispatch({ type: 'merge', remote: r.remote });
        setStatus({ phase: 'idle', at: Date.now(), error: undefined });
      } catch (e) {
        setStatus({ phase: 'error', error: (e as Error).message });
      } finally {
        running.current = false;
        if (again.current) { again.current = false; setTimeout(run, 400); }
      }
    };
    const onFocus = () => document.visibilityState === 'visible' && run();
    window.addEventListener('cashglome-sync', run);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onFocus);
    const t = setInterval(run, 60_000);
    // Sync straight away when someone signs in (or the account changes).
    let user = status.session?.user.id;
    const watch = () => { const u = status.session?.user.id; if (u !== user) { user = u; if (u) run(); } };
    subs.add(watch);
    const unsub = () => { subs.delete(watch); };
    run();
    return () => { window.removeEventListener('cashglome-sync', run); window.removeEventListener('online', run); document.removeEventListener('visibilitychange', onFocus); clearInterval(t); unsub(); };
  }, [dispatch]);

  // A change to anything that syncs: send it a moment later.
  useEffect(() => {
    if (!cloudConfigured || !status.session) return;
    const t = setTimeout(syncNow, 2500);
    return () => clearTimeout(t);
  }, [state.entries, state.goals, state.memories, state.gone, state.profile, state.settings, state.routineLog]);
}
