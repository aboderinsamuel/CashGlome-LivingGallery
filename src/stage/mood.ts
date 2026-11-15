// The weather of the week: four numbers the painting's light eases towards. Plain arithmetic on the
// person's own lines, on the device. No model decides how someone's week felt.
import { cat } from '../lib/categories';
import { daysInMonth, monthOf, todayISO } from '../lib/format';
import type { Entry } from '../lib/types';

export interface Mood { calm: number; rush: number; weight: number; plenty: number }
export const NEUTRAL: Mood = { calm: 0.6, rush: 0, weight: 0, plenty: 0 };

const OBLIGATIONS = new Set(['rent', 'bills', 'debt', 'health', 'education']);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 864e5);

/** The last seven days, recent days counting more. */
export function moodOf(entries: Entry[], today = todayISO()): Mood {
  const week = entries.filter((e) => { const d = daysBetween(e.date, today); return d >= 0 && d < 7; });
  if (!week.length) return NEUTRAL;
  const w = (e: Entry) => 1 - daysBetween(e.date, today) / 9;
  let out = 0, inn = 0, owed = 0, want = 0, late = 0, wants = 0;
  const perDay = new Map<string, number>();
  for (const e of week) {
    const k = w(e) * e.amount;
    if (e.dir === 'in') { inn += k; continue; }
    out += k;
    if (OBLIGATIONS.has(e.category)) owed += k;
    if (cat(e.category).nature === 'want') {
      want += k; wants++;
      perDay.set(e.date, (perDay.get(e.date) ?? 0) + 1);
      const h = new Date(e.createdAt).getHours();
      if (h >= 22 || h < 4) late++;
    }
  }
  const burst = Math.max(0, ...perDay.values());
  // Pay day blooms for about three days, then settles.
  const lastIn = week.filter((e) => e.dir === 'in').map((e) => daysBetween(e.date, today)).sort((a, b) => a - b)[0];
  const glow = lastIn === undefined ? 0 : clamp(1 - lastIn / 3);
  const plenty = clamp(0.55 * (inn / (inn + out + 1e-9)) + 0.55 * glow);
  const weight = clamp((owed / (out + 1e-9)) * 1.3);
  const rush = clamp(0.5 * (want / (out + 1e-9)) + 0.18 * Math.max(0, burst - 2) + 0.22 * late + (wants > 8 ? 0.15 : 0));
  const calm = clamp(1 - Math.max(rush, weight * 0.8) + 0.15);
  return { calm, rush, weight, plenty };
}

/**
 * Where the month's painting is in the studio. The calendar moves it, so it is never blank and missing a
 * day costs nothing. 0 to 1: red-chalk underdrawing (sinopia), 1 to 2: tonal underpainting (grisaille),
 * 2 to 3: colour glazes, 3: varnished and finished.
 */
export function stageOf(month: string, today = todayISO()): number {
  if (month < monthOf(today)) return 3;
  const n = daysInMonth(month), d = Number(today.slice(8, 10));
  const t = d / n; // the fraction of the month gone
  if (t <= 5 / 30) return (t / (5 / 30)) * 0.9;
  if (t <= 14 / 30) return 1 + ((t - 5 / 30) / (9 / 30)) * 0.9;
  if (t <= 23 / 30) return 2 + ((t - 14 / 30) / (9 / 30)) * 0.9;
  return 3;
}

export const STAGE_NAMES = [
  { name: 'Underdrawing', note: 'Red chalk on linen. Every painting starts as a sketch.' },
  { name: 'Underpainting', note: 'Umber and lead white. The light is set before the colour.' },
  { name: 'Glazing', note: 'Colour goes on in thin layers, one over another.' },
  { name: 'Varnished', note: 'Finished, and hung in your gallery for good.' },
];
export const stageName = (s: number) => STAGE_NAMES[Math.min(3, Math.floor(s + 0.02))];

/** How dark it is where the person is, 0 at midday and 1 deep in the night. The painting's light follows. */
export function nightOf(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h <= 17) return 0;
  if (h > 17 && h < 21) return (h - 17) / 4;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  return 1;
}
