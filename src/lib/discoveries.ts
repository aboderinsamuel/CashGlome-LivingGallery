// Discoveries: as a month's painting is cleaned, a curator's lens finds the details people walk past.
// Each is a point in the painting (percent across, percent down), how close to look, and a short note.
// They open at a third, two thirds and the whole of the restoration, so keeping the book teaches the picture.
import { PATCHES } from './art';

/** Where to aim a background-image crop so the point (x, y) sits in the middle of a lens zoomed z times. */
export const aim = (p: number, z: number) => Math.max(0, Math.min(100, ((p / 100 - 0.5 / z) / (1 - 1 / z)) * 100));

export interface Discovery { x: number; y: number; zoom: number; title: string; note: string }

const D = (x: number, y: number, zoom: number, title: string, note: string): Discovery => ({ x, y, zoom, title, note });

export const DISCOVERIES: Record<string, Discovery[]> = {
  moneylender: [
    D(55, 88, 4, 'The mirror on the table', 'A small convex mirror catches a man by the window outside the room, and the town beyond. The painter put the world the money comes from into the counting-house.'),
    D(41, 62, 3.4, 'Weighing the coins', 'He tests each coin on the scale. Clipped and worn coins were common, so weight, not the face, told you what one was worth.'),
    D(75, 82, 3.2, 'The wife’s book', 'She turns the page of a prayer book while her eyes follow the gold. Matsys leaves us to decide which of the two holds her.'),
  ],
  arnolfini: [
    D(50, 30, 5, 'Two people in the mirror', 'The round mirror shows the couple from behind and two more figures in the doorway: one may be van Eyck himself.'),
    D(50, 25, 5, 'The signature on the wall', '“Johannes de eyck fuit hic 1434”: Jan van Eyck was here. Written like a witness signing a record, not a painter signing a canvas.'),
    D(46, 88, 4, 'The little dog', 'A griffon terrier, rendered hair by hair. Dogs in portraits often stood for faithfulness; this one also looks straight at you.'),
  ],
  hunters: [
    D(10, 45, 4.5, 'The falling sign', 'The inn’s sign hangs loose on one hook, about to fall. Below it, people tend a fire in the snow. Nobody looks up.'),
    D(72, 72, 3.4, 'Skaters on the ponds', 'Tiny figures skate, curl and fall on the frozen water. Bruegel paints a hard winter and still finds people at play in it.'),
    D(29, 62, 3.2, 'What the hunters bring home', 'Three hunters, a pack of tired dogs, and one fox on a pole. It was a poor day. They walk home anyway.'),
  ],
  harvesters: [
    D(75, 78, 3.4, 'Lunch under the pear tree', 'The workers stop for bread, porridge and pears in the shade. Most of the painting is work; its heart is a meal.'),
    D(54, 83, 3.6, 'The sleeper', 'One man has fallen asleep at the foot of the tree, legs spread, his shirt undone. Bruegel lets him rest.'),
    D(42, 42, 4, 'The world past the field', 'Beyond the wheat the land falls away to a village, a harbour and the sea: the same afternoon, everywhere at once.'),
  ],
  babel: [
    D(78, 22, 3.2, 'Into the clouds', 'The tower has reached the clouds and keeps going. In the old story, that is exactly the problem.'),
    D(92, 72, 3.4, 'The harbour', 'Ships unload stone and timber at the tower’s foot. Every great project starts with a supply chain.'),
    D(47, 10, 3.2, 'The red brick', 'Finished floors are faced in pale stone. Up top, where work goes on, the bare red brick shows. Ambition is ahead of the plan.'),
  ],
  wedding: [
    D(64, 35, 3.6, 'The bride', 'She sits under the green cloth with a paper crown, hands folded, eyes closed. The groom may not even be at the table.'),
    D(73, 66, 3, 'A door for a tray', 'Two men carry the bowls of porridge on a door taken off its hinges. A feast made with what was at hand.'),
    D(32, 85, 3.6, 'The child with the plate', 'In the corner a small child licks the last of the dish, wearing a hat far too big. Nothing is wasted.'),
  ],
  census: [
    D(64, 82, 3.6, 'Mary and Joseph', 'Easy to miss: a woman on a donkey and a man with a saw, arriving like everyone else to be counted.'),
    D(7, 60, 3.4, 'Paying at the window', 'The crowd at the inn’s window is paying the census tax. The clerk writes each name in a ledger.'),
    D(76, 86, 3.4, 'Children on the ice', 'Children skate, spin tops and pull each other on sledges while the adults queue to pay.'),
  ],
  athens: [
    D(51, 45, 3.6, 'Plato and Aristotle', 'At the centre, Plato points up to ideas; Aristotle holds his hand flat over the world. One argument, painted in two gestures.'),
    D(43, 66, 3.6, 'The thinker on the steps', 'A man writes alone, leaning on a block. Raphael added him late, and gave him the face of Michelangelo.'),
    D(93, 55, 4.5, 'Raphael himself', 'Near the right edge, a young man in a dark cap looks out at us. It is the painter, among the philosophers.'),
  ],
  icarus: [
    D(87, 78, 3.2, 'The legs in the water', 'Icarus has already fallen: two small legs in the sea by the ship. The ploughman, the shepherd and the fisherman carry on.'),
    D(44, 67, 3.4, 'The ploughman', 'The biggest figure in the picture is a farmer at work. The famous story happens behind him, and he never turns round.'),
    D(52, 55, 3.6, 'The shepherd looking up', 'He gazes at the sky, where Daedalus would be. He is looking the wrong way.'),
  ],
  goldsmith: [
    D(89, 73, 4.2, 'The mirror on the counter', 'A convex mirror shows the street outside the shop, with two men passing. The painter shows his customers the world.'),
    D(60, 66, 3.4, 'Weighing a ring', 'The goldsmith holds a ring over his scales while a couple waits. A wedding, priced by weight.'),
    D(80, 36, 3, 'The goods on the shelves', 'Coral, crystal, rings, a belt buckle and seed pearls: a jeweller’s stock, and a record of what money bought in 1449.'),
  ],
  gisze: [
    D(37, 70, 3.4, 'The glass vase', 'A thin Venetian glass holds carnations. Its clear water and fine rim show off the painter’s skill as much as the flowers.'),
    D(80, 80, 3.6, 'The letter in his hands', 'Georg Gisze opens a letter addressed to him in London, where he traded. Letters were how merchants moved money.'),
    D(36, 6, 4.4, 'The motto on the wall', 'A note pinned above him reads, in Latin, “No pleasure without regret.” A merchant’s portrait with a warning in it.'),
  ],
  matthew: [
    D(72, 32, 2.6, 'The beam of light', 'The light enters from the right, above Christ’s hand, and falls along the wall to the tax collector’s table.'),
    D(61, 41, 3, 'The pointing hand', 'Christ’s hand echoes Michelangelo’s Adam. He chooses a man who counts money for a living.'),
    D(25, 63, 3.4, 'The coins on the table', 'Coins, a purse and an account book. Two young men keep counting and never look up.'),
  ],
  magi: [
    D(93, 58, 3.6, 'The painter looks at you', 'The young man in the yellow cloak at the far right is Botticelli, the only figure facing out of the picture.'),
    D(40, 48, 3.4, 'The banker kneeling', 'The old man at the Child’s feet is Cosimo de’ Medici, the banker who paid for Florence’s art.'),
    D(30, 17, 2.8, 'The broken stable', 'The stable sits in classical ruins: something new being born inside the old world.'),
  ],
  carnival: [
    D(22, 75, 3.6, 'Carnival on his barrel', 'A fat man rides a barrel with a pig’s head on a spit for a lance. The feast before the fast.'),
    D(66, 88, 3.6, 'Lent on her cart', 'A thin figure on a cart pushed by a monk and a nun, armed with two herrings on a baker’s paddle.'),
    D(53, 59, 3.4, 'The well at the centre', 'Around the well, people draw water, sell fish and give alms. The square is the whole year in one day.'),
  ],
  hare: [
    D(60, 53, 7, 'The window in the eye', 'Look into the hare’s eye: Dürer painted the reflection of a window there, the room he worked in.'),
    D(57, 90, 4.5, 'The monogram', 'His initials, AD, and the year 1502 sit on the ground. Dürer signed his work like a trademark.'),
    D(30, 57, 3.4, 'Fur, hair by hair', 'Watercolour and gouache in single strokes, each hair laid in a different direction. It took patience, not speed.'),
  ],
  teniers: [
    D(14, 85, 3.6, 'The collector in the hat', 'Archduke Leopold Wilhelm, in a tall hat, shows his pictures to guests. Teniers was his court painter and keeper of the gallery.'),
    D(67, 27, 2.8, 'A wall of Italian masters', 'Each little canvas copies a real painting from the collection, many by Titian and Veronese. Some now hang in Vienna.'),
    D(62, 88, 3.4, 'The paintings on the floor', 'More canvases lean against the table, waiting for a place on the wall. A collection is never finished.'),
  ],
};

/** Patches needed to open each of the month's three discoveries. */
export const AT = [Math.round(PATCHES / 3), Math.round((PATCHES * 2) / 3), PATCHES];

export function discoveriesOf(painting: string): Discovery[] { return DISCOVERIES[painting] ?? []; }
