// A sample world so new visitors see the magic instantly.
import { CURRENCIES, todayISO, uid } from './format';
import type { Entry, Feeling } from './types';

type T = { label: string; text: string; cat: string; usd: number; dir?: 'in' | 'out'; feeling?: Feeling };

// One month anyone could have, anywhere: no brands, no one city. Amounts are in US dollars of buying power.
const WORLD: T[] = [
  { label: 'Street food with friends', text: 'street food with friends 4', cat: 'dining', usd: 4 },
  { label: 'Rice and stew', text: 'rice and stew 4', cat: 'dining', usd: 4, feeling: 'joy' },
  { label: 'Late-night delivery', text: 'food delivery at 1am, regret', cat: 'dining', usd: 7, feeling: 'regret' },
  { label: 'Coffee', text: 'coffee', cat: 'dining', usd: 2.5 },
  { label: 'Ride across town', text: 'ride across town', cat: 'transport', usd: 6 },
  { label: 'Bus to work', text: 'bus to work', cat: 'transport', usd: 1 },
  { label: 'Phone data', text: 'phone data', cat: 'bills', usd: 4 },
  { label: 'Prepaid electricity', text: 'prepaid electricity', cat: 'bills', usd: 12 },
  { label: 'Market run', text: 'groceries at the market', cat: 'groceries', usd: 28 },
  { label: 'New sneakers', text: 'bought sneakers, worth it', cat: 'shopping', usd: 40, feeling: 'joy' },
  { label: 'Impulse buy online', text: 'impulse buy online, regret', cat: 'shopping', usd: 20, feeling: 'regret' },
  { label: 'Football bet', text: 'football bet lost', cat: 'betting', usd: 4, feeling: 'regret' },
  { label: 'Sent mum money', text: 'sent mum money', cat: 'giving', usd: 15, feeling: 'joy' },
  { label: 'Barber', text: 'barber', cat: 'selfcare', usd: 4 },
  { label: 'Concert tickets', text: 'concert tickets', cat: 'fun', usd: 30, feeling: 'joy' },
];
const SUBS: T[] = [
  { label: 'Film streaming', text: 'film streaming', cat: 'subscriptions', usd: 9 },
  { label: 'Music streaming', text: 'music streaming', cat: 'subscriptions', usd: 6 },
  { label: 'Cloud storage', text: 'cloud storage', cat: 'subscriptions', usd: 3 },
];
/** Where money buys more, the same month costs fewer dollars. */
const LOWER = /^(NGN|KES|GHS|XOF|TZS|INR|EGP|ZAR|BRL|MXN)$/;

function round(n: number, code: string) {
  if (n >= 1000) return Math.round(n / 50) * 50;
  // Money counted in hundreds or thousands has no cents worth writing down.
  if (n >= 100 || (CURRENCIES.find((c) => c.code === code)?.scale ?? 1) >= 10) return Math.round(n);
  return /^(JPY|KRW|XOF|TZS)$/.test(code) ? Math.round(n) : Math.round(n * 100) / 100;
}

export function demoEntries(currency: string): Entry[] {
  const scale = CURRENCIES.find((c) => c.code === currency)?.scale ?? 1;
  const pool = WORLD;
  const ppp = LOWER.test(currency) ? 0.45 : 1;
  const out: Entry[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const add = (d: Date, t: T, mult = 1, dir: 'in' | 'out' = t.dir ?? 'out') => {
    const amount = round(t.usd * scale * ppp * mult * (0.85 + rnd() * 0.35), currency);
    out.push({ id: uid(), text: t.text, label: t.label, amount, dir, category: t.cat, feeling: t.feeling, date: todayISO(d), createdAt: d.getTime(), source: 'oracle', confidence: 0.9, sample: true });
  };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const dom = day.getDate();
    const prevMonth = day.getMonth() !== now.getMonth();
    if (dom === 1) {
      add(day, { label: 'Salary', text: 'salary came in', cat: 'salary', usd: 1600 }, prevMonth ? 1 : 1.05, 'in');
      add(day, { label: 'Rent share', text: 'rent', cat: 'rent', usd: 420 });
      add(day, { label: 'Moved to savings', text: 'moved to savings', cat: 'savings', usd: prevMonth ? 90 : 160 });
    }
    if (dom === 3) SUBS.forEach((s) => add(day, s));
    if (dom === 12 || dom === 24) add(day, { label: 'Freelance design gig', text: 'client paid for logo design', cat: 'craft', usd: dom === 12 ? 260 : 180 }, 1, 'in');
    if (dom === 18 && !prevMonth) add(day, { label: 'Birthday money', text: 'aunty sent me birthday money', cat: 'blessing', usd: 40 }, 1, 'in');
    if (dom === 15) add(day, { label: 'Electricity', text: 'electricity', cat: 'bills', usd: 30 });
    const n = rnd() < 0.15 ? 0 : 1 + Math.floor(rnd() * (prevMonth ? 4.2 : 3.6));
    for (let i = 0; i < n; i++) {
      const t = pool[Math.floor(rnd() * pool.length)];
      add(day, t, prevMonth && t.cat === 'dining' ? 1.25 : 1);
    }
  }
  return out;
}
