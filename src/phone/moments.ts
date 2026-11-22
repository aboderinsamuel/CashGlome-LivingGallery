// What the phone home screen says and offers at this moment of the day, worked out on the device
// from what was written before. Nothing here counts days in a row: a missed day costs nothing.
import { cat } from '../lib/categories';
import { todayISO, uid } from '../lib/format';
import { addDays, routinesOf } from '../lib/memory';
import type { Entry, Memory, State } from '../lib/types';

export type Part = 'night' | 'morning' | 'midday' | 'afternoon' | 'evening';
export const partOfDay = (h: number): Part => (h < 5 ? 'night' : h < 11 ? 'morning' : h < 15 ? 'midday' : h < 18 ? 'afternoon' : 'evening');

/* ——— The daily prompt ——— */
const CLOSED_KEY = 'cg-day-closed';
export const dayClosed = (today = todayISO()) => { try { return localStorage.getItem(CLOSED_KEY) === today; } catch { return false; } };
export const closeDay = (today = todayISO()) => { try { localStorage.setItem(CLOSED_KEY, today); } catch { /* private mode */ } };

/* ——— One-tap chips ——— */
export interface Chip { key: string; label: string; entry?: Entry; fill?: string }

const STARTERS: Record<Part, string[]> = {
  night: ['Taxi', 'Snack', 'Delivery'],
  morning: ['Coffee', 'Transport', 'Breakfast', 'Groceries'],
  midday: ['Lunch', 'Coffee', 'Transport', 'Groceries'],
  afternoon: ['Snack', 'Transport', 'Groceries', 'Fuel'],
  evening: ['Dinner', 'Groceries', 'Taxi', 'Got paid'],
};

/** What this person usually writes around this time of day, newest amount first; starters fill the gaps.
 *  A usual is written with one tap; a starter only puts its word in the box and waits for the amount. */
export function chipsFor(state: State, now = new Date()): Chip[] {
  const today = todayISO(now);
  const part = partOfDay(now.getHours());
  const from = addDays(today, -60);
  const doneToday = new Set(state.entries.filter((e) => e.date === today).map((e) => e.label.toLowerCase()));
  const groups = new Map<string, { last: Entry; count: number; here: number }>();
  for (const e of state.entries) {
    if (e.dir !== 'out' || e.date < from || e.source === 'routine') continue;
    const k = e.label.toLowerCase();
    const g = groups.get(k) ?? { last: e, count: 0, here: 0 };
    g.count++;
    if (partOfDay(new Date(e.createdAt).getHours()) === part) g.here++;
    if (e.createdAt >= g.last.createdAt) g.last = e;
    groups.set(k, g);
  }
  const usual: Chip[] = [...groups.entries()]
    .filter(([k, g]) => g.count >= 2 && !doneToday.has(k))
    .sort((a, b) => b[1].here * 2 + b[1].count - (a[1].here * 2 + a[1].count))
    .slice(0, 4)
    .map(([k, g]) => ({ key: 'u:' + k, label: g.last.label, entry: g.last }));
  const have = new Set(usual.map((c) => c.label.toLowerCase()));
  const starters = STARTERS[part]
    .filter((w) => !have.has(w.toLowerCase()) && !doneToday.has(w.toLowerCase()))
    .slice(0, Math.max(0, 4 - usual.length))
    .map((w) => ({ key: 's:' + w, label: w, fill: w + ' ' }));
  return [...usual, ...starters];
}

/* ——— Cash by balance ———
 * Cash can't be followed line by line. A withdrawal becomes a pocket; a day or more later one question,
 * "how much is left?", files the gap as cash spending. The withdrawal itself is never counted as spending. */
export interface CashPocket { id: string; amount: number; left: number; date: string; askedOn?: string; closed?: boolean }
export const WITHDRAWAL = /\b(withdr[ae]w\w*|atm|wdl)\b/i;
export const newPocket = (amount: number, date = todayISO()): CashPocket => ({ id: uid(), amount, left: amount, date });
export const dueCash = (s: State, today = todayISO()) => (s.cash ?? []).find((p) => !p.closed && p.left > 0 && p.date < today && p.askedOn !== today) ?? null;
export const cashEntry = (gap: number, pocket: CashPocket, left: number): Entry => ({
  id: uid(), text: `Cash: ${pocket.left} down to ${left}`, label: 'Cash spending', amount: Math.round(gap * 100) / 100, dir: 'out',
  category: 'other', date: todayISO(), createdAt: Date.now(), source: 'manual', confidence: 1,
});

/* ——— Recurring: after the third time, offer to let it write itself ——— */
const OFFERED_KEY = 'cg-offered';
const offered = (): string[] => { try { return JSON.parse(localStorage.getItem(OFFERED_KEY) || '[]'); } catch { return []; } };
export const markOffered = (label: string) => { try { localStorage.setItem(OFFERED_KEY, JSON.stringify([...new Set([...offered(), label.toLowerCase()])].slice(-200))); } catch { /* fine */ } };

export interface RecurringOffer { label: string; amount: number; days: number[]; category: string; time: string }

export function recurringOffer(state: State, just: Entry): RecurringOffer | null {
  if (just.dir !== 'out' || just.source === 'routine') return null;
  const k = just.label.toLowerCase();
  if (offered().includes(k)) return null;
  if (routinesOf(state).some((m) => (m.label ?? '').toLowerCase() === k)) return null;
  const from = addDays(just.date, -45);
  const same = [...state.entries.filter((e) => e.id !== just.id), just].filter((e) => e.dir === 'out' && e.label.toLowerCase() === k && e.date >= from);
  const dates = new Set(same.map((e) => e.date));
  if (dates.size < 3) return null;
  const amounts = same.map((e) => e.amount).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)];
  if (amounts.some((a) => Math.abs(a - median) > median * 0.15)) return null; // the price moves too much to write blind
  const days = [...new Set([...dates].map((d) => new Date(d + 'T12:00').getDay()))].sort();
  const hours = same.map((e) => new Date(e.createdAt).getHours()).sort((a, b) => a - b);
  const time = String(Math.min(22, hours[Math.floor(hours.length / 2)] + 1)).padStart(2, '0') + ':00';
  return { label: just.label, amount: median, days, category: just.category, time };
}

/** The routine that offer becomes: written on its days without asking, starting tomorrow. */
export function routineFrom(o: RecurringOffer): Memory {
  const now = Date.now();
  return {
    id: uid(), kind: 'routine', text: `${o.label} ${o.amount}, written for me`, label: o.label, amount: o.amount, dir: 'out',
    category: cat(o.category).id, days: o.days, time: o.time, mode: 'auto', since: addDays(todayISO(), 1), createdAt: now, updatedAt: now,
  };
}

/** The last three days of a month, or any month already over: time to offer its card. */
export function cardSeason(month: string, now = new Date()) {
  const today = todayISO(now);
  if (month < today.slice(0, 7)) return true;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return month === today.slice(0, 7) && now.getDate() >= last - 2;
}
