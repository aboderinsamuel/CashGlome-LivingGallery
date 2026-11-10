import { cat } from './categories';
import { computeStats, characterOf, goalEta, projection, type Stats } from './analytics';
import { money, monthOf, todayISO } from './format';
import type { Entry, State } from './types';

/* ——— The collection: public-domain paintings bundled in /art (Wikimedia Commons) ——— */
export interface Painting { id: string; title: string; artist: string; year: string; place: string; focus: string; why: string }
const P = (id: string, title: string, artist: string, year: string, place: string, focus: string, why: string): Painting => ({ id, title, artist, year, place, focus, why });

export const PAINTINGS: Record<string, Painting> = {
  moneylender: P('moneylender', 'The Moneylender and His Wife', 'Quentin Matsys', '1514', 'Musée du Louvre, Paris', '45% 72%', 'Every coin weighed, every page read.'),
  wedding: P('wedding', 'The Peasant Wedding', 'Pieter Bruegel the Elder', '1567', 'Kunsthistorisches Museum, Vienna', '50% 62%', 'A table that never seems to empty.'),
  icarus: P('icarus', 'Landscape with the Fall of Icarus', 'after Pieter Bruegel the Elder', 'c. 1560', 'Royal Museums of Fine Arts, Brussels', '70% 70%', 'Flying close to the sun, while the ploughman keeps ploughing.'),
  cardsharps: P('cardsharps', 'The Cardsharps (detail)', 'Caravaggio', 'c. 1594', 'Kimbell Art Museum, Fort Worth', '30% 55%', 'The dice are always on the table.'),
  athens: P('athens', 'The School of Athens', 'Raphael', '1511', 'Apostolic Palace, Vatican', '50% 45%', 'Spending on what you know.'),
  hunters: P('hunters', 'The Hunters in the Snow', 'Pieter Bruegel the Elder', '1565', 'Kunsthistorisches Museum, Vienna', '50% 55%', 'Out in the cold, going somewhere.'),
  harvesters: P('harvesters', 'The Harvesters', 'Pieter Bruegel the Elder', '1565', 'The Metropolitan Museum of Art, New York', '45% 60%', 'What you sowed, brought in.'),
  gisze: P('gisze', 'The Merchant Georg Gisze', 'Hans Holbein the Younger', '1532', 'Gemäldegalerie, Berlin', '50% 40%', 'A room full of fine things, each one chosen.'),
  goldsmith: P('goldsmith', 'A Goldsmith in His Shop', 'Petrus Christus', '1449', 'The Metropolitan Museum of Art, New York', '50% 55%', 'Rings weighed on the counter.'),
  babel: P('babel', 'The Tower of Babel', 'Pieter Bruegel the Elder', 'c. 1568', 'Museum Boijmans Van Beuningen, Rotterdam', '50% 45%', 'Built one level at a time.'),
  carnival: P('carnival', 'The Fight Between Carnival and Lent', 'Pieter Bruegel the Elder', '1559', 'Kunsthistorisches Museum, Vienna', '50% 60%', 'Feast on one side, restraint on the other.'),
  magi: P('magi', 'Adoration of the Magi', 'Sandro Botticelli', 'c. 1475', 'Uffizi Gallery, Florence', '50% 55%', 'Everyone arrives carrying a gift.'),
  matthew: P('matthew', 'The Calling of Saint Matthew', 'Caravaggio', '1600', 'San Luigi dei Francesi, Rome', '35% 55%', 'The collector at his table, counting.'),
  census: P('census', 'The Census at Bethlehem', 'Pieter Bruegel the Elder', '1566', 'Royal Museums of Fine Arts, Brussels', '40% 60%', 'Everyone on the move, everyone paying their dues.'),
  arnolfini: P('arnolfini', 'The Arnolfini Portrait', 'Jan van Eyck', '1434', 'The National Gallery, London', '50% 40%', 'Home, kept carefully.'),
  hare: P('hare', 'Young Hare', 'Albrecht Dürer', '1502', 'Albertina, Vienna', '50% 50%', 'The first study, before the great works.'),
};
export const artSrc = (id: string) => `./art/${id}.jpg`;

const BY_CHARACTER: Record<string, string> = {
  beginner: 'hare', saver: 'moneylender', overreacher: 'icarus', host: 'wedding', giver: 'magi', homebody: 'arnolfini',
  commuter: 'census', collector: 'gisze', subscriber: 'matthew', nightowl: 'carnival', risktaker: 'cardsharps', explorer: 'hunters', student: 'athens',
};
/** The painting a month is restored into: chosen by who you were that month. */
export function paintingOf(s: Stats): Painting {
  return PAINTINGS[BY_CHARACTER[characterOf(s).id] ?? 'moneylender'];
}

export const WALLPAPERS = ['hunters', 'harvesters', 'babel', 'census', 'wedding', 'moneylender', 'icarus', 'athens'];
export function seasonalWallpaper(d = new Date()) {
  const m = d.getMonth();
  return m >= 10 || m <= 1 ? 'hunters' : m >= 7 ? 'harvesters' : m >= 4 ? 'wedding' : 'babel';
}

/* ——— Seeded randomness ——— */
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ——— Restoration: every month a varnished painting, cleaned patch by patch as you write ——— */
export const COLS = 6, ROWS = 5, PATCHES = COLS * ROWS;
export const ENDOWED = 2; // two corners clean on day one, so nobody starts from zero
export interface Restoration { restored: number; order: number[]; gilded: Entry[]; complete: boolean; today: number; todayCap: number; remaining: number }

export const isGilded = (e: Entry) => hash(e.id) % 7 === 0;

export function restorationOf(entries: Entry[], month: string): Restoration {
  const list = entries.filter((e) => monthOf(e.date) === month).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const byDay = new Map<string, Entry[]>();
  for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  let restored = ENDOWED, today = 0;
  const gilded: Entry[] = [];
  const now = todayISO();
  for (const [day, items] of byDay) {
    // First line of a day cleans one patch, the next two clean one each: showing up daily beats bulk entry.
    let n = Math.min(3, items.length);
    for (const e of items) if (isGilded(e)) { n++; gilded.push(e); }
    restored += n;
    if (day === now) today = n;
  }
  restored = Math.min(PATCHES, restored);
  // Edges lift first, the heart of the painting last.
  const r = rng(hash(month));
  const order = Array.from({ length: PATCHES }, (_, i) => i)
    .map((i) => { const x = (i % COLS) - (COLS - 1) / 2, y = Math.floor(i / COLS) - (ROWS - 1) / 2; return { i, k: -Math.hypot(x / COLS, y / ROWS) + r() * 0.35 }; })
    .sort((a, b) => a.k - b.k).map((o) => o.i);
  return { restored, order, gilded, complete: restored >= PATCHES, today, todayCap: 3, remaining: PATCHES - restored };
}

/* ——— The candle: a daily streak, with wax seals that protect a missed day ——— */
export interface Candle { streak: number; seals: number; litToday: boolean; best: number; sealed: string[]; toNextSeal: number }
export function candleOf(entries: Entry[]): Candle {
  const days = new Set(entries.map((e) => e.date));
  if (!days.size) return { streak: 0, seals: 0, litToday: false, best: 0, sealed: [], toNextSeal: 7 };
  const first = [...days].sort()[0];
  const d = new Date(first + 'T12:00');
  const today = todayISO();
  let run = 0, seals = 0, best = 0, sinceSeal = 0;
  const sealed: string[] = [];
  while (todayISO(d) <= today) {
    const iso = todayISO(d);
    if (days.has(iso)) {
      run++; sinceSeal++;
      if (sinceSeal >= 7) { seals = Math.min(2, seals + 1); sinceSeal = 0; }
    } else if (iso !== today) {
      if (seals > 0 && run > 0) { seals--; sealed.push(iso); }
      else { run = 0; sinceSeal = 0; }
    }
    best = Math.max(best, run);
    d.setDate(d.getDate() + 1);
  }
  return { streak: run, seals, litToday: days.has(today), best, sealed, toNextSeal: seals >= 2 ? 0 : 7 - sinceSeal };
}

export const RANKS = ['Apprentice', 'Journeyman', 'Artisan', 'Master', 'Patron', 'Maestro', 'Medici'];

/* ——— Today's card: one observation a day, drawn from your own entries ——— */
export interface DayCard { title: string; line: string; painting: Painting; focus: string; numeral: string }
export function dayCardOf(state: State, date = todayISO()): DayCard | null {
  const cur = state.profile.currency;
  const s = computeStats(state.entries, monthOf(date));
  const all = state.entries;
  if (all.length < 3) return null;
  const m = (n: number) => money(n, cur, { compact: n >= 1e6 });
  const pool: { title: string; line: string }[] = [];
  const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const wd = s.weekday.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  if (wd[0][0] > 0) pool.push({ title: `${days[wd[0][1]]} cost the most`, line: `${m(wd[0][0])} this month has gone out on ${days[wd[0][1]]}. ${days[wd[wd.length - 1][1]]} are your quietest.` });
  const top = s.byCat.find((c) => cat(c.id).nature === 'want');
  if (top && top.count >= 2) pool.push({ title: `${cat(top.id).name}, ${top.count} times`, line: `About ${m(top.avg)} each time. Skipping one a week keeps ${m(top.avg * 52)} a year.` });
  const quiet = s.days.slice(0, Math.max(1, s.dayOfMonth)).filter((d) => d.out === 0).length;
  if (s.dayOfMonth > 3) pool.push({ title: quiet ? `${quiet} quiet ${quiet === 1 ? 'day' : 'days'}` : 'No quiet days yet', line: quiet ? `Days this month with nothing spent. Each one is ${m(projection(s).dailyBurn)} you kept.` : `Every day so far has cost something. One quiet day keeps about ${m(projection(s).dailyBurn)}.` });
  if (s.biggest) {
    const small = s.entries.filter((e) => e.dir === 'out' && e.amount < s.biggest!.amount / 4).sort((a, b) => b.amount - a.amount)[0];
    const plural = (w: string) => (/s$/i.test(w) ? w : w + 's');
    if (small) pool.push({ title: `${s.biggest.label}, counted in ${plural(small.label.toLowerCase())}`, line: `Your biggest spend, ${m(s.biggest.amount)}, is the same as ${Math.round(s.biggest.amount / small.amount)} rounds of ${small.label.toLowerCase()}.` });
  }
  if (s.inflow > 0) pool.push({ title: `${Math.round(Math.max(0, s.savingsRate) * 100)}% kept`, line: s.savingsRate >= 0.2 ? 'More than the one-in-five most advisers aim for. Keep the habit going.' : `One in five is a common target. That's ${m(s.inflow * 0.2)} this month.` });
  const g = state.goals[0];
  if (g && s.inflow) { const eta = goalEta(g, Math.max(s.inflow - projection(s).projectedSpend, s.inflow * 0.1)); if (Number.isFinite(eta)) pool.push({ title: `${g.name}, ${eta} ${eta === 1 ? 'month' : 'months'} out`, line: `At the pace you're keeping now. Cut one small habit and it moves closer.` }); }
  const c = candleOf(all);
  if (c.streak >= 2 && c.toNextSeal > 0) pool.push({ title: `${c.toNextSeal} ${c.toNextSeal === 1 ? 'day' : 'days'} to a seal`, line: 'A wax seal protects your candle if you miss a day. You can hold two.' });
  if (!pool.length) return null;
  const r = rng(hash(date + state.profile.name));
  const pick = pool[Math.floor(r() * pool.length)];
  const ids = Object.keys(PAINTINGS);
  const painting = PAINTINGS[ids[Math.floor(r() * ids.length)]];
  const focus = `${Math.round(20 + r() * 60)}% ${Math.round(20 + r() * 60)}%`;
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  return { ...pick, painting, focus, numeral: numerals[Math.floor(r() * numerals.length)] };
}
