import { cat } from './categories';
import { computeStats, goalEta, projection, type Stats } from './analytics';
import { money, monthOf, todayISO } from './format';
import type { Entry, State } from './types';

/* ——— The collection: public-domain paintings bundled in /art (Wikimedia Commons) ——— */
export interface Painting { id: string; title: string; artist: string; year: string; place: string; focus: string; why: string }
const P = (id: string, title: string, artist: string, year: string, place: string, focus: string, why: string): Painting => ({ id, title, artist, year, place, focus, why });

/** The title in the painter's own script, shown on the label beside the English one. */
export const NATIVE_TITLE: Record<string, string> = {
  qingming: '清明上河圖', mitsui: '江都駿河町三井見世略図', wave: '神奈川沖浪裏', hiroshige: '大はしあたけの夕立',
  ssireum: '씨름', jumak: '주막', danopungjeong: '단오풍정', gayumars: 'دربار کیومرث', babur: 'باغ وفا', ravivarma: 'അതാ അച്ഛൻ വരുന്നു',
};

/** The world's wing: masters from every continent, fetched from Wikimedia Commons (public domain). See scripts/art-library.mjs. */
const WORLD: Record<string, Painting> = {
  teniers: P('teniers', 'Archduke Leopold Wilhelm in His Gallery in Brussels', 'David Teniers the Younger', 'c. 1651', 'Kunsthistorisches Museum, Vienna', '40% 60%', 'A collector among everything he chose to keep.'),
  taxcollectors: P('taxcollectors', 'The Tax Collectors', 'Marinus van Reymerswaele', 'c. 1540', 'National Museum, Warsaw', '50% 45%', 'Two men who have never once forgotten a sum.'),
  moneychanger: P('moneychanger', 'The Money Changer and His Wife', 'Marinus van Reymerswaele', '1539', 'Museo del Prado, Madrid', '50% 55%', 'Every currency, weighed the same.'),
  milkmaid: P('milkmaid', 'The Milkmaid', 'Johannes Vermeer', 'c. 1658', 'Rijksmuseum, Amsterdam', '50% 50%', 'Nothing wasted, not even the stale bread.'),
  balance: P('balance', 'Woman Holding a Balance', 'Johannes Vermeer', 'c. 1664', 'National Gallery of Art, Washington', '50% 45%', 'Weighing it before deciding.'),
  littlestreet: P('littlestreet', 'The Little Street', 'Johannes Vermeer', 'c. 1658', 'Rijksmuseum, Amsterdam', '50% 60%', 'A quiet day on a quiet street.'),
  meatstall: P('meatstall', 'A Meat Stall with the Holy Family Giving Alms', 'Pieter Aertsen', '1551', 'North Carolina Museum of Art, Raleigh', '50% 50%', 'The whole market, priced and hanging.'),
  kitchen: P('kitchen', 'The Well-Stocked Kitchen', 'Joachim Beuckelaer', '1566', 'Rijksmuseum, Amsterdam', '50% 55%', 'Bought in bulk, for once.'),
  proverbs: P('proverbs', 'Netherlandish Proverbs', 'Pieter Bruegel the Elder', '1559', 'Gemäldegalerie, Berlin', '50% 50%', 'Throwing money into the water, among other things.'),
  games: P('games', 'Children’s Games', 'Pieter Bruegel the Elder', '1560', 'Kunsthistorisches Museum, Vienna', '50% 55%', 'Free things to do, about eighty of them.'),
  syndics: P('syndics', 'The Syndics of the Drapers’ Guild', 'Rembrandt van Rijn', '1662', 'Rijksmuseum, Amsterdam', '50% 40%', 'The auditors look up. The books are in order.'),
  luxury: P('luxury', 'Beware of Luxury', 'Jan Steen', '1663', 'Kunsthistorisches Museum, Vienna', '50% 55%', 'A household having a very good time.'),
  peeters: P('peeters', 'Still Life with Cheeses, Artichoke, and Cherries', 'Clara Peeters', 'c. 1625', 'Los Angeles County Museum of Art', '50% 55%', 'Lunch, painted as if it mattered. It did.'),
  heda: P('heda', 'Still Life with a Gilt Cup', 'Willem Claesz Heda', '1635', 'Rijksmuseum, Amsterdam', '50% 50%', 'What is left after a good meal.'),
  eggs: P('eggs', 'Old Woman Frying Eggs', 'Diego Velázquez', '1618', 'Scottish National Gallery, Edinburgh', '50% 55%', 'Cooked at home, again.'),
  meninas: P('meninas', 'Las Meninas', 'Diego Velázquez', '1656', 'Museo del Prado, Madrid', '45% 55%', 'Everyone looking at who is paying.'),
  grapes: P('grapes', 'Boys Eating Grapes and Melon', 'Bartolomé Esteban Murillo', 'c. 1646', 'Alte Pinakothek, Munich', '50% 45%', 'Small pleasures, shared.'),
  market: P('market', 'The Return from Market', 'Jean Siméon Chardin', '1739', 'Musée du Louvre, Paris', '50% 40%', 'Home with the shopping, a little tired.'),
  cheat: P('cheat', 'The Cheat with the Ace of Diamonds', 'Georges de La Tour', 'c. 1635', 'Musée du Louvre, Paris', '50% 45%', 'Someone at this table is not paying attention.'),
  ambassadors: P('ambassadors', 'The Ambassadors', 'Hans Holbein the Younger', '1533', 'The National Gallery, London', '50% 45%', 'Two men and everything they own.'),
  beaneater: P('beaneater', 'The Beaneater', 'Annibale Carracci', 'c. 1584', 'Galleria Colonna, Rome', '50% 45%', 'The cheapest lunch in Rome, and he knows it.'),
  butcher: P('butcher', 'The Butcher’s Shop', 'Annibale Carracci', 'c. 1583', 'Christ Church Picture Gallery, Oxford', '50% 50%', 'Weighed, wrapped and paid for.'),
  qingming: P('qingming', 'Along the River During the Qingming Festival (detail)', 'Zhang Zeduan', '12th century', 'Palace Museum, Beijing', '50% 50%', 'A whole city buying and selling.'),
  mitsui: P('mitsui', 'Mitsui Shop at Suruga-chō in Edo', 'Katsushika Hokusai', 'c. 1830', 'Thirty-six Views of Mount Fuji', '50% 55%', 'A shop roof, a mountain, and the price of cloth.'),
  wave: P('wave', 'The Great Wave off Kanagawa', 'Katsushika Hokusai', 'c. 1831', 'Thirty-six Views of Mount Fuji', '60% 50%', 'A big month, ridden out.'),
  hiroshige: P('hiroshige', 'Sudden Shower over Shin-Ōhashi Bridge', 'Utagawa Hiroshige', '1857', 'One Hundred Famous Views of Edo', '50% 60%', 'Caught out, and still getting home.'),
  ssireum: P('ssireum', 'Ssireum (Wrestling)', 'Kim Hong-do', 'late 18th century', 'National Museum of Korea, Seoul', '50% 50%', 'The whole village watching, the taffy seller too.'),
  jumak: P('jumak', 'Jumak (The Tavern)', 'Kim Hong-do', 'late 18th century', 'National Museum of Korea, Seoul', '50% 50%', 'Paying for the soup before the road.'),
  danopungjeong: P('danopungjeong', 'Dano Festival', 'Shin Yun-bok', 'c. 1805', 'Kansong Art Museum, Seoul', '50% 45%', 'A day off, well spent.'),
  babur: P('babur', 'Babur Laying Out the Garden of Fidelity', 'Bishndas and Nanha', 'c. 1590', 'Victoria and Albert Museum, London', '50% 50%', 'Planned before planted.'),
  ravivarma: P('ravivarma', 'There Comes Papa', 'Raja Ravi Varma', '1893', 'India', '50% 40%', 'Pay day, seen from the doorway.'),
  gayumars: P('gayumars', 'The Court of Gayumars', 'Sultan Muhammad', 'c. 1525', 'Aga Khan Museum, Toronto', '50% 45%', 'The first king, and everyone he looks after.'),
  tortoise: P('tortoise', 'The Tortoise Trainer', 'Osman Hamdi Bey', '1906', 'Pera Museum, Istanbul', '50% 40%', 'Patient with slow progress.'),
  nebamunpool: P('nebamunpool', 'A Pool in the Garden of Nebamun', 'Unknown painter of Thebes', 'c. 1350 BCE', 'The British Museum, London', '50% 50%', 'The oldest garden in the collection, still tended.'),
  fierro: P('fierro', 'The Seller of Manjar Blanco', 'Pancho Fierro', '1850', 'Lima', '50% 40%', 'Sold by the spoonful, counted by the day.'),
  election: P('election', 'The County Election', 'George Caleb Bingham', '1852', 'Saint Louis Art Museum', '50% 50%', 'Everyone has an opinion about the budget.'),
  furtraders: P('furtraders', 'Fur Traders Descending the Missouri', 'George Caleb Bingham', 'c. 1845', 'The Metropolitan Museum of Art, New York', '50% 50%', 'The goods on board, the river doing the work.'),
  peasantdance: P('peasantdance', 'The Peasant Dance', 'Pieter Bruegel the Elder', 'c. 1567', 'Kunsthistorisches Museum, Vienna', '50% 55%', 'The month went well. Everyone dances.'),
  gleaners: P('gleaners', 'The Gleaners', 'Jean-François Millet', '1857', 'Musée d’Orsay, Paris', '50% 60%', 'Nothing left in the field.'),
  courtyard: P('courtyard', 'The Courtyard of a House in Delft', 'Pieter de Hooch', '1658', 'The National Gallery, London', '50% 55%', 'Home, swept and paid for.'),
  fishmarket: P('fishmarket', 'Fish Market', 'Joachim Beuckelaer', '1568', 'The Metropolitan Museum of Art, New York', '50% 55%', 'Fresh this morning, cheaper by evening.'),
};

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
  ...WORLD,
};
/** Paintings come in three sizes: 'sm' 320px (thumbnails), 'md' 960px, 'lg' 1800px. */
export const artSrc = (id: string, size: 'sm' | 'md' | 'lg' = 'lg') => (size === 'lg' ? `./art/${id}.jpg` : `./art/${size}/${id}.jpg`);
/** For <img srcSet>: the browser picks the smallest file that is sharp at the size shown. */
export const artSet = (id: string) => `./art/md/${id}.jpg 960w, ./art/${id}.jpg 1800w`;

/** The order paintings are hung in, one per month, with no painting twice until the whole library has hung.
 *  November 2026 is the first entry; each month after takes the next, each month before the one before it.
 *  Add new paintings to the END only: anything earlier would re-hang months people have already restored. */
export const HANGING: string[] = [
  'moneylender', 'hunters', 'qingming', 'census', 'arnolfini', 'mitsui', 'babel', 'athens', 'wave', 'wedding', 'icarus', 'hiroshige', 'goldsmith', 'harvesters', 'ssireum', 'gisze', 'matthew', 'jumak', 'magi', 'carnival', 'danopungjeong', 'cardsharps', 'hare', 'babur', 'teniers', 'taxcollectors', 'ravivarma', 'moneychanger', 'gayumars', 'milkmaid', 'balance', 'tortoise', 'littlestreet', 'meatstall', 'nebamunpool', 'kitchen', 'proverbs', 'fierro', 'games', 'syndics', 'election', 'luxury', 'peeters', 'furtraders', 'heda', 'eggs', 'peasantdance', 'meninas', 'grapes', 'gleaners', 'market', 'cheat', 'courtyard', 'ambassadors', 'beaneater', 'fishmarket', 'butcher',
];
const FIRST_HUNG = 2026 * 12 + 10; // November 2026

/** The painting a month is restored into: fixed by the calendar alone, so it never changes as you write,
 *  two months side by side never share one, and every painting hangs once before any comes round again. */
export function paintingOf(s: Stats | { month: string }): Painting {
  const n = Number(s.month.slice(0, 4)) * 12 + Number(s.month.slice(5, 7)) - 1 - FIRST_HUNG;
  const L = HANGING.length;
  return PAINTINGS[HANGING[((n % L) + L) % L]];
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

/** quiet: days marked "nothing today"; each cleans one patch, the same as a first line. */
export function restorationOf(entries: Entry[], month: string, quiet: string[] = []): Restoration {
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
  for (const day of quiet) if (monthOf(day) === month && !byDay.has(day)) { restored += 1; if (day === now) today = 1; }
  restored = Math.min(PATCHES, restored);
  // Edges lift first, the heart of the painting last.
  const r = rng(hash(month));
  const order = Array.from({ length: PATCHES }, (_, i) => i)
    .map((i) => { const x = (i % COLS) - (COLS - 1) / 2, y = Math.floor(i / COLS) - (ROWS - 1) / 2; return { i, k: -Math.hypot(x / COLS, y / ROWS) + r() * 0.35 }; })
    .sort((a, b) => a.k - b.k).map((o) => o.i);
  return { restored, order, gilded, complete: restored >= PATCHES, today, todayCap: 3, remaining: PATCHES - restored };
}

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
  if (!pool.length) return null;
  const r = rng(hash(date + state.profile.name));
  const pick = pool[Math.floor(r() * pool.length)];
  const ids = Object.keys(PAINTINGS);
  const painting = PAINTINGS[ids[Math.floor(r() * ids.length)]];
  const focus = `${Math.round(20 + r() * 60)}% ${Math.round(20 + r() * 60)}%`;
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  return { ...pick, painting, focus, numeral: numerals[Math.floor(r() * numerals.length)] };
}
