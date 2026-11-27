import { useEffect, useReducer } from 'react';
import { applyCategories, tintCategories } from './categories';
import { monthOf, todayISO, uid } from './format';
import type { Entry, Goal, Memory, Parsed, RoutineMark, Settings, State } from './types';

const KEY = 'cashglome.v1';

export const defaultSettings: Settings = {
  // Left from the old cloud chat; kept so older books load unchanged. Florin needs no settings here.
  ai: { provider: 'local', key: '', base: '', parseModel: '', storyModel: '' },
  sound: true,
  calm: false,
  theme: 'auto',
  wallpaper: 'season',
  reminder: { on: false, time: '21:00' },
};

export function initialState(): State {
  return {
    profile: { name: '', currency: 'USD', onboarded: false, createdAt: Date.now() },
    entries: [], goals: [], settings: defaultSettings, seenBadges: [], month: monthOf(todayISO()), seenRestored: {},
    memories: [], routineLog: {}, gone: [],
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as State;
    const base = initialState();
    // Forgotten memories wait 30 days to be restored, then only an empty marker stays (so sync deletes them everywhere).
    const memories = (s.memories ?? []).map((m) => ((m.deletedAt ?? 0) > 0 && Date.now() - m.deletedAt! > 30 * 864e5 ? { id: m.id, kind: m.kind, text: '', createdAt: m.createdAt, updatedAt: Date.now(), deletedAt: -1 } : m));
    return { ...base, ...s, entries: renamed(s.entries ?? []), seenRestored: s.seenRestored ?? {}, memories, routineLog: s.routineLog ?? {}, gone: s.gone ?? [], settings: { ...base.settings, ...s.settings, ai: { ...base.settings.ai, ...s.settings?.ai }, reminder: { ...base.settings.reminder, ...s.settings?.reminder } }, month: monthOf(todayISO()) };
  } catch {
    return initialState();
  }
}

/** What a pull from the cloud brings back. */
export interface Remote {
  entries: Entry[]; goals: Goal[]; memories: Memory[];
  dropEntries: string[]; dropGoals: string[];
  profile?: { profile: Partial<State['profile']>; settings: Partial<Settings>; seenBadges?: string[]; seenRestored?: Record<string, number>; routineLog?: State['routineLog'] };
}

export type Action =
  | { type: 'onboard'; name: string; currency: string; example?: boolean }
  | { type: 'dropSamples' }
  | { type: 'addEntries'; entries: Entry[] }
  | { type: 'update'; id: string; patch: Partial<Entry> }
  | { type: 'remove'; id: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'ai'; patch: Partial<Settings['ai']> }
  | { type: 'profile'; patch: Partial<State['profile']> }
  | { type: 'month'; month: string }
  | { type: 'goal'; goal: Goal }
  | { type: 'removeGoal'; id: string }
  | { type: 'seenBadges'; ids: string[] }
  | { type: 'seenRestored'; month: string; n: number }
  | { type: 'overheard'; month: string; heard: import('./types').Heard }
  | { type: 'house'; calling: import('./houses').Calling } | { type: 'quiet'; date: string; on: boolean }
  | { type: 'cash'; pocket: NonNullable<State['cash']>[number] }
  | { type: 'removeCash'; id: string }
  | { type: 'refine'; id: string; patch: Partial<Pick<Entry, 'label' | 'category'>> }
  | { type: 'remember'; memory: Memory } // add, or edit (the old version goes into its history)
  | { type: 'forget'; id: string }
  | { type: 'restoreMemory'; id: string }
  | { type: 'revertMemory'; id: string; at: number }
  | { type: 'purgeMemory'; id: string }
  | { type: 'mark'; key: string; mark: RoutineMark | null }
  | { type: 'merge'; remote: Remote } // changes pulled from the cloud; newest edit wins
  | { type: 'replace'; state: State }
  | { type: 'circle'; circle: import('./types').Circle }
  | { type: 'removeCircle'; id: string }
  | { type: 'category'; category: import('./categories').Category } // add or edit one of your own
  | { type: 'hideCategory'; id: string; hidden: boolean }
  | { type: 'removeCategory'; id: string; moveTo: string } // its entries move to another category
  | { type: 'reset' };

export const toEntry = (p: Parsed): Entry => ({ id: uid(), text: p.text, label: p.label, amount: p.amount, dir: p.dir, category: p.category, feeling: p.feeling, date: p.date, createdAt: Date.now(), source: p.source, confidence: p.confidence });

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'house': return { ...s, house: a.calling };
    case 'onboard': return { ...s, profile: { ...s.profile, name: a.name || s.profile.name, currency: s.profile.onboarded ? s.profile.currency : a.currency, onboarded: true, example: a.example || undefined } };
    case 'dropSamples': return { ...s, entries: s.entries.filter((e) => !e.sample) };
    case 'addEntries': return { ...s, entries: [...s.entries, ...a.entries] };
    case 'update': return { ...s, entries: s.entries.map((e) => (e.id === a.id ? { ...e, ...a.patch, source: a.patch.category || a.patch.dir ? 'manual' : e.source, updatedAt: Date.now() } : e)) };
    case 'remove': return { ...s, entries: s.entries.filter((e) => e.id !== a.id), gone: [...s.gone, { kind: 'entry' as const, id: a.id, at: Date.now() }].slice(-500) };
    case 'settings': return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'ai': return { ...s, settings: { ...s.settings, ai: { ...s.settings.ai, ...a.patch } } };
    case 'profile': return { ...s, profile: { ...s.profile, ...a.patch } };
    case 'month': return { ...s, month: a.month };
    case 'circle': return { ...s, circles: [...(s.circles ?? []).filter((c) => c.id !== a.circle.id), { ...a.circle, updatedAt: Date.now() }] };
    case 'removeCircle': return { ...s, circles: (s.circles ?? []).filter((c) => c.id !== a.id) };
    case 'category': {
      const list = s.categories ?? [];
      return { ...s, categories: list.some((c) => c.id === a.category.id) ? list.map((c) => (c.id === a.category.id ? a.category : c)) : [...list, a.category] };
    }
    case 'hideCategory': {
      const h = new Set(s.hiddenCategories ?? []);
      if (a.hidden) h.add(a.id); else h.delete(a.id);
      return { ...s, hiddenCategories: [...h] };
    }
    case 'removeCategory': {
      const now = Date.now();
      const entries = s.entries.map((e) => (e.category === a.id ? { ...e, category: a.moveTo, updatedAt: now } : e));
      const custom = (s.categories ?? []).some((c) => c.id === a.id);
      // Your own categories go; the built-in ones are hidden instead, so the app's reading still knows them.
      return custom
        ? { ...s, entries, categories: (s.categories ?? []).filter((c) => c.id !== a.id), hiddenCategories: (s.hiddenCategories ?? []).filter((x) => x !== a.id) }
        : { ...s, entries, hiddenCategories: [...new Set([...(s.hiddenCategories ?? []), a.id])] };
    }
    case 'goal': return { ...s, goals: [...s.goals.filter((g) => g.id !== a.goal.id), { ...a.goal, updatedAt: Date.now() }] };
    case 'removeGoal': return { ...s, goals: s.goals.filter((g) => g.id !== a.id), gone: [...s.gone, { kind: 'goal' as const, id: a.id, at: Date.now() }].slice(-500) };
    case 'remember': {
      const old = s.memories.find((m) => m.id === a.memory.id);
      const now = Date.now();
      if (!old) return { ...s, memories: [...s.memories, { ...a.memory, createdAt: a.memory.createdAt || now, updatedAt: now }] };
      const { history: _h, ...was } = old;
      return { ...s, memories: s.memories.map((m) => (m.id === old.id ? { ...a.memory, createdAt: old.createdAt, updatedAt: now, deletedAt: undefined, history: [{ at: old.updatedAt, was }, ...(old.history ?? [])].slice(0, 8) } : m)) };
    }
    case 'forget': return { ...s, memories: s.memories.map((m) => (m.id === a.id ? { ...m, deletedAt: Date.now(), updatedAt: Date.now() } : m)) };
    case 'restoreMemory': return { ...s, memories: s.memories.map((m) => (m.id === a.id ? { ...m, deletedAt: undefined, updatedAt: Date.now() } : m)) };
    case 'revertMemory': {
      const old = s.memories.find((m) => m.id === a.id);
      const v = old?.history?.find((h) => h.at === a.at);
      if (!old || !v) return s;
      return reducer(s, { type: 'remember', memory: { ...(v.was as Memory), id: old.id, kind: old.kind } });
    }
    case 'purgeMemory': return { ...s, memories: s.memories.map((m) => (m.id === a.id ? { id: m.id, kind: m.kind, text: '', createdAt: m.createdAt, updatedAt: Date.now(), deletedAt: -1 } : m)) };
    case 'mark': {
      const log = { ...s.routineLog };
      if (a.mark) log[a.key] = a.mark; else delete log[a.key];
      // Keep about two months of marks.
      const cutoff = todayISO(new Date(Date.now() - 62 * 864e5));
      for (const k of Object.keys(log)) if (k.split('@')[1] < cutoff) delete log[k];
      return { ...s, routineLog: log };
    }
    case 'seenBadges': return { ...s, seenBadges: Array.from(new Set([...s.seenBadges, ...a.ids])) };
    case 'overheard': {
      const was = s.overheard?.[a.month] ?? [];
      const list = [...was.filter((h) => h.at !== a.heard.at), a.heard].sort((x, y) => x.at - y.at).slice(-60);
      return { ...s, overheard: { ...s.overheard, [a.month]: list } };
    }
    case 'seenRestored': return { ...s, seenRestored: { ...s.seenRestored, [a.month]: a.n } };
    case 'quiet': { const q = new Set(s.quiet ?? []); if (a.on) q.add(a.date); else q.delete(a.date); return { ...s, quiet: [...q].sort() }; }
    case 'cash': return { ...s, cash: [...(s.cash ?? []).filter((p) => p.id !== a.pocket.id), a.pocket].slice(-20) };
    case 'removeCash': return { ...s, cash: (s.cash ?? []).filter((p) => p.id !== a.id) };
    // Florin's better wording for an entry already saved from the on-device reading.
    case 'refine': return { ...s, entries: s.entries.map((e) => (e.id === a.id && e.source !== 'manual' ? { ...e, ...a.patch, source: 'florin', updatedAt: Date.now() } : e)) };
    case 'merge': {
      const r = a.remote;
      const stamp = (x: { updatedAt?: number; createdAt?: number }) => x.updatedAt ?? x.createdAt ?? 0;
      const mergeList = <T extends { id: string }>(local: T[], incoming: T[], drop: string[], time: (x: T) => number) => {
        const by = new Map(local.map((x) => [x.id, x]));
        for (const id of drop) by.delete(id);
        for (const x of incoming) { const mine = by.get(x.id); if (!mine || time(x) >= time(mine)) by.set(x.id, x); }
        return [...by.values()];
      };
      return {
        ...s,
        entries: mergeList(s.entries, r.entries, r.dropEntries, stamp),
        goals: mergeList(s.goals, r.goals, r.dropGoals, (g) => g.updatedAt ?? 0),
        memories: mergeList(s.memories, r.memories, [], (m) => m.updatedAt),
        ...(r.profile ? {
          profile: { ...s.profile, ...r.profile.profile, onboarded: true },
          settings: { ...s.settings, ...r.profile.settings, ai: s.settings.ai },
          seenBadges: Array.from(new Set([...s.seenBadges, ...(r.profile.seenBadges ?? [])])),
          seenRestored: { ...r.profile.seenRestored, ...s.seenRestored },
          // An answer on any device (done or skipped) beats a question still waiting on this one.
          routineLog: Object.fromEntries([...new Set([...Object.keys(r.profile.routineLog ?? {}), ...Object.keys(s.routineLog)])].map((k) => {
            const mine = s.routineLog[k], theirs = r.profile!.routineLog?.[k];
            return [k, mine && mine !== 'pending' ? mine : theirs ?? mine];
          })),
        } : {}),
      };
    }
    case 'replace': return a.state;
    case 'reset': return initialState();
  }
}

export function useGlomeStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  // Your own categories join the shared list before anything below reads it.
  tintCategories(state.settings.palette ?? 'classic');
  applyCategories(state.categories, state.hiddenCategories);
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
    }, 120);
    return () => clearTimeout(t);
  }, [state]);
  return [state, dispatch] as const;
}

export function exportState(state: State) {
  const safe = { ...state, settings: { ...state.settings, ai: { ...state.settings.ai, key: '' } } };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cashglome-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Books written before the AI was named Florin marked its lines 'muse'. */
const renamed = (entries: Entry[]) => entries.map((e) => ((e.source as string) === 'muse' ? { ...e, source: 'florin' as const } : e));

export async function importState(file: File, current: State): Promise<State> {
  const data = JSON.parse(await file.text()) as Partial<State>;
  if (!Array.isArray(data.entries)) throw new Error('This file is not a CashGlome world.');
  return { ...current, ...data, entries: renamed(data.entries), settings: { ...current.settings, ...data.settings, ai: { ...current.settings.ai, ...data.settings?.ai, key: current.settings.ai.key } } } as State;
}
