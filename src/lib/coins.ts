// "Your month in 100 coins": every amount becomes a share of 100 coins, and every category total
// is also told in something the person actually buys (their own usual purchase when we know it).
import { CURRENCIES } from './format';
import { cat } from './categories';
import type { Stats } from './analytics';
import type { Entry } from './types';

export interface CoinGroup { id: string; coins: number; total: number }
export interface CoinMonth {
  base: 'in' | 'out';      // 100 coins = what came in, or what went out when nothing came in
  groups: CoinGroup[];     // categories, biggest first
  left: number;            // coins still with you
  over: number;            // coins spent beyond what came in
}

/** Largest-remainder rounding, so the coins always add up exactly. */
export function coinMonth(s: Stats): CoinMonth | null {
  const out = s.byCat.reduce((a, c) => a + c.total, 0);
  if (!out && !s.inflow) return null;
  const base = s.inflow > 0 ? 'in' : 'out';
  const denom = Math.max(s.inflow, out) || 1;
  const spentCoins = Math.min(100, Math.round((out / denom) * 100));
  const raw = s.byCat.map((c) => ({ id: c.id, total: c.total, exact: (c.total / (out || 1)) * spentCoins }));
  const groups = raw.map((r) => ({ id: r.id, total: r.total, coins: Math.floor(r.exact) }));
  let rest = spentCoins - groups.reduce((a, g) => a + g.coins, 0);
  raw.map((r, i) => ({ i, f: r.exact - Math.floor(r.exact) })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (rest > 0) { groups[i].coins++; rest--; } });
  const over = s.inflow > 0 && out > s.inflow ? Math.round(((out - s.inflow) / out) * 100) : 0;
  return { base, groups: groups.filter((g) => g.coins > 0), left: 100 - spentCoins, over };
}

export interface Unit { name: string; price: number; measured: boolean }

/** The person's own usual small purchase (bought at least 3 times), else a local everyday guess. */
export function everydayUnit(entries: Entry[], currency: string, monthSpend: number): Unit {
  const recent = entries.filter((e) => e.dir === 'out' && cat(e.category).nature !== 'save' && Date.now() - e.createdAt < 120 * 864e5);
  const by = new Map<string, { label: string; n: number; sum: number }>();
  for (const e of recent) {
    const k = e.label.trim().toLowerCase();
    if (!k || k.length > 22) continue;
    const g = by.get(k) ?? { label: e.label.trim(), n: 0, sum: 0 };
    g.n++; g.sum += e.amount; by.set(k, g);
  }
  const fits = [...by.values()].filter((g) => g.n >= 3 && g.sum / g.n < Math.max(1, monthSpend) * 0.08).sort((a, b) => b.n - a.n);
  if (fits[0]) return { name: fits[0].label, price: fits[0].sum / fits[0].n, measured: true };
  if (currency === 'NGN') return { name: 'plates of jollof', price: 2500, measured: false };
  const scale = CURRENCIES.find((c) => c.code === currency)?.scale ?? 1;
  return { name: 'coffees', price: Math.round(4.5 * scale * 100) / 100, measured: false };
}

export const unitsOf = (amount: number, u: Unit) => Math.max(1, Math.round(amount / u.price));
