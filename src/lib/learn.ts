// Categories that learn. When you correct one ("Bolt" is getting around, not shopping), CashGlome remembers
// it on this device and files the same thing the same way next time, whether Muse or the offline reader
// read it. The most common complaint about money apps is categories that never learn; this is the fix.
import { cat } from './categories';
import type { Entry, Parsed } from './types';

const KEY = 'cg-learned';
type Memory = Record<string, string>; // key words of a label → category id

/** "Bolt to work 2k" and "bolt home" share the key "bolt". Numbers and small words don't count. */
const SMALL = new Set(['to', 'the', 'a', 'an', 'for', 'at', 'on', 'in', 'of', 'and', 'my', 'from', 'with', 'x']);
export function keyOf(label: string) {
  return label.toLowerCase().replace(/[^a-zÀ-ɏ ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !SMALL.has(w)).slice(0, 2).join(' ');
}
const read = (): Memory => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export function learn(label: string, category: string) {
  const k = keyOf(label);
  if (!k) return;
  const m = read();
  m[k] = category;
  const first = k.split(' ')[0];
  if (first !== k) m[first] = category; // "bolt home" also teaches "bolt"
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage full or private */ }
}

/** The remembered category for a reading, if any (and only if it points the same way, in or out). */
export function recall<T extends Pick<Parsed, 'label' | 'dir' | 'category'>>(p: T): T {
  const m = read();
  const k = keyOf(p.label);
  const id = m[k] ?? m[k.split(' ')[0]];
  return id && cat(id).dir === p.dir ? { ...p, category: id } : p;
}

/** Things you buy again and again, for one-tap repeats: same label and amount at least twice in 60 days. */
export function usuals(entries: Entry[], today: string, n = 3) {
  const since = new Date(today + 'T12:00'); since.setDate(since.getDate() - 60);
  const from = since.toISOString().slice(0, 10);
  const groups = new Map<string, { e: Entry; count: number; last: string }>();
  for (const e of entries) {
    if (e.date < from || e.dir !== 'out') continue;
    const k = `${e.label.toLowerCase()}|${e.amount}`;
    const g = groups.get(k);
    if (g) { g.count++; if (e.date >= g.last) { g.last = e.date; g.e = e; } } else groups.set(k, { e, count: 1, last: e.date });
  }
  return [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1)).slice(0, n).map((g) => g.e);
}
