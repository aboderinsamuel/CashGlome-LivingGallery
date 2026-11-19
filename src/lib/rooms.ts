// The Rooms: twelve paintings to put back together, one after another, each harder than the last.
// A room opens when the one before it is restored. After Room X the Reserve opens: every other painting
// in the library, free to play at any size. Progress lives on this device, like the book.
import { PAINTINGS } from './art';

export interface Room {
  n: number;
  painting: string;
  /** Pieces per side: 3 is 9 pieces, 6 is 36. */
  size: number;
  /** Pieces in the right place show it, and the count is shown. */
  hints: boolean;
  /** Hold to see the whole painting. */
  peek: boolean;
}
export interface Wing { name: string; from: number; to: number; rule: string }

const R = (n: number, painting: string, size: number, hints: boolean, peek: boolean): Room => ({ n, painting, size, hints, peek });

export const ROOMS: Room[] = [
  R(1, 'wave', 3, true, true),
  R(2, 'milkmaid', 3, true, true),
  R(3, 'hunters', 3, true, true),
  R(4, 'arnolfini', 4, true, true),
  R(5, 'ssireum', 4, true, true),
  R(6, 'gleaners', 4, true, true),
  R(7, 'meninas', 5, false, true),
  R(8, 'babur', 5, false, true),
  R(9, 'harvesters', 5, false, true),
  R(10, 'babel', 6, false, false),
  R(11, 'gayumars', 6, false, false),
  R(12, 'wedding', 6, false, false),
];

export const WINGS: Wing[] = [
  { name: 'The Entrance Hall', from: 1, to: 3, rule: '9 pieces. Pieces glow when they land in place.' },
  { name: 'The Long Gallery', from: 4, to: 6, rule: '16 pieces. Still with the glow.' },
  { name: 'The Cabinet', from: 7, to: 9, rule: '25 pieces. No glow: only Peek helps.' },
  { name: 'The Master’s Room', from: 10, to: 12, rule: '36 pieces. No glow, no Peek.' },
];
export const wingOf = (n: number) => WINGS.find((w) => n >= w.from && n <= w.to)!;

/** The Reserve opens when this room is restored. */
export const RESERVE_AFTER = 10;
/** Every other painting in the library: free play once the Reserve opens. */
export const RESERVE = Object.keys(PAINTINGS).filter((id) => !ROOMS.some((r) => r.painting === id));

export const ROMAN_ROOM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const KEY = 'cg-rooms';
/** The two seals beyond Restored. Earned once, kept for good: nothing is ever taken away. */
export interface Seals { eye?: boolean; hand?: boolean }
type Saved = { cleared: number; best: Record<number, number>; seals: Record<number, Seals> };
export function roomsOf(): Saved {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? ''); if (typeof s?.cleared === 'number') return { cleared: s.cleared, best: s.best ?? {}, seals: s.seals ?? {} }; } catch { /* first time */ }
  return { cleared: 0, best: {}, seals: {} };
}
/** Seals a room holds, Restored included: 0 to 3. */
export const sealCount = (s: Saved, n: number) => (n <= s.cleared ? 1 + (s.seals[n]?.eye ? 1 : 0) + (s.seals[n]?.hand ? 1 : 0) : 0);
export const SEALS_IN_ALL = 36;

/** The fewest swaps that can put this shuffle right: every piece, less one for each loop of pieces. */
export function fewestMoves(tiles: number[]) {
  const seen = new Array(tiles.length).fill(false); let loops = 0;
  for (let i = 0; i < tiles.length; i++) { if (seen[i]) continue; loops++; for (let j = i; !seen[j]; j = tiles[j]) seen[j] = true; }
  return tiles.length - loops;
}
/** Sure hand: the fewest moves, with a little room for a slip. */
export const sureHand = (fewest: number) => fewest + Math.max(1, Math.round(fewest * 0.1));

/** A room restored: the next one opens, and any new seal is kept. Returns the saved progress. */
export function clearRoom(n: number, moves: number, earned: Seals = {}): Saved {
  const s = roomsOf();
  const had = s.seals[n] ?? {};
  const next: Saved = { cleared: Math.max(s.cleared, n), best: { ...s.best, [n]: s.best[n] ? Math.min(s.best[n], moves) : moves },
    seals: { ...s.seals, [n]: { eye: had.eye || earned.eye, hand: had.hand || earned.hand } } };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  window.dispatchEvent(new Event('cg-found'));
  return next;
}
