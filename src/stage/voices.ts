// The sitters' lines. Dry, warm, never a scold: they laugh with you. These are the device's own lines,
// used offline and while the on-device model warms up; when a model is available it writes fresh ones in
// the same voice (see brain.ts).
import { cat } from '../lib/categories';
import type { Entry } from '../lib/types';

export interface Sitter { name: string; role: string }
export const CASTS: Record<string, Sitter[]> = {
  moneylender: [{ name: 'The Moneylender', role: 'weighing coins' }, { name: 'His wife', role: 'not really reading' }],
  taxcollectors: [{ name: 'The older collector', role: 'counting' }, { name: 'The younger one', role: 'grinning' }],
  moneychanger: [{ name: 'The Money Changer', role: 'at his scales' }, { name: 'His wife', role: 'keeping the book' }],
  matthew: [{ name: 'Matthew', role: 'at the counting table' }],
  balance: [{ name: 'The woman at the window', role: 'holding the balance' }],
  milkmaid: [{ name: 'The milkmaid', role: 'pouring slowly' }],
  hunters: [{ name: 'The hunters', role: 'home with very little' }],
  arnolfini: [{ name: 'Giovanni Arnolfini', role: 'raising a hand' }],
  syndics: [{ name: 'The syndics', role: 'checking the accounts' }],
  teniers: [{ name: 'The Archduke', role: 'showing off his collection' }],
  qingming: [{ name: 'The tea-house keeper', role: 'by the Rainbow Bridge' }, { name: 'The boatman', role: 'shouting over the river' }],
  gayumars: [{ name: 'King Gayumars', role: 'on his mountain throne' }],
  mitsui: [{ name: 'The shop clerk', role: 'up on the roof' }],
};
export const castOf = (id: string): Sitter => (CASTS[id] ?? [{ name: 'The gallery guard', role: 'keeping an eye on things' }])[0];
const second = (id: string): Sitter => (CASTS[id]?.[1] ?? castOf(id));

type Line = { who: Sitter; text: string };
const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];

/** A line for what was just written. `seed` keeps the choice steady for the same lines. */
export function sitterLine(painting: string, kept: Entry[], all: Entry[], seed: number): Line {
  const a = castOf(painting), b = second(painting);
  const ins = kept.filter((e) => e.dir === 'in'), outs = kept.filter((e) => e.dir === 'out');
  const today = all.filter((e) => e.date === kept[0]?.date && e.dir === 'out');
  const has = (...ids: string[]) => outs.some((e) => ids.includes(e.category));
  const h = new Date().getHours();
  if (all.length === kept.length) return { who: b, text: pick(['Our first page together. Write it like you mean it.', 'A new book. I always like the first page best.', 'There. Now the painting knows you.'], seed) };
  if (ins.length && outs.length) return { who: b, text: pick(['Paid, and still you counted the lunch. Restraint. I’m not used to it.', 'Money in and money out on the same line. You’d make a fine banker.', 'In with one hand, out with the other. That is the whole trade, really.'], seed) };
  if (ins.length) return { who: a, text: pick(['Now that is a sound I know. Let me weigh it.', 'Pay day. The gold in the frame is for you.', 'Good coin. I’ll pretend not to be impressed.'], seed) };
  if (h >= 22 || h < 4) return { who: b, text: pick(['Writing by candlelight. So was everyone worth reading.', 'Late, but written. That’s what counts.', 'The candle’s low. Your book isn’t.'], seed) };
  if (has('transport') && today.filter((e) => e.category === 'transport').length >= 2) return { who: b, text: pick(['Two rides today. Your feet send their thanks.', 'Somewhere a driver is very fond of you.'], seed) };
  if (has('dining') && today.filter((e) => e.category === 'dining').length >= 3) return { who: b, text: pick(['Third meal out today. I’ll have what you’re having.', 'Still Life with Several Lunches. I’d hang it.'], seed) };
  if (has('rent', 'bills')) return { who: a, text: pick(['The dull ones are paid. Those are the brave lines.', 'Rent. Nobody paints it, everybody pays it.', 'Bills settled. The roof thanks you quietly.'], seed) };
  if (has('giving')) return { who: b, text: pick(['Given away. The best money in the book.', 'Somebody’s day just got lighter.'], seed) };
  if (has('groceries')) return { who: b, text: pick(['Food for the house. That’s the kind I like to see.', 'A full basket. The milkmaid next door approves.'], seed) };
  if (has('savings')) return { who: a, text: pick(['Put aside. I’ll keep it warm.', 'Saved. You’re starting to sound like me.'], seed) };
  if (has('betting')) return { who: b, text: pick(['A wager. The Cardsharps down the hall send their regards.', 'Fortune is a fickle sitter. Written down, at least.'], seed) };
  if (has('dining')) return { who: b, text: pick(['Lunch. Painted properly, as all lunches should be.', 'A good meal is never wasted money. Mostly.'], seed) };
  if (has('shopping', 'tech')) return { who: b, text: pick(['Something new. I’d like to see it in the light.', 'Bought. The question is whether you’ll still love it on Tuesday.'], seed) };
  return { who: a, text: pick(['Written. That’s the hardest part done.', 'Another line in the book. The painting moves.', 'Noted, weighed, and kept.'], seed) };
}

/** The museum label for today, built from today's lines. */
export function labelOf(kept: Entry[], weekday: string): string {
  const outs = kept.filter((e) => e.dir === 'out');
  const ins = kept.some((e) => e.dir === 'in');
  const top = outs.sort((x, y) => y.amount - x.amount)[0];
  const noun = top ? cat(top.category).short : 'Coin';
  if (ins && outs.length) return `Still Life with Pay Day and ${noun}. Oil on ledger. Workshop of You, ${weekday}.`;
  if (ins) return `Allegory of Pay Day. Gold leaf on linen. Workshop of You, ${weekday}.`;
  if (outs.length >= 3) return `Still Life with ${outs.length} Purchases. Oil on budget. On loan from ${weekday}.`;
  return `Study of ${noun}. Red chalk and oil. Workshop of You, ${weekday}.`;
}
