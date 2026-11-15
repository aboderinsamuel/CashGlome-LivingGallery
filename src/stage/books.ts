// The accounts a money diary can keep without anyone filling in a form:
//  - People: who owes whom, read from the lines already written ("lent Ada 5k", "Ada paid back 2k").
//  - Circles: rotating savings (tontine, susu, tanda, hui, kye, chit fund, stokvel, arisan…), from one sentence.
//  - Prices: a personal inflation rate, from the things bought again and again.
//  - The income record: every month's money in, ready to print for a landlord or a lender.
// All of it is counted here, on the device.
import { cat } from '../lib/categories';
import { monthOf, todayISO, uid } from '../lib/format';
import type { Circle, Entry } from '../lib/types';

/* ——— People ——— */
const STOP = new Set('my the a an to from with for of on in at back some money cash me him her them it this that and my your our their i you we they is was be am are pay paid send sent give gave lent lend borrow borrowed owe owes owed split repaid return returned'.split(' '));
const nameAt = (s: string | undefined) => {
  if (!s) return null;
  const w = s.trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, '');
  if (!w || w.length < 2 || STOP.has(w.toLowerCase()) || /^\d/.test(w)) return null;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};

export interface PersonLedger { name: string; owesYou: number; youOwe: number; net: number; lines: { date: string; text: string; delta: number }[] }

/** Positive net: they owe you. Negative: you owe them. */
export function peopleOf(entries: Entry[]): PersonLedger[] {
  const book = new Map<string, PersonLedger>();
  const add = (name: string | null, delta: number, e: Entry) => {
    if (!name || !delta) return;
    const p = book.get(name) ?? { name, owesYou: 0, youOwe: 0, net: 0, lines: [] };
    p.net += delta; p.lines.push({ date: e.date, text: e.text || e.label, delta });
    book.set(name, p);
  };
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const t = ' ' + (e.text || e.label).toLowerCase().replace(/[₦$£€¥₹]?\s?\d[\d,.]*\s*[km]?\b/g, ' ') + ' ';
    let m: RegExpMatchArray | null;
    if ((m = t.match(/\b(?:lent|lend|loaned|borrow(?:ed)?)\s+(\p{L}+)(?!\s+from)/u)) && !/\bborrow(?:ed)?\s+\p{L}+\s+from\b|\bi borrowed\b|\bborrowed from\b/u.test(t) && e.dir === 'out') add(nameAt(m[1]), e.amount, e);
    else if ((m = t.match(/\bborrowed?\s+(?:\p{L}+\s+)?from\s+(\p{L}+)/u)) || (m = t.match(/\b(\p{L}+)\s+(?:lent|loaned|borrowed)\s+me\b/u))) add(nameAt(m[1]), -e.amount, e);
    else if ((m = t.match(/\b(\p{L}+)\s+(?:paid|sent|gave)\s+(?:me\s+)?back\b/u)) || (m = t.match(/\b(\p{L}+)\s+(?:repaid|returned)\b/u))) add(nameAt(m[1]), -e.amount, e);
    else if ((m = t.match(/\b(?:paid|repaid|returned|sent)\s+(\p{L}+)\s+back\b/u)) || (m = t.match(/\b(?:paid back|repaid|returned)\s+(\p{L}+)/u))) add(nameAt(m[1]), e.amount, e);
    else if ((m = t.match(/\bsplit\b.*?\bwith\s+(\p{L}+)/u)) && e.dir === 'out') add(nameAt(m[1]), Math.round(e.amount / 2), e);
    else if ((m = t.match(/\b(\p{L}+)\s+owes?\s+me\b/u))) add(nameAt(m[1]), e.amount, e);
    else if ((m = t.match(/\bi\s+owe\s+(\p{L}+)/u))) add(nameAt(m[1]), -e.amount, e);
  }
  return [...book.values()].map((p) => ({ ...p, owesYou: Math.max(0, p.net), youOwe: Math.max(0, -p.net) }))
    .filter((p) => p.net !== 0 || p.lines.length > 1)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/* ——— Circles ——— */
/** Names for a rotating savings circle around the world. */
export const CIRCLE_WORDS = ['ajo', 'esusu', 'susu', 'tontine', 'tanda', 'cundina', 'hui', '會', 'kye', 'gye', '계', 'chit', 'chit fund', 'chama', 'stokvel', 'arisan', 'paluwagan', 'partner', 'sol', 'junta', 'pandero', 'committee', 'bisi', 'gameya', 'jam\'iya', 'pasanaku', 'rosca', 'savings circle', 'box hand', 'merry-go-round', 'likelemba', 'njangi', 'osusu', 'mukando', 'tanomoshi', 'kou'];
const CIRCLE_RE = new RegExp(`(?:^|[^\\p{L}])(${CIRCLE_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:$|[^\\p{L}])`, 'iu');
export const mentionsCircle = (text: string) => CIRCLE_RE.test(text);

const amountOf = (s: string) => {
  const m = s.match(/(\d[\d,.]*)\s*([km])?\b/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Math.round(n * (m[2]?.toLowerCase() === 'k' ? 1e3 : m[2]?.toLowerCase() === 'm' ? 1e6 : 1));
};

/**
 * Reads one sentence about a circle: "I'm in an ajo of 10 people, 20k monthly, my turn is 4th".
 * Returns null when the sentence doesn't name a circle, the members and a contribution.
 */
export function readCircle(text: string, today = todayISO()): Circle | null {
  const t = text.toLowerCase();
  const word = text.match(CIRCLE_RE)?.[1];
  if (!word) return null;
  const members = Number(t.match(/(\d+)\s*(?:people|persons|members|of us|hands|heads|slots)/)?.[1] ?? t.match(/\bof\s+(\d+)\b/)?.[1] ?? 0);
  const amt = t.replace(/(\d+)\s*(?:people|persons|members|of us|hands|heads|slots)/, ' ').replace(/\b(\d+)(st|nd|rd|th)\b/g, ' ').replace(/\bof\s+\d+\b/, ' ');
  const contribution = amountOf(amt);
  const every: Circle['every'] = /\bweek|weekly\b/.test(t) ? 'week' : 'month';
  const turn = Number(t.match(/\b(?:turn|collect|take|my\s+(?:month|week|round))\D{0,12}(\d+)/)?.[1] ?? t.match(/\b(\d+)(?:st|nd|rd|th)\b/)?.[1] ?? 1);
  if (!members || members < 2 || !contribution) return null;
  const now = Date.now();
  return { id: uid(), name: word.charAt(0).toUpperCase() + word.slice(1), members, contribution, every, start: today.slice(0, 8) + '01', myTurn: Math.min(members, Math.max(1, turn)), text, createdAt: now, updatedAt: now };
}

const addRounds = (start: string, every: Circle['every'], n: number) => {
  const d = new Date(start + 'T12:00');
  if (every === 'week') d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n);
  return todayISO(d);
};

export interface CircleStatus {
  circle: Circle; round: number; pot: number; paidIn: number; expected: number; behind: number;
  payoutDate: string; payoutDone: boolean; roundsToPayout: number; schedule: { round: number; date: string; mine: boolean }[];
}
export function circleStatus(c: Circle, entries: Entry[], today = todayISO()): CircleStatus {
  const schedule = Array.from({ length: c.members }, (_, i) => ({ round: i + 1, date: addRounds(c.start, c.every, i), mine: i + 1 === c.myTurn }));
  const round = Math.max(1, schedule.filter((s) => s.date <= today).length);
  const word = c.name.toLowerCase();
  const paidIn = entries.filter((e) => e.dir === 'out' && e.date >= c.start && (e.text + ' ' + e.label).toLowerCase().includes(word)).reduce((a, e) => a + e.amount, 0);
  const expected = round * c.contribution;
  const payoutDate = schedule[c.myTurn - 1].date;
  return { circle: c, round, pot: c.contribution * c.members, paidIn, expected, behind: Math.max(0, expected - paidIn), payoutDate, payoutDone: payoutDate <= today, roundsToPayout: Math.max(0, c.myTurn - round), schedule };
}

/* ——— Prices: a personal inflation rate ——— */
export interface PriceMove { label: string; then: number; now: number; change: number; thenMonth: string; nowMonth: string; times: number }
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/** Things bought in at least two different months over the last six, and how their price moved. */
export function pricesOf(entries: Entry[], today = todayISO()) {
  const since = (() => { const d = new Date(today + 'T12:00'); d.setMonth(d.getMonth() - 6); return todayISO(d); })();
  const by = new Map<string, Map<string, number[]>>();
  for (const e of entries) {
    if (e.dir !== 'out' || e.date < since || ['rent', 'savings', 'debt', 'giving', 'business'].includes(e.category)) continue;
    const k = norm(e.label);
    if (!k || k.length < 3) continue;
    const months = by.get(k) ?? new Map<string, number[]>();
    const mm = monthOf(e.date);
    months.set(mm, [...(months.get(mm) ?? []), e.amount]);
    by.set(k, months);
  }
  const moves: PriceMove[] = [];
  for (const [label, months] of by) {
    const keys = [...months.keys()].sort();
    if (keys.length < 2) continue;
    const then = median(months.get(keys[0])!), now = median(months.get(keys[keys.length - 1])!);
    const times = keys.reduce((a, k) => a + months.get(k)!.length, 0);
    if (then > 0) moves.push({ label: label.charAt(0).toUpperCase() + label.slice(1), then, now, change: now / then - 1, thenMonth: keys[0], nowMonth: keys[keys.length - 1], times });
  }
  // The personal rate weights each thing by how much of the money it takes.
  const weight = moves.reduce((a, x) => a + x.now * x.times, 0);
  const rate = weight ? moves.reduce((a, x) => a + x.change * x.now * x.times, 0) / weight : null;
  return { rate, moves: moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8) };
}

/* ——— The income record ——— */
export interface IncomeMonth { month: string; total: number; byCat: { id: string; name: string; total: number; count: number }[]; count: number }
const LOAN_IN = /(borrow(ed)?|loan|lent me|advance from)/i;
export function incomeRecord(entries: Entry[], months = 6, today = todayISO()): IncomeMonth[] {
  const out: IncomeMonth[] = [];
  const d = new Date(today + 'T12:00'); d.setDate(1);
  for (let i = 0; i < months; i++) {
    const mm = monthOf(todayISO(d));
    // Income only: a refund is your own money back, and a loan has to be repaid.
    const ins = entries.filter((e) => e.dir === 'in' && monthOf(e.date) === mm && e.category !== 'refund' && !LOAN_IN.test(`${e.label} ${e.text}`));
    const by = new Map<string, { total: number; count: number }>();
    ins.forEach((e) => { const x = by.get(e.category) ?? { total: 0, count: 0 }; x.total += e.amount; x.count++; by.set(e.category, x); });
    out.push({ month: mm, total: ins.reduce((a, e) => a + e.amount, 0), count: ins.length, byCat: [...by].map(([id, v]) => ({ id, name: cat(id).name, ...v })).sort((a, b) => b.total - a.total) });
    d.setMonth(d.getMonth() - 1);
  }
  // Leave off the empty months from before the first money was written.
  while (out.length > 1 && out[out.length - 1].total === 0) out.pop();
  return out;
}
