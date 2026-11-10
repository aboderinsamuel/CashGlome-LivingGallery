// A sample world so new visitors see the magic instantly.
import { CURRENCIES, todayISO, uid } from './format';
import type { Entry, Feeling } from './types';

type T = { label: string; text: string; cat: string; usd: number; dir?: 'in' | 'out'; feeling?: Feeling };

const NG: T[] = [
  { label: 'Suya with the guys', text: 'spent 4.5k on suya with the guys', cat: 'dining', usd: 3 },
  { label: 'Jollof & chicken', text: 'jollof and chicken 6k', cat: 'dining', usd: 4, feeling: 'joy' },
  { label: 'Chowdeck late night', text: 'chowdeck order 8,200 at 1am — regret', cat: 'dining', usd: 5.5, feeling: 'regret' },
  { label: 'Bolt to Lekki', text: 'bolt to lekki 7k', cat: 'transport', usd: 4.7 },
  { label: 'Keke to work', text: 'keke 800', cat: 'transport', usd: 0.55 },
  { label: 'MTN data', text: 'mtn data 5k', cat: 'bills', usd: 3.3 },
  { label: 'Prepaid light', text: 'nepa prepaid 15k', cat: 'bills', usd: 10 },
  { label: 'Shoprite run', text: 'shoprite groceries 32k', cat: 'groceries', usd: 21 },
  { label: 'Sneakers', text: 'bought sneakers 45k, worth it', cat: 'shopping', usd: 30, feeling: 'joy' },
  { label: 'Sportybet', text: 'sportybet 5k lost', cat: 'betting', usd: 3.3, feeling: 'regret' },
  { label: 'Sent mum money', text: 'sent mum 20k', cat: 'giving', usd: 13.3, feeling: 'joy' },
  { label: 'Barber', text: 'barber 3k', cat: 'selfcare', usd: 2 },
];
const GLOBAL: T[] = [
  { label: 'Oat latte', text: 'oat latte 6.50', cat: 'dining', usd: 6.5 },
  { label: 'Sushi with friends', text: 'sushi with friends 42 — loved it', cat: 'dining', usd: 42, feeling: 'joy' },
  { label: 'DoorDash at midnight', text: 'doordash 31 at midnight ugh', cat: 'dining', usd: 31, feeling: 'regret' },
  { label: 'Uber downtown', text: 'uber downtown 18', cat: 'transport', usd: 18 },
  { label: 'Metro card', text: 'metro 2.90', cat: 'transport', usd: 2.9 },
  { label: 'Phone bill', text: 'phone bill 45', cat: 'bills', usd: 45 },
  { label: 'Trader Joe\'s run', text: 'groceries at trader joes 86', cat: 'groceries', usd: 86 },
  { label: 'New sneakers', text: 'bought sneakers 120, worth it', cat: 'shopping', usd: 120, feeling: 'joy' },
  { label: 'Amazon impulse buy', text: 'amazon impulse 39 — regret', cat: 'shopping', usd: 39, feeling: 'regret' },
  { label: 'Gift for mom', text: 'gift for mom 60', cat: 'giving', usd: 60, feeling: 'joy' },
  { label: 'Gym day pass', text: 'gym 25', cat: 'selfcare', usd: 25 },
  { label: 'Concert tickets', text: 'concert tickets 95', cat: 'fun', usd: 95, feeling: 'joy' },
];
const SUBS: T[] = [
  { label: 'Netflix', text: 'netflix', cat: 'subscriptions', usd: 15.5 },
  { label: 'Spotify', text: 'spotify', cat: 'subscriptions', usd: 11 },
  { label: 'ChatGPT Plus', text: 'chatgpt plus', cat: 'subscriptions', usd: 20 },
];

function round(n: number, code: string) {
  if (n >= 1000) return Math.round(n / 50) * 50;
  if (n >= 100) return Math.round(n);
  return code === 'JPY' ? Math.round(n) : Math.round(n * 100) / 100;
}

export function demoEntries(currency: string): Entry[] {
  const scale = CURRENCIES.find((c) => c.code === currency)?.scale ?? 1;
  const pool = currency === 'NGN' ? NG : GLOBAL;
  const out: Entry[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const add = (d: Date, t: T, mult = 1, dir: 'in' | 'out' = t.dir ?? 'out') => {
    const amount = round(t.usd * scale * mult * (0.85 + rnd() * 0.35), currency);
    out.push({ id: uid(), text: t.text, label: t.label, amount, dir, category: t.cat, feeling: t.feeling, date: todayISO(d), createdAt: d.getTime(), source: 'oracle', confidence: 0.9 });
  };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const dom = day.getDate();
    const prevMonth = day.getMonth() !== now.getMonth();
    if (dom === 1) {
      add(day, { label: 'Salary', text: 'salary came in', cat: 'salary', usd: currency === 'NGN' ? 700 : 3200 }, prevMonth ? 1 : 1.05, 'in');
      add(day, { label: 'Rent share', text: 'rent', cat: 'rent', usd: currency === 'NGN' ? 140 : 1100 });
      add(day, { label: 'Moved to savings', text: 'saved to piggyvest', cat: 'savings', usd: prevMonth ? 90 : 160 });
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
