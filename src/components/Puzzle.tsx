// The restorer's puzzle: a painting cut into tiles and shuffled. Pick a tile, pick another, and they swap.
// Played free (any size), or as one of the Rooms, where the size and the help are set by the room.
// No clock: when the picture is whole, it says so plainly and opens the next room.
// The dark room stays up from one room to the next; only the board inside changes. A board is shown only once
// its painting is decoded and its shape known, so the pieces never jump when the picture arrives.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { artSrc, type Painting } from '../lib/art';
import { fewestMoves, ROMAN_ROOM, ROOMS, roomsOf, sureHand, wingOf, type Room, type Seals } from '../lib/rooms';
import { sfx } from '../lib/sound';
import { Icon } from './Icons';

const BEST = 'cg-puzzle-';
const bestOf = (k: string) => { try { return Number(localStorage.getItem(BEST + k)) || 0; } catch { return 0; } };
const saveBest = (k: string, n: number) => { try { localStorage.setItem(BEST + k, String(n)); } catch { /* private mode */ } };
const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* none */ } };

/** Each painting is fetched and decoded once; the board waits for it, so its shape never changes under the pieces. */
const loaded = new Map<string, Promise<number>>();
function loadArt(src: string): Promise<number> {
  let p = loaded.get(src);
  if (!p) {
    const img = new Image();
    img.src = src;
    p = img.decode().then(() => img.naturalWidth / img.naturalHeight).catch(() => 4 / 3);
    loaded.set(src, p);
  }
  return p;
}
const known = new Map<string, number>();
/** Start fetching a painting's puzzle image before its room opens (on hover, focus, or while a win card shows). */
export const preloadPuzzle = (id: string) => { const s = artSrc(id, 'lg'); loadArt(s).then((r) => known.set(s, r)); };

/** A shuffle with no tile left where it belongs, so every piece needs a move. */
function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < n; i++) if (a[i] === i) { const j = (i + 1) % n; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

interface Props {
  painting: Painting;
  calm?: boolean;
  onClose: () => void;
  /** Played as a room: fixed size and help, and a way on to the next. */
  room?: Room;
  onSolved?: (moves: number, earned: Seals) => void;
  onNext?: () => void;
  /** Changing this deals a new board inside the same dark room, with no flash of the page behind. */
  boardKey?: string | number;
}

export function Puzzle(props: Props) {
  const { onClose } = props;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <motion.div className="pz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: props.calm ? 0.1 : 0.28 }}>
      <AnimatePresence mode="wait" initial={false}>
        <Board key={props.boardKey ?? 'board'} {...props} />
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

function Board({ painting, calm, onClose, room, onSolved, onNext }: Props) {
  const [size, setSize] = useState(room?.size ?? 3);
  const [tiles, setTiles] = useState(() => shuffled((room?.size ?? 3) ** 2));
  const [pick, setPick] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(false);
  const src = artSrc(painting.id, 'lg');
  const [ratio, setRatio] = useState<number | null>(() => known.get(src) ?? null);
  const ready = ratio !== null;
  const key = room ? `room-${room.n}` : `${painting.id}-${size}`;
  const [best, setBest] = useState(() => bestOf(key));
  const hints = room ? room.hints : true;
  const canPeek = room ? room.peek : true;
  const solved = tiles.every((t, i) => t === i);
  const placed = tiles.filter((t, i) => t === i).length;
  const last = room && room.n === ROOMS.length;
  // For the seals: the fewest moves this shuffle allows, whether the whole was peeked at, and what was held before.
  const fewest = useRef(fewestMoves(tiles));
  const peeked = useRef(false);
  const [won, setWon] = useState<{ eye: boolean; hand: boolean; hadEye: boolean; hadHand: boolean; first: boolean } | null>(null);
  const target = sureHand(fewest.current);

  useEffect(() => { let live = true; loadArt(src).then((r) => { known.set(src, r); if (live) setRatio(r); }); return () => { live = false; }; }, [src]);
  // While the win card is up, the next room's painting is already on its way.
  useEffect(() => { if (solved && room && !last) { const r = ROOMS.find((x) => x.n === room.n + 1); if (r) preloadPuzzle(r.painting); } }, [solved, room, last]);
  const deal = (n: number) => { const t = shuffled(n * n); fewest.current = fewestMoves(t); peeked.current = false; setWon(null); setSize(n); setTiles(t); setPick(null); setMoves(0); setBest(bestOf(room ? key : `${painting.id}-${n}`)); };
  const startPeek = () => { peeked.current = true; setPeek(true); };

  const tap = (slot: number) => {
    if (solved || !ready) return;
    if (pick === null) { setPick(slot); buzz(6); return; }
    if (pick === slot) { setPick(null); return; }
    const next = [...tiles];
    [next[pick], next[slot]] = [next[slot], next[pick]];
    setTiles(next); setPick(null); setMoves((m) => m + 1);
    const home = (next[slot] === slot ? 1 : 0) + (next[pick] === pick ? 1 : 0);
    if (home && hints) { sfx.tap(); buzz(home > 1 ? [8, 40, 8] : 10); }
    if (next.every((t, i) => t === i)) {
      const m = moves + 1;
      if (!best || m < best) { saveBest(key, m); setBest(m); }
      if (room) {
        const saved = roomsOf(), had = saved.seals[room.n] ?? {};
        const earned = { eye: !peeked.current, hand: m <= target };
        setWon({ ...earned, hadEye: !!had.eye, hadHand: !!had.hand, first: saved.cleared < room.n });
        onSolved?.(m, earned);
      } else onSolved?.(m, {});
      setTimeout(() => { sfx.restore(); buzz([12, 70, 22]); }, 250);
    }
  };

  // The board fits the screen in the painting's own proportions.
  const r = ratio ?? 4 / 3;
  const board = useMemo(() => ({ aspectRatio: String(r), width: `min(calc(100vw - clamp(20px, 6vw, 64px)), calc((100vh - 220px) * ${r}))` }), [r]);
  const n = size;
  const title = room ? `Room ${ROMAN_ROOM[room.n]}` : 'Put it back together';

  return (
    <motion.div className="pz-body" role="dialog" aria-label={`${title}: ${painting.title}`} aria-busy={!ready}
      initial={calm ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={calm ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: calm ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}>
      <div className="pz-top">
        <div className="pz-clue"><span>{room ? `${title} · ${wingOf(room.n).name} · ${n * n} pieces` : title}</span><b>{painting.title}</b>
          {room && <i className="pz-goal">Three seals: restore it{room.peek ? ', without peeking' : ''}, in {target} moves or fewer.</i>}</div>
        {!room && (
          <div className="pz-sizes" role="radiogroup" aria-label="How many pieces">
            {[3, 4, 5, 6].map((s) => <button key={s} role="radio" aria-checked={size === s} className={size === s ? 'on' : ''} onClick={() => deal(s)}>{s * s} pieces</button>)}
          </div>
        )}
        {canPeek && !solved && (
          <button className="pz-quiet" onPointerDown={startPeek} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}
            onKeyDown={(e) => e.key === ' ' && startPeek()} onKeyUp={() => setPeek(false)} aria-label="Hold to see the whole painting">Hold to peek</button>
        )}
        <button className="pz-quiet" onClick={onClose}><Icon.close size={14} />Close</button>
      </div>

      <div className="pz-stage">
        {!ready && <div className="pz-wait" style={board} aria-hidden><span>Laying out the pieces</span></div>}
        {ready && <motion.div className={'pz-board' + (solved ? ' whole' : '') + (hints ? ' hints' : '')} style={{ ...board, gridTemplateColumns: `repeat(${n}, 1fr)` }}
          initial={calm ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          {tiles.map((t, slot) => {
            const tx = t % n, ty = Math.floor(t / n);
            return (
              <motion.button layout={!calm} key={t} className={'pz-tile' + (pick === slot ? ' picked' : '') + (hints && t === slot ? ' home' : '')}
                data-piece={t} onClick={() => tap(slot)} aria-label={`Piece ${slot + 1}${hints && t === slot ? ', in place' : ''}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{ backgroundImage: `url(${src})`, backgroundSize: `${n * 100}% ${n * 100}%`, backgroundPosition: `${n > 1 ? (tx / (n - 1)) * 100 : 0}% ${n > 1 ? (ty / (n - 1)) * 100 : 0}%` }} />
            );
          })}
          {peek && <img className="pz-peek" src={src} alt="" aria-hidden />}
          {/* Restored: said plainly, in gold, with the way on. */}
          <AnimatePresence>
            {solved && (
              <motion.div className="pz-won" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: calm ? 0 : 0.8, duration: 0.5 }}>
                <motion.div className="pz-won-card" initial={calm ? false : { scale: 0.86, y: 16 }} animate={{ scale: 1, y: 0 }} transition={{ delay: calm ? 0 : 0.85, type: 'spring', stiffness: 220, damping: 18 }}>
                  <span className="pz-won-seal" aria-hidden>{room ? ROMAN_ROOM[room.n] : <Icon.check size={22} />}</span>
                  <b>{room ? <>Room {ROMAN_ROOM[room.n]}, <em>restored</em>.</> : <>Whole <em>again</em>.</>}</b>
                  <span>{moves} {moves === 1 ? 'move' : 'moves'}{room ? ` · fewest possible ${fewest.current}` : ''}{best === moves ? ' · your best' : best ? ` · your best is ${best}` : ''}</span>
                  {room && won && (
                    <ol className="pz-seals" aria-label="Seals for this room">
                      {([
                        ['Restored', 'The picture is whole.', true, won.first],
                        ['By eye', room.peek ? 'No peeking.' : 'No peek in this room.', won.eye || won.hadEye, won.eye && !won.hadEye],
                        ['Sure hand', `${target} moves or fewer.`, won.hand || won.hadHand, won.hand && !won.hadHand],
                      ] as const).map(([name, rule, has, fresh], i) => (
                        <motion.li key={name} className={(has ? 'has' : '') + (fresh ? ' fresh' : '')}
                          initial={calm ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: calm ? 0 : 1.1 + i * 0.22, type: 'spring', stiffness: 380, damping: 16 }}>
                          <span className="pz-seal-wax" aria-hidden>{has ? <Icon.check size={14} /> : null}</span>
                          <b>{name}</b><small>{has ? (fresh ? 'New' : rule) : (i === 1 ? 'Play again without peeking' : `Play again in ${target} or fewer`)}</small>
                        </motion.li>
                      ))}
                    </ol>
                  )}
                  {room && !last && <span className="pz-won-next">Room {ROMAN_ROOM[room.n + 1]} is open{room.n + 1 === 10 ? ': the Master’s Room, 36 pieces.' : '.'}{room.n === 10 ? ' The Reserve is open too.' : ''}</span>}
                  {last && <span className="pz-won-next">Every room restored. The Reserve is yours.</span>}
                  <div className="pz-won-acts">
                    {room && !last && onNext && <button className="pz-again" onClick={onNext}>Next room<Icon.right size={14} /></button>}
                    {!room && <button className="pz-again" onClick={() => deal(size)}>Shuffle again</button>}
                    <button className="pz-quiet" onClick={onClose}>{room ? 'Back to the rooms' : 'Close'}</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>}
      </div>

      <div className="pz-foot" aria-live="polite">
        <span className="pz-label"><i>{painting.title}</i>{painting.artist}, {painting.year}</span>
        <span className="pz-say">
          {!ready ? 'Laying out the pieces…' : solved ? 'Whole again.' : moves === 0 ? 'Pick a piece, then the place it belongs.' : hints ? `${placed} of ${n * n} in place · ${moves} ${moves === 1 ? 'move' : 'moves'}` : `${moves} ${moves === 1 ? 'move' : 'moves'}. No glow in this room: trust your eye.`}
        </span>
      </div>
    </motion.div>
  );
}
