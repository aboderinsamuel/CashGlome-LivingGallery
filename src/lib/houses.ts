// Houses: once a year the gallery calls you to one of six houses, each a painting, by how your money moves.
// Your first line calls you on day one; a year later the year's book calls you again (you may stay, or move).
// Every house is a compliment. Overspending isn't a bad house; it's the house of the bold.
import { hash } from './art';
import { todayISO } from './format';
import type { Entry } from './types';

export type HouseId = 'athens' | 'hunters' | 'feast' | 'scales' | 'wave' | 'river';
export interface House {
  id: HouseId;
  /** The word on the banner: House of <the> <word>. */
  word: string;
  the: boolean;
  painting: string;
  motto: string;
  /** Who it calls, in a few words. */
  calls: string;
  /** The house colour, taken from its painting. */
  color: string;
  /** The crest: a roundel cut from the painting (percent across, percent down, zoom). */
  crest: [number, number, number];
}

const H = (id: HouseId, word: string, the: boolean, painting: string, motto: string, calls: string, color: string, crest: [number, number, number]): House => ({ id, word, the, painting, motto, calls, color, crest });

export const HOUSES: Record<HouseId, House> = {
  athens: H('athens', 'Athens', false, 'athens', 'Know, then spend.', 'learners and planners', '#2F55A4', [51, 45, 3.6]),
  hunters: H('hunters', 'Hunters', true, 'hunters', 'Home before dark.', 'the ones always on their way', '#5E7486', [29, 62, 3.2]),
  feast: H('feast', 'Feast', true, 'wedding', 'Set another place.', 'hosts and givers', '#C23B22', [64, 35, 3.6]),
  scales: H('scales', 'Scales', true, 'moneylender', 'Weigh every coin.', 'keepers and savers', '#B8892E', [41, 62, 3.4]),
  wave: H('wave', 'Wave', true, 'wave', 'Ride it.', 'the bold', '#1F3A5F', [38, 32, 2.6]),
  river: H('river', 'River', true, 'qingming', 'Every day, the river.', 'the keepers of daily life', '#A0773A', [55, 30, 2.4]),
};
export const HOUSE_ORDER: HouseId[] = ['athens', 'hunters', 'feast', 'scales', 'wave', 'river'];
export const houseName = (h: House) => `House of ${h.the ? 'the ' : ''}${h.word}`;

/** How strongly each kind of spending calls to each house. */
const PULL: Record<string, Partial<Record<HouseId, number>>> = {
  education: { athens: 1.6 }, business: { athens: 0.9 }, tech: { athens: 0.5, wave: 0.6 }, health: { river: 0.6, athens: 0.2 },
  transport: { hunters: 1.2 }, travel: { hunters: 1.4 }, debt: { hunters: 0.6, scales: 0.4 },
  dining: { feast: 1.2 }, fun: { feast: 1.1 }, giving: { feast: 1.3 },
  savings: { scales: 2 },
  shopping: { wave: 1.1 }, betting: { wave: 1.5 }, selfcare: { wave: 0.9 }, subscriptions: { wave: 0.4, river: 0.5 },
  rent: { river: 1 }, bills: { river: 1 }, groceries: { river: 1 }, other: { river: 0.3 },
};

export interface Calling {
  id: HouseId;
  /** The house that came second: "with a little of the Wave in you". */
  runnerUp: HouseId;
  /** The lines that called them, in their own words. */
  why: string[];
  /** The day they were called. The house holds for a year from it. */
  calledAt: string;
}

type Line = Pick<Entry, 'amount' | 'dir' | 'category' | 'label'>;

/** Calls a house from lines: one first line, or a year's book. Exact, on the device, and the same lines always call the same house. */
export function callHouse(lines: Line[], today = todayISO()): Calling {
  const out = lines.filter((l) => l.dir === 'out');
  const spent = out.reduce((a, l) => a + l.amount, 0);
  const came = lines.filter((l) => l.dir === 'in').reduce((a, l) => a + l.amount, 0);
  const score: Record<HouseId, number> = { athens: 0, hunters: 0, feast: 0, scales: 0, wave: 0, river: 0 };
  const by: Record<HouseId, { label: string; w: number }[]> = { athens: [], hunters: [], feast: [], scales: [], wave: [], river: [] };
  for (const l of out) {
    const share = spent ? l.amount / spent : 0;
    for (const [h, w] of Object.entries(PULL[l.category] ?? PULL.other) as [HouseId, number][]) {
      score[h] += share * w;
      by[h].push({ label: l.label, w: share * w });
    }
  }
  // Keeping most of what comes in is its own calling.
  if (came > 0) {
    const kept = Math.max(0, 1 - spent / came);
    score.scales += kept * 0.9;
    if (kept > 0.3) by.scales.push({ label: 'what you kept', w: kept });
  }
  // Ties (or an empty line) fall the same way every time for the same lines.
  const seed = hash(lines.map((l) => l.label + l.amount).join('|') || today);
  const ranked = [...HOUSE_ORDER].sort((a, b) => score[b] - score[a] || ((seed >> HOUSE_ORDER.indexOf(a)) & 1) - ((seed >> HOUSE_ORDER.indexOf(b)) & 1));
  const id = score[ranked[0]] > 0 ? ranked[0] : HOUSE_ORDER[seed % HOUSE_ORDER.length];
  const runnerUp = ranked.find((h) => h !== id)!;
  const why = [...new Set(by[id].sort((a, b) => b.w - a.w).map((x) => x.label.toLowerCase()))].slice(0, 3);
  return { id, runnerUp, why, calledAt: today };
}

/** A year after the last calling, the gallery calls again. */
export function callingDue(c: Calling | undefined, today = todayISO()) {
  if (!c) return false;
  const next = new Date(c.calledAt + 'T12:00');
  next.setFullYear(next.getFullYear() + 1);
  return today >= todayISO(next);
}

/** The next calling, in words: "the twentieth of November 2027". */
export const nextCalling = (c: Calling) => { const d = new Date(c.calledAt + 'T12:00'); d.setFullYear(d.getFullYear() + 1); return d; };

/** The lines a yearly calling reads: the twelve months before it. */
export function yearOf(entries: Entry[], today = todayISO()) {
  const from = new Date(today + 'T12:00'); from.setFullYear(from.getFullYear() - 1);
  const f = todayISO(from);
  return entries.filter((e) => e.date > f && e.date <= today);
}
