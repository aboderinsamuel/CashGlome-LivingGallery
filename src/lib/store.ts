import { useEffect, useReducer } from 'react';
import { DEFAULT_BASE } from './ai';
import { guessCurrency, monthOf, todayISO, uid } from './format';
import type { Entry, Goal, Parsed, Settings, State } from './types';

const KEY = 'cashglome.v1';

export const defaultSettings: Settings = {
  ai: { provider: 'local', key: '', base: DEFAULT_BASE, parseModel: 'muse-spark-1.1', storyModel: 'muse-wonder-1.0' },
  sound: true,
  calm: false,
  theme: 'auto',
  wallpaper: 'season',
  reminder: { on: false, time: '21:00' },
};

export function initialState(): State {
  return {
    profile: { name: '', currency: guessCurrency(), onboarded: false, createdAt: Date.now() },
    entries: [], goals: [], settings: defaultSettings, seenBadges: [], month: monthOf(todayISO()), seenRestored: {},
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as State;
    const base = initialState();
    return { ...base, ...s, seenRestored: s.seenRestored ?? {}, settings: { ...base.settings, ...s.settings, ai: { ...base.settings.ai, ...s.settings?.ai }, reminder: { ...base.settings.reminder, ...s.settings?.reminder } }, month: monthOf(todayISO()) };
  } catch {
    return initialState();
  }
}

export type Action =
  | { type: 'onboard'; name: string; currency: string }
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
  | { type: 'replace'; state: State }
  | { type: 'reset' };

export const toEntry = (p: Parsed): Entry => ({ id: uid(), text: p.text, label: p.label, amount: p.amount, dir: p.dir, category: p.category, feeling: p.feeling, date: p.date, createdAt: Date.now(), source: p.source, confidence: p.confidence });

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'onboard': return { ...s, profile: { ...s.profile, name: a.name, currency: a.currency, onboarded: true } };
    case 'addEntries': return { ...s, entries: [...s.entries, ...a.entries] };
    case 'update': return { ...s, entries: s.entries.map((e) => (e.id === a.id ? { ...e, ...a.patch, source: a.patch.category || a.patch.dir ? 'manual' : e.source } : e)) };
    case 'remove': return { ...s, entries: s.entries.filter((e) => e.id !== a.id) };
    case 'settings': return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'ai': return { ...s, settings: { ...s.settings, ai: { ...s.settings.ai, ...a.patch } } };
    case 'profile': return { ...s, profile: { ...s.profile, ...a.patch } };
    case 'month': return { ...s, month: a.month };
    case 'goal': return { ...s, goals: [...s.goals.filter((g) => g.id !== a.goal.id), a.goal] };
    case 'removeGoal': return { ...s, goals: s.goals.filter((g) => g.id !== a.id) };
    case 'seenBadges': return { ...s, seenBadges: Array.from(new Set([...s.seenBadges, ...a.ids])) };
    case 'seenRestored': return { ...s, seenRestored: { ...s.seenRestored, [a.month]: a.n } };
    case 'replace': return a.state;
    case 'reset': return initialState();
  }
}

export function useGlomeStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
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

export async function importState(file: File, current: State): Promise<State> {
  const data = JSON.parse(await file.text()) as Partial<State>;
  if (!Array.isArray(data.entries)) throw new Error('This file is not a CashGlome world.');
  return { ...current, ...data, settings: { ...current.settings, ...data.settings, ai: { ...current.settings.ai, ...data.settings?.ai, key: current.settings.ai.key } } } as State;
}
