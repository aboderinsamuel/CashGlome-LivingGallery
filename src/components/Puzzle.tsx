// The restorer's puzzle: a painting cut into tiles and shuffled. Pick a tile, pick another, and they swap.
// No clock and no score to beat but your own: just the picture coming back together.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { artSrc, type Painting } from '../lib/art';
import { sfx } from '../lib/sound';
import { Icon } from './Icons';

const BEST = 'cg-puzzle-';
const bestOf = (k: string) => { try { return Number(localStorage.getItem(BEST + k)) || 0; } catch { return 0; } };
const saveBest = (k: string, n: number) => { try { localStorage.setItem(BEST + k, String(n)); } catch { /* private mode */ } };
const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* none */ } };

/** A shuffle with no tile left where it belongs, so every piece needs a move. */
function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < n; i++) if (a[i] === i) { const j = (i + 1) % n; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function Puzzle({ painting, calm, onClose }: { painting: Painting; calm?: boolean; onClose: () => void }) {
  const [size, setSize] = useState(3);
  const [tiles, setTiles] = useState(() => shuffled(9));
  const [pick, setPick] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [ratio, setRatio] = useState(4 / 3);
  const src = artSrc(painting.id, 'lg');
  const key = `${painting.id}-${size}`;
  const [best, setBest] = useState(() => bestOf(key));
  const solved = tiles.every((t, i) => t === i);
  const placed = tiles.filter((t, i) => t === i).length;

  useEffect(() => { const img = new Image(); img.onload = () => setRatio(img.naturalWidth / img.naturalHeight); img.src = src; }, [src]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const deal = (n: number) => { setSize(n); setTiles(shuffled(n * n)); setPick(null); setMoves(0); setBest(bestOf(`${painting.id}-${n}`)); };

  const tap = (slot: number) => {
    if (solved) return;
    if (pick === null) { setPick(slot); buzz(6); return; }
    if (pick === slot) { setPick(null); return; }
    const next = [...tiles];
    [next[pick], next[slot]] = [next[slot], next[pick]];
    setTiles(next); setPick(null); setMoves((m) => m + 1);
    const home = (next[slot] === slot ? 1 : 0) + (next[pick] === pick ? 1 : 0);
    if (home) { sfx.tap(); buzz(home > 1 ? [8, 40, 8] : 10); }
    if (next.every((t, i) => t === i)) {
      const m = moves + 1;
      if (!best || m < best) { saveBest(key, m); setBest(m); }
      setTimeout(() => { sfx.restore(); buzz([12, 70, 22]); }, 250);
    }
  };

  // The board fits the screen in the painting's own proportions.
  const board = useMemo(() => ({ aspectRatio: String(ratio), width: `min(calc(100vw - 64px), calc((100vh - 220px) * ${ratio}))` }), [ratio]);
  const n = size;

  return createPortal(
    <motion.div className="pz" role="dialog" aria-label={`Puzzle: ${painting.title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="pz-top">
        <div className="pz-clue"><span>Put it back together</span><b>{painting.title}</b></div>
        <div className="pz-sizes" role="radiogroup" aria-label="How many pieces">
          {[3, 4, 5].map((s) => <button key={s} role="radio" aria-checked={size === s} className={size === s ? 'on' : ''} onClick={() => deal(s)}>{s * s} pieces</button>)}
        </div>
        <button className="pz-quiet" onClick={onClose}><Icon.close size={14} />Close</button>
      </div>

      <div className="pz-stage">
        <div className={'pz-board' + (solved ? ' whole' : '')} style={{ ...board, gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {tiles.map((t, slot) => {
            const tx = t % n, ty = Math.floor(t / n);
            return (
              <motion.button layout={!calm} key={t} className={'pz-tile' + (pick === slot ? ' picked' : '') + (t === slot ? ' home' : '')}
                onClick={() => tap(slot)} aria-label={`Piece ${slot + 1}${t === slot ? ', in place' : ''}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{ backgroundImage: `url(${src})`, backgroundSize: `${n * 100}% ${n * 100}%`, backgroundPosition: `${n > 1 ? (tx / (n - 1)) * 100 : 0}% ${n > 1 ? (ty / (n - 1)) * 100 : 0}%` }} />
            );
          })}
        </div>
      </div>

      <div className="pz-foot" aria-live="polite">
        <span className="pz-label"><i>{painting.title}</i>{painting.artist}, {painting.year}</span>
        <AnimatePresence mode="wait">
          {solved ? (
            <motion.span key="won" className="pz-say" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              Whole again, in {moves} {moves === 1 ? 'move' : 'moves'}{best === moves ? '. Your best.' : best ? `. Your best is ${best}.` : '.'}
              <button className="pz-again" onClick={() => deal(size)}>Shuffle again</button>
            </motion.span>
          ) : (
            <motion.span key="play" className="pz-say" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {moves === 0 ? 'Pick a piece, then the place it belongs.' : `${placed} of ${n * n} in place · ${moves} ${moves === 1 ? 'move' : 'moves'}`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body,
  );
}
