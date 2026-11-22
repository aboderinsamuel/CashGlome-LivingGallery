import { cat } from './categories';
import { daysInMonth, money, monthLabel, monthOf, shiftMonth, todayISO } from './format';
import type { Entry, Goal, State } from './types';

export interface CatStat { id: string; total: number; count: number; share: number; avg: number }
export interface Stats {
  month: string;
  entries: Entry[];
  inflow: number;
  outflow: number;
  spend: number; // outflow excluding savings
  net: number;
  vault: number;
  savingsRate: number;
  byCat: CatStat[];
  inByCat: CatStat[];
  needs: number; wants: number; giving: number;
  joy: number; regret: number;
  weekday: number[];
  days: { date: string; out: number; in: number; count: number }[];
  biggest?: Entry;
  daysLogged: number;
  harmony: number;
  dayOfMonth: number;
  monthDays: number;
  isCurrent: boolean;
}

export const monthEntries = (entries: Entry[], month: string) => entries.filter((e) => monthOf(e.date) === month);

export function computeStats(all: Entry[], month: string): Stats {
  const entries = monthEntries(all, month);
  const monthDays = daysInMonth(month);
  const now = todayISO();
  const isCurrent = monthOf(now) === month;
  const dayOfMonth = isCurrent ? Number(now.slice(8, 10)) : monthOf(now) > month ? monthDays : 0;
  let inflow = 0, outflow = 0, vault = 0, needs = 0, wants = 0, giving = 0, joy = 0, regret = 0;
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const cats = new Map<string, CatStat>();
  const ins = new Map<string, CatStat>();
  const days = Array.from({ length: monthDays }, (_, i) => ({ date: `${month}-${String(i + 1).padStart(2, '0')}`, out: 0, in: 0, count: 0 }));
  let biggest: Entry | undefined;
  for (const e of entries) {
    const c = cat(e.category);
    const d = days[Number(e.date.slice(8, 10)) - 1];
    if (d) d.count++;
    if (e.dir === 'in') {
      inflow += e.amount; if (d) d.in += e.amount;
      const s = ins.get(e.category) ?? { id: e.category, total: 0, count: 0, share: 0, avg: 0 };
      s.total += e.amount; s.count++; ins.set(e.category, s);
      continue;
    }
    outflow += e.amount;
    if (c.nature === 'save') vault += e.amount;
    else {
      if (d) d.out += e.amount;
      if (c.nature === 'need') needs += e.amount;
      else if (c.nature === 'give') giving += e.amount;
      else wants += e.amount;
      if (e.feeling === 'joy') joy += e.amount;
      if (e.feeling === 'regret') regret += e.amount;
      const [Y, M, D] = e.date.split('-').map(Number);
      weekday[new Date(Y, M - 1, D).getDay()] += e.amount;
      if (!biggest || e.amount > biggest.amount) biggest = e;
    }
    const s = cats.get(e.category) ?? { id: e.category, total: 0, count: 0, share: 0, avg: 0 };
    s.total += e.amount; s.count++; cats.set(e.category, s);
  }
  const spend = outflow - vault;
  const byCat = [...cats.values()].map((s) => ({ ...s, share: outflow ? s.total / outflow : 0, avg: s.total / s.count })).sort((a, b) => b.total - a.total);
  const inByCat = [...ins.values()].map((s) => ({ ...s, share: inflow ? s.total / inflow : 0, avg: s.total / s.count })).sort((a, b) => b.total - a.total);
  const savingsRate = inflow > 0 ? (inflow - spend) / inflow : 0;
  const daysLogged = new Set(entries.map((e) => e.date)).size;

  let harmony = 50;
  if (inflow > 0) {
    const sr = Math.max(-1, Math.min(1, savingsRate));
    harmony = 35 + sr * 70 - Math.max(0, wants / inflow - 0.3) * 60 - (spend > 0 ? (regret / spend) * 25 : 0) + Math.min(12, daysLogged * 0.8);
  } else if (outflow > 0) harmony = 30 - Math.min(20, spend ? (regret / spend) * 20 : 0) + Math.min(12, daysLogged);
  harmony = Math.round(Math.max(3, Math.min(99, harmony)));

  return { month, entries, inflow, outflow, spend, net: inflow - outflow, vault, savingsRate, byCat, inByCat, needs, wants, giving, joy, regret, weekday, days, biggest, daysLogged, harmony, dayOfMonth, monthDays, isCurrent };
}

/** Scale a partial month to a full-month estimate. */
export const paceOf = (s: Stats) => (s.isCurrent && s.dayOfMonth > 0 ? s.monthDays / s.dayOfMonth : 1);

// ——— Characters ———
export interface Character { id: string; name: string; line: string; sticker: string; color: string }
const C = (id: string, name: string, line: string, sticker: string, color: string): Character => ({ id, name, line, sticker, color });
export const CHARACTERS = {
  beginner: C('beginner', 'The Beginner', 'Write a few more entries and your story will take shape.', 'star', '#DCDCD0'),
  saver: C('saver', 'The Saver', 'Most of what comes in stays with you.', 'piggy', '#146B45'),
  overreacher: C('overreacher', 'The Overreacher', 'More went out than came in.', 'card', '#C2512F'),
  host: C('host', 'The Host', 'You spend most when other people are around.', 'bowl', '#FF7A3D'),
  giver: C('giver', 'The Giver', 'A big part of your money goes to other people.', 'gift', '#FFB547'),
  homebody: C('homebody', 'The Homebody', 'Home comes first, and it shows.', 'house', '#C9B8FF'),
  commuter: C('commuter', 'The Commuter', 'Your money moves the way you do.', 'taxi', '#FFC93C'),
  collector: C('collector', 'The Collector', 'You like nice things, and you buy them.', 'bag', '#C2512F'),
  subscriber: C('subscriber', 'The Subscriber', 'Small monthly payments are adding up.', 'tv', '#FF5E8A'),
  nightowl: C('nightowl', 'The Night Owl', 'Your best memories come with receipts.', 'ticket', '#FF9EC7'),
  risktaker: C('risktaker', 'The Risk-taker', 'Bets are taking a real share of your money.', 'dice', '#17171C'),
  explorer: C('explorer', 'The Explorer', 'You spend on getting somewhere new.', 'plane', '#8EC5FF'),
  student: C('student', 'The Student', 'You are investing in what you know.', 'books', '#0E7C86'),
};

export function characterOf(s: Stats): Character {
  if (s.entries.length < 4) return CHARACTERS.beginner;
  if (s.inflow > 0 && s.outflow > s.inflow * 1.05) return CHARACTERS.overreacher;
  if (s.inflow > 0 && s.savingsRate >= 0.4) return CHARACTERS.saver;
  const sh = (ids: string[]) => s.byCat.filter((c) => ids.includes(c.id)).reduce((a, c) => a + c.share, 0);
  const cands: [Character, number][] = [
    [CHARACTERS.risktaker, sh(['betting']) * 2.5],
    [CHARACTERS.host, sh(['dining', 'fun']) * 1.1],
    [CHARACTERS.giver, sh(['giving']) * 1.3],
    [CHARACTERS.homebody, sh(['rent', 'bills', 'groceries']) * 0.75],
    [CHARACTERS.commuter, sh(['transport'])],
    [CHARACTERS.collector, sh(['shopping', 'tech', 'selfcare'])],
    [CHARACTERS.subscriber, sh(['subscriptions']) * 2.2],
    [CHARACTERS.explorer, sh(['travel'])],
    [CHARACTERS.student, sh(['education']) * 1.3],
  ];
  cands.sort((a, b) => b[1] - a[1]);
  return cands[0][1] > 0.12 ? cands[0][0] : CHARACTERS.homebody;
}

// ——— Chapter copy ———
export interface Seg { t: string; em?: boolean }
export interface Chapter { numeral: string; title: Seg[]; lede: string; character: Character }

/** Puts back a missing space between title parts ("mostly" + "at home" → "mostly at home"). */
export function spaceSegs(segs: Seg[]): Seg[] {
  return segs.map((seg, i) => {
    const prev = segs[i - 1]?.t ?? '';
    return i > 0 && /[\p{L}\p{N},;:]$/u.test(prev) && /^[\p{L}\p{N}]/u.test(seg.t) ? { ...seg, t: ' ' + seg.t } : seg;
  });
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** Three titles for each kind of month. Which one a month gets is set by its place in the calendar,
 *  so two months alike in a row still read as two chapters, and a title never changes as you write. */
const TITLES: Record<string, [string, string, string][]> = {
  dining: [['A month of ', 'full tables', '.'], ['A month of ', 'good company', '.'], ['A month ', 'eaten out', '.']],
  fun: [['A month of ', 'nights out', '.'], ['A month of ', 'small pleasures', '.'], ['A month ', 'well spent on joy', '.']],
  giving: [['A month spent ', 'on other people', '.'], ['A month of ', 'open hands', '.'], ['A month of ', 'gifts', '.']],
  transport: [['A month ', 'on the move', '.'], ['A month of ', 'many roads', '.'], ['A month ', 'between places', '.']],
  travel: [['A month ', 'away from home', '.'], ['A month of ', 'far places', '.'], ['A month ', 'on the road', '.']],
  shopping: [['A month of ', 'new things', '.'], ['A month at ', 'the market', '.'], ['A month of ', 'things chosen', '.']],
  tech: [['A month of ', 'new tools', '.'], ['A month of ', 'better machines', '.'], ['A month ', 'at the workbench', '.']],
  subscriptions: [['A month of ', 'small renewals', '.'], ['A month of ', 'quiet standing orders', '.'], ['A month of ', 'things that come back', '.']],
  betting: [['A month of ', 'long odds', '.'], ['A month of ', 'chances taken', '.'], ['A month ', 'at the card table', '.']],
  education: [['A month of ', 'learning', '.'], ['A month ', 'with books open', '.'], ['A month of ', 'lessons', '.']],
  selfcare: [['A month of ', 'looking after yourself', '.'], ['A month of ', 'gentle care', '.'], ['A month ', 'kept for you', '.']],
  rent: [['A month of ', 'keeping the lights on', '.'], ['A month of ', 'a roof and a door', '.'], ['A month ', 'at home', '.']],
  bills: [['A month of ', 'keeping the lights on', '.'], ['A month of ', 'dues paid', '.'], ['A month of ', 'the household books', '.']],
  groceries: [['A month of ', 'full cupboards', '.'], ['A month of ', 'the kitchen', '.'], ['A month of ', 'bread and salt', '.']],
  health: [['A month of ', 'getting well', '.'], ['A month of ', 'mending', '.'], ['A month ', 'of rest and remedies', '.']],
  ahead: [['A month that ran ', 'ahead of itself', '.'], ['A month ', 'a little over', '.'], ['A month that ', 'borrowed from the next', '.']],
  discipline: [['A month of ', 'quiet discipline', '.'], ['A month ', 'put by', '.'], ['A month of ', 'a steady hand', '.']],
};
/** Which of the three titles a month takes: its place in the calendar, so neighbours always differ. */
const variantOf = (month: string) => (Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1) % 3;

/** A number in Roman numerals, for any count of chapters. */
export function toRoman(n: number) {
  const t: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = ''; for (const [v, r] of t) while (n >= v) { out += r; n -= v; } return out || 'I';
}
/** Your chapters count your months in the book, not the calendar: the first month you wrote is Chapter I. */
export function chapterNumeral(entries: { date: string }[], month: string) {
  const months = new Set(entries.map((e) => e.date.slice(0, 7)).filter((m) => m <= month));
  months.add(month);
  return toRoman(months.size);
}

export function chapterOf(state: State, s: Stats): Chapter {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur, { compact: n >= 1e6 });
  const numeral = chapterNumeral(state.entries, s.month);
  const character = characterOf(s);
  const mon = monthLabel(s.month).split(' ')[0];
  if (!s.entries.length) {
    return { numeral, character, title: [{ t: 'A ' }, { t: 'blank page', em: true }, { t: '.' }], lede: s.isCurrent ? `Nothing written for ${mon} yet. Start with anything that came in or went out today, in your own words.` : `Nothing was written in ${mon}.` };
  }
  const topWant = s.byCat.find((c) => cat(c.id).nature !== 'save' && c.id !== 'other');
  let key: string;
  if (s.inflow > 0 && s.outflow > s.inflow * 1.05) key = 'ahead';
  else if (s.inflow > 0 && s.savingsRate >= 0.45 && s.dayOfMonth > 12) key = 'discipline';
  else key = topWant && topWant.id === 'rent' ? (s.byCat.find((c) => !['rent', 'savings', 'bills', 'other'].includes(c.id))?.id ?? 'rent') : topWant?.id ?? 'rent';
  const t = (TITLES[key] ?? TITLES.rent)[variantOf(s.month)];
  const title: Seg[] = [{ t: t[0] }, { t: t[1], em: true }, { t: t[2] }];
  const past = !s.isCurrent;
  const parts: string[] = [];
  if (s.inflow) parts.push(`${past ? `In ${mon} you brought in` : `So far this ${mon} you've brought in`} ${m(s.inflow)} and ${past ? 'let' : "let"} ${m(s.spend)} go${s.vault ? `, with ${m(s.vault)} put aside` : ''}.`);
  else parts.push(`${past ? `In ${mon} you spent` : `So far this ${mon} you've spent`} ${m(s.spend)}. No income is written down yet.`);
  const top = s.byCat.filter((c) => c.id !== 'savings');
  if (top[0]) parts.push(`${cat(top[0].id).name} took the biggest share, ${Math.round((top[0].total / Math.max(1, s.spend)) * 100)}%.`);
  const freq = [...top].sort((a, b) => b.count - a.count)[0];
  if (freq && freq.count >= 4) parts.push(`${cat(freq.id).name} came up ${freq.count} times${s.dayOfMonth ? `, about ${freq.count >= s.dayOfMonth ? 'every day' : `once every ${Math.max(1, Math.round(s.dayOfMonth / freq.count))} days`}` : ''}.`);
  if (s.regret > 0) parts.push(`You marked ${m(s.regret)} of it as a regret.`);
  return { numeral, title, lede: parts.join(' '), character };
}

// ——— Moments ———
const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
export interface Moment { kicker: string; big: string; line: string; sticker: string; color: string }
export function momentsOf(state: State, s: Stats): Moment[] {
  const cur = state.profile.currency;
  const out: Moment[] = [];
  const outs = s.entries.filter((e) => e.dir === 'out' && cat(e.category).nature !== 'save');
  const peak = [...s.days].sort((a, b) => b.out - a.out)[0];
  if (peak && peak.out > 0) {
    const items = outs.filter((e) => e.date === peak.date).sort((a, b) => b.amount - a.amount);
    const [Y, M, D] = peak.date.split('-').map(Number);
    const dt = new Date(Y, M - 1, D);
    out.push({ kicker: 'Biggest day', big: `${dt.toLocaleDateString(undefined, { weekday: 'long' })} the ${D}${ordinal(D)}`, line: `${money(peak.out, cur)} across ${items.length} ${items.length === 1 ? 'thing' : 'things'}: ${items.slice(0, 3).map((e) => e.label.toLowerCase()).join(', ')}.`, sticker: cat(items[0]?.category ?? 'other').sticker, color: '#FFC93C' });
  }
  const freq = [...s.byCat].filter((c) => c.id !== 'savings').sort((a, b) => b.count - a.count)[0];
  if (freq && freq.count >= 3) out.push({ kicker: 'Most often', big: `${freq.count} times`, line: `${cat(freq.id).name}, about ${money(freq.avg, cur)} each time.`, sticker: cat(freq.id).sticker, color: cat(freq.id).color });
  // quietest stretch
  let best = 0, run = 0;
  for (const d of s.days.slice(0, Math.max(1, s.dayOfMonth || s.monthDays))) { if (d.out === 0) { run++; best = Math.max(best, run); } else run = 0; }
  if (outs.length) out.push({ kicker: 'Longest no-spend stretch', big: best ? `${best} ${best === 1 ? 'day' : 'days'}` : 'None yet', line: best ? 'Days in a row with nothing spent.' : 'You spent something every day so far. Try one quiet day.', sticker: 'sprout', color: '#9FE3C6' });
  const avg = outs.reduce((a, e) => a + e.amount, 0) / Math.max(1, outs.length);
  const small = outs.filter((e) => e.amount < avg * 0.35);
  if (small.length >= 4) out.push({ kicker: 'Small spends', big: money(small.reduce((a, e) => a + e.amount, 0), cur, { compact: true }), line: `${small.length} little purchases that add up quietly.`, sticker: 'coin', color: '#F2E3B3' });
  if (s.biggest) out.push({ kicker: 'Biggest single spend', big: money(s.biggest.amount, cur, { compact: s.biggest.amount >= 1e6 }), line: s.biggest.label, sticker: cat(s.biggest.category).sticker, color: cat(s.biggest.category).color });
  return out.slice(0, 4);
}

// ——— Leaks & recurring ———
export interface Recurring { label: string; category: string; amount: number; months: number }
export function recurringOf(all: Entry[]): Recurring[] {
  const by = new Map<string, Entry[]>();
  for (const e of all) {
    if (e.dir !== 'out') continue;
    const k = e.label.toLowerCase().trim();
    by.set(k, [...(by.get(k) ?? []), e]);
  }
  const res: Recurring[] = [];
  for (const list of by.values()) {
    const months = new Set(list.map((e) => monthOf(e.date))).size;
    if (cat(list[0].category).nature === 'save') continue;
    if ((months >= 2 && list.length <= months * 1.5) || (cat(list[0].category).id === 'subscriptions')) {
      res.push({ label: list[list.length - 1].label, category: list[0].category, amount: list[list.length - 1].amount, months });
    }
  }
  return res.sort((a, b) => b.amount - a.amount).slice(0, 8);
}

// ——— Stickers: kind milestones, never a streak to lose ———
export interface Badge { id: string; name: string; desc: string; sticker: string; color: string; done: boolean; progress: number }
export function badgesOf(state: State): Badge[] {
  const e = state.entries;
  const s = computeStats(e, state.month);
  // Days written, in any order, and coming back after a break: kind ones, never a streak to lose.
  const days = [...new Set(e.map((x) => x.date))].sort();
  const cameBack = days.some((d, i) => i > 0 && (Date.parse(d) - Date.parse(days[i - 1])) / 864e5 >= 4);
  const B = (id: string, name: string, desc: string, sticker: string, color: string, progress: number): Badge => ({ id, name, desc, sticker, color, progress: Math.max(0, Math.min(1, progress)), done: progress >= 1 });
  return [
    B('first', 'First line', 'Write your first entry', 'star', '#FFC93C', e.length),
    B('25', 'Regular', 'Write 25 entries', 'books', '#0E7C86', e.length / 25),
    B('100', 'Archivist', 'Write 100 entries', 'box', '#D9B98C', e.length / 100),
    B('d3', 'Warming up', 'Write on 3 different days, any days', 'bulb', '#F2E3B3', days.length / 3),
    B('d30', 'A month of pages', 'Write on 30 different days, gaps and all', 'clover', '#B9D36C', days.length / 30),
    B('back', 'Welcome back', 'Come back after a few days away. Missing days costs nothing.', 'ticket', '#FF9EC7', cameBack ? 1 : 0),
    B('vault', 'First deposit', 'Put money into savings', 'piggy', '#146B45', e.filter((x) => x.category === 'savings').length),
    B('save20', 'Twenty percent', 'Keep 20% of a month\'s income', 'coin', '#FFB547', s.inflow ? s.savingsRate / 0.2 : 0),
    B('feel', 'Honest', 'Mark how 10 spends felt', 'heart', '#FF5E8A', e.filter((x) => x.feeling).length / 10),
    B('goal', 'Dreamer', 'Set a goal', 'plane', '#8EC5FF', state.goals.length),
    B('income', 'Paid', 'Write down money coming in', 'briefcase', '#5433EB', e.filter((x) => x.dir === 'in').length),
    B('harmony', 'Balanced', 'Reach a balance score of 80', 'sprout', '#9FE3C6', s.harmony / 80),
  ];
}

const FIXED = new Set(['rent', 'bills', 'subscriptions', 'debt', 'education']);
/** Month-end estimate: day-to-day spending scales with the days left; rent, bills and renewals don't. */
export function projection(s: Stats) {
  const d = Math.max(1, s.dayOfMonth || s.monthDays);
  const fixed = s.byCat.filter((c) => FIXED.has(c.id)).reduce((a, c) => a + c.total, 0);
  const variable = Math.max(0, s.spend - fixed);
  return { projectedSpend: fixed + (variable / d) * s.monthDays, dailyBurn: variable / d };
}
export function goalEta(goal: Goal, monthlySave: number) {
  return monthlySave <= 0 ? Infinity : Math.ceil(goal.amount / monthlySave);
}

export function tipsOf(s: Stats): string[] {
  const out: string[] = [];
  const top = s.byCat.find((c) => cat(c.id).nature === 'want');
  if (s.inflow && s.savingsRate < 0.2) out.push('Move 10% into savings on the day money arrives, before anything else.');
  if (top && top.share > 0.18) out.push(`Give ${cat(top.id).name.toLowerCase()} a weekly limit and check it here every Sunday.`);
  if (s.regret > 0) out.push('Before buying something you might regret, wait one night.');
  if (s.byCat.some((c) => c.id === 'subscriptions')) out.push('Cancel any subscription you haven\'t used in the last 30 days.');
  if (s.byCat.some((c) => c.id === 'betting')) out.push('Set a fixed monthly amount for betting and stop when it is gone.');
  if (!s.inflow) out.push('Write down your income too, so the story has both sides.');
  out.push('Write every entry, even small ones. Small ones tell the most.');
  return out.slice(0, 3);
}

export function statsDigest(state: State, month = state.month) {
  const s = computeStats(state.entries, month);
  const prev = computeStats(state.entries, shiftMonth(month, -1));
  const c = (x: CatStat) => ({ category: cat(x.id).name, total: Math.round(x.total), count: x.count, share: Math.round(x.share * 100) + '%' });
  return {
    name: state.profile.name, currency: state.profile.currency, month: monthLabel(month), dayOfMonth: s.dayOfMonth, daysInMonth: s.monthDays,
    inflow: Math.round(s.inflow), spend: Math.round(s.spend), savedOrInvested: Math.round(s.vault), keptRate: Math.round(s.savingsRate * 100) + '%',
    regretTagged: Math.round(s.regret), joyTagged: Math.round(s.joy), character: characterOf(s).name,
    spending: s.byCat.slice(0, 7).map(c), income: s.inByCat.slice(0, 4).map(c),
    lastMonth: { inflow: Math.round(prev.inflow), spend: Math.round(prev.spend) },
    recent: s.entries.slice(-30).map((e) => `${e.date} ${e.dir === 'in' ? '+' : '-'}${Math.round(e.amount)} ${e.label} [${cat(e.category).name}${e.feeling ? ', ' + e.feeling : ''}]`),
    goals: state.goals.map((g) => `${g.name}: ${g.amount}`),
  };
}
