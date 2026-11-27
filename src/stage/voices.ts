// The sitters. Every painting in the library has two of them, and they talk: one remarks on what you
// wrote, the other answers, the way people standing in the same room do. Dry, warm, never a scold: they
// laugh with you. These are the device's own exchanges, used offline and while Gemini is still writing;
// when a model is available it writes fresh ones in the same voices (see sitterSays in brain.ts).
// The replies never lean on he or she, so any pair of sitters can say any line.
import type { Entry } from '../lib/types';

export interface Sitter { name: string; role: string }
type Cast = [Sitter, Sitter];
const c = (a: string, ar: string, b: string, br: string): Cast => [{ name: a, role: ar }, { name: b, role: br }];

export const CASTS: Record<string, Cast> = {
  moneylender: c('The Moneylender', 'weighing coins', 'His wife', 'not really reading'),
  taxcollectors: c('The older collector', 'counting', 'The younger one', 'grinning'),
  moneychanger: c('The Money Changer', 'at his scales', 'His wife', 'keeping the book'),
  matthew: c('Matthew', 'at the counting table', 'The boy beside him', 'still counting'),
  balance: c('The woman at the window', 'holding the balance', 'The painting behind her', 'weighing heavier things'),
  milkmaid: c('The milkmaid', 'pouring slowly', 'The bread basket', 'waiting its turn'),
  hunters: c('The hunters', 'home with very little', 'The skaters', 'down on the pond'),
  arnolfini: c('Giovanni Arnolfini', 'raising a hand', 'The little dog', 'unimpressed'),
  syndics: c('The syndics', 'checking the accounts', 'The servant at the back', 'hat off, listening'),
  teniers: c('The Archduke', 'showing off his collection', 'Teniers', 'keeping the inventory'),
  qingming: c('The tea-house keeper', 'by the Rainbow Bridge', 'The boatman', 'shouting over the river'),
  gayumars: c('King Gayumars', 'on his mountain throne', 'The courtiers', 'in leopard skins'),
  mitsui: c('The shop clerk', 'up on the roof', 'Mount Fuji', 'far off, unbothered'),
  littlestreet: c('The woman in the doorway', 'sewing', 'The maid in the alley', 'at the water barrel'),
  meatstall: c('The stall-keeper', 'weighing the meat', 'The pretzels', 'hanging about'),
  kitchen: c('The cook', 'up to her elbows in plenty', 'The kitchen boy', 'eyeing the pies'),
  proverbs: c('The man banging his head on a wall', 'trying again', 'The woman tying the devil to a pillow', 'firmly'),
  games: c('The hoop-rollers', 'already running', 'The children on stilts', 'looking down on everyone'),
  luxury: c('The woman of the house', 'fast asleep', 'The monkey', 'stopping the clock'),
  peeters: c('The cheeses', 'stacked high', 'The cherries', 'a little showy'),
  heda: c('The gilt cup', 'knocked over, gracefully', 'The lemon', 'half peeled'),
  eggs: c('The old woman', 'frying eggs', 'The boy with the melon', 'carrying the flask'),
  meninas: c('The Infanta', 'in the middle of it all', 'Velázquez', 'at his easel'),
  grapes: c('The boy with the grapes', 'mid-bunch', 'The boy with the melon', 'not sharing'),
  market: c('The maid', 'home from market', 'The loaves', 'still warm'),
  cheat: c('The cheat', 'with an ace behind the back', 'The young man', 'about to find out'),
  ambassadors: c('Jean de Dinteville', 'in fur', 'Georges de Selve', 'the bishop, listening'),
  beaneater: c('The beaneater', 'mid-spoonful', 'The onion', 'waiting'),
  butcher: c('The butcher', 'at the scales', 'The guard', 'finding his purse'),
  wave: c('The boatmen', 'holding on', 'Mount Fuji', 'very small, very calm'),
  hiroshige: c('The people on the bridge', 'running from the rain', 'The raftsman', 'poling through it'),
  ssireum: c('The wrestler on top', 'nearly there', 'The yeot seller', 'selling to the crowd'),
  jumak: c('The tavern keeper', 'ladling soup', 'The traveller', 'paying up'),
  danopungjeong: c('The woman on the swing', 'mid-air', 'The two young monks', 'peeking from the rocks'),
  babur: c('Emperor Babur', 'laying out the garden', 'The head gardener', 'measuring twice'),
  ravivarma: c('The mother', 'pointing to the gate', 'The child', 'waiting for Papa'),
  tortoise: c('The tortoise trainer', 'patient as ever', 'The tortoises', 'in no hurry'),
  nebamunpool: c('The fish', 'in Nebamun’s pool', 'The date palm', 'shading everyone'),
  fierro: c('The manjar blanco seller', 'with her tray', 'The sweet', 'very popular'),
  election: c('The voter', 'taking the oath', 'The man with the cards', 'canvassing'),
  furtraders: c('The trader', 'paddling downriver', 'The animal at the bow', 'nobody is sure what it is'),
  peasantdance: c('The dancers', 'already late', 'The bagpiper', 'puffing away'),
  gleaners: c('The gleaners', 'bent to the stubble', 'The overseer', 'far off on horseback'),
  courtyard: c('The maid', 'with the child', 'The woman in the passage', 'looking out'),
  fishmarket: c('The fishwife', 'behind the catch', 'The young buyer', 'counting coins'),
  wedding: c('The bride', 'under her paper crown', 'The pie carriers', 'using a door as a tray'),
  icarus: c('The ploughman', 'not looking up', 'Icarus', 'mostly legs now'),
  cardsharps: c('The cardsharp', 'checking the signals', 'The young player', 'trusting'),
  athens: c('Plato', 'pointing up', 'Aristotle', 'pointing level'),
  harvesters: c('The man under the pear tree', 'asleep', 'The reapers', 'at lunch'),
  gisze: c('Georg Gisze', 'opening a letter', 'The carnations', 'in a glass vase'),
  goldsmith: c('The goldsmith', 'weighing a ring', 'The couple', 'about to be married'),
  babel: c('The king', 'inspecting the works', 'The stonemasons', 'kneeling, for now'),
  carnival: c('Carnival', 'astride a barrel', 'Lent', 'with a plate of herrings'),
  magi: c('Cosimo de’ Medici', 'the banker, kneeling', 'Botticelli', 'at the edge, looking at you'),
  census: c('The innkeeper', 'taking names', 'The children', 'skating on the ice'),
  hare: c('The young hare', 'sitting very still', 'The window in its eye', 'reflecting'),
};

const GUARD: Cast = c('The gallery guard', 'keeping an eye on things', 'The visitor beside you', 'reading the label');
export const castPair = (id: string): Cast => CASTS[id] ?? GUARD;
export const castOf = (id: string): Sitter => castPair(id)[0];

export type Line = { who: Sitter; text: string };
/** One remark and, usually, an answer from the other sitter. */
export type Exchange = Line[];
/** [who speaks first: 'a' or 'b', the first line, the other's answer] */
type Pair = ['a' | 'b', string, string];

const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];
const play = (painting: string, [first, line, reply]: Pair): Exchange => {
  const [a, b] = castPair(painting);
  const one = first === 'a' ? a : b, two = first === 'a' ? b : a;
  return [{ who: one, text: line }, { who: two, text: reply }];
};

const SAID: Record<string, Pair[]> = {
  first: [
    ['b', 'Our first page together. Write it like you mean it.', 'A fresh ledger. They don’t open one of those for just anybody.'],
    ['b', 'A new book. I always like the first page best.', 'You say that about every book. You mean it every time.'],
    ['a', 'There. Now the painting knows you.', 'And we’ll be very discreet about it.'],
  ],
  both: [
    ['b', 'Paid, and still you counted the lunch. Restraint.', 'I’m not used to it. I’m writing that down too.'],
    ['a', 'Money in and money out on the same line. You’d make a fine banker.', 'Don’t encourage this. A stool will be offered next.'],
    ['b', 'In with one hand, out with the other.', 'That is the whole trade, really. Five hundred years and it hasn’t changed.'],
  ],
  in: [
    ['a', 'Now that is a sound I know. Let me weigh it.', 'Everything gets weighed in here. Even compliments.'],
    ['a', 'Pay day. The gold in the frame is for you.', 'I was never offered the frame.'],
    ['a', 'Good coin. I’ll pretend not to be impressed.', 'Look at those hands. Impressed.'],
  ],
  night: [
    ['b', 'Writing by candlelight. So was everyone worth reading.', 'Mind the wax on the ledger.'],
    ['b', 'Late, but written. That’s what counts.', 'Counting is my job, but yes.'],
    ['a', 'The candle’s low. Your book isn’t.', 'Go to bed. We’ll keep the page open.'],
  ],
  rides: [['b', 'Two rides today. Your feet send their thanks.', 'Somewhere a driver is very fond of you.']],
  feasts: [['b', 'Third meal out today. I’ll have what you’re having.', 'Still Life with Several Lunches. I’d hang it.']],
  roof: [
    ['a', 'Rent. Nobody paints it, everybody pays it.', 'The roof thanks you quietly. Roofs are like that.'],
    ['a', 'The dull ones are paid. Those are the brave lines.', 'Brave, and nobody claps. We’ll clap.'],
  ],
  giving: [
    ['b', 'Given away. The best money in the book.', 'I’d argue, but you’re right.'],
    ['b', 'Somebody’s day just got lighter.', 'And the book got a little warmer.'],
  ],
  food: [
    ['b', 'Food for the house. That’s the kind I like to see.', 'A full basket weighs well.'],
    ['a', 'Groceries. The quiet backbone of every month.', 'Bread first, frames later. Wise.'],
  ],
  saved: [
    ['a', 'Put aside. I’ll keep it warm.', 'You’ll look at it every day, you mean.'],
    ['a', 'Saved. You’re starting to sound like me.', 'Don’t worry. You’re much better company.'],
  ],
  wager: [['b', 'A wager. Fortune is a fickle sitter.', 'Written down, at least. That’s the clever part.']],
  meal: [
    ['b', 'Lunch. Painted properly, as all lunches should be.', 'A good meal is never wasted money. Mostly.'],
    ['a', 'A meal out. The best still lifes are eaten.', 'And the best painters were always hungry.'],
  ],
  new: [
    ['b', 'Something new. I’d like to see it in the light.', 'The question is whether you’ll still love it on Tuesday.'],
    ['a', 'Bought. Every fine room starts with one fine thing.', 'And then a second. And then a cabinet.'],
  ],
  plain: [
    ['a', 'Written. That’s the hardest part done.', 'And the painting moved. Did you see?'],
    ['a', 'Another line in the book.', 'A little more of us, every time.'],
    ['a', 'Noted, weighed, and kept.', 'You make that sound like a poem.'],
  ],
};

/** What the sitters say about what was just written. `seed` keeps the choice steady for the same lines. */
export function sitterLine(painting: string, kept: Entry[], all: Entry[], seed: number): Exchange {
  const ins = kept.filter((e) => e.dir === 'in'), outs = kept.filter((e) => e.dir === 'out');
  const today = all.filter((e) => e.date === kept[0]?.date && e.dir === 'out');
  const has = (...ids: string[]) => outs.some((e) => ids.includes(e.category));
  const h = new Date().getHours();
  const kind =
    all.length === kept.length ? 'first'
    : ins.length && outs.length ? 'both'
    : ins.length ? 'in'
    : h >= 22 || h < 4 ? 'night'
    : has('transport') && today.filter((e) => e.category === 'transport').length >= 2 ? 'rides'
    : has('dining') && today.filter((e) => e.category === 'dining').length >= 3 ? 'feasts'
    : has('rent', 'bills') ? 'roof'
    : has('giving') ? 'giving'
    : has('groceries') ? 'food'
    : has('savings') ? 'saved'
    : has('betting') ? 'wager'
    : has('dining') ? 'meal'
    : has('shopping', 'tech') ? 'new'
    : 'plain';
  return play(painting, pick(SAID[kind], seed));
}

// ——— When nobody asked: the sitters notice you arrive, a quiet day, and the last stroke ———

const MOMENTS: Record<string, Pair[]> = {
  morning: [
    ['a', 'Morning. The light’s good for counting.', 'One line, and we’ll take it from there.'],
    ['b', 'You’re early. We’ve only just been dusted.', 'Speak for yourself. I was up at dawn.'],
  ],
  afternoon: [
    ['b', 'Afternoon. We kept your place.', 'Nothing moved. Well, almost nothing.'],
    ['a', 'Back again. Good. The ledger was getting lonely.', 'Ledgers don’t get lonely. Mostly.'],
  ],
  evening: [
    ['b', 'Evening. The candles are lit.', 'What did today cost? One line is plenty.'],
    ['a', 'The day’s nearly counted.', 'Nearly. There’s always one more lunch.'],
  ],
  night: [
    ['a', 'Up late. So are we, it seems.', 'Nobody sleeps in here. It’s a painting.'],
  ],
  // Back after days away: never a scold. Missing a day costs nothing.
  away: [
    ['b', 'There you are. Missing days cost nothing here.', 'The book waited. Books are good at that.'],
    ['a', 'Welcome back. We kept the colours where you left them.', 'And didn’t touch the ledger. Mostly.'],
  ],
  quiet: [
    ['b', 'A quiet day. Those are the ones I like.', 'Nothing spent is still a line. I’ve weighed it.'],
    ['a', 'Nothing today? Then nothing it is, written down.', 'The emptiest pages are the calmest.'],
  ],
  finished: [
    ['a', 'That’s the last stroke. We’re in full colour.', 'Hang us somewhere nice. We earned it together.'],
    ['b', 'Finished. Look at us.', 'Thirty lines, and all that old varnish gone.'],
  ],
};

export type Moment = 'morning' | 'afternoon' | 'evening' | 'night' | 'away' | 'quiet' | 'finished';
export const momentOf = (hour: number): Moment => (hour >= 22 || hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening');
export function sitterMoment(painting: string, moment: Moment, seed: number): Exchange {
  return play(painting, pick(MOMENTS[moment], seed));
}
