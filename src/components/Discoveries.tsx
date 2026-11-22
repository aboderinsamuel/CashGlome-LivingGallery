// Discoveries: three details of the month's painting, each found by a curator's lens as the painting fills in.
// Locked ones show where they'll be found; an open one zooms in from the whole picture to the detail.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { artSrc, type Painting } from '../lib/art';
import { aim, AT, discoveriesOf, type Discovery } from '../lib/discoveries';
import { Icon } from './Icons';
import { sfx } from '../lib/sound';

const KEY = 'cg-found-';
const seenOf = (month: string) => { try { return Number(localStorage.getItem(KEY + month) ?? 0); } catch { return 0; } };
const setSeen = (month: string, n: number) => { try { localStorage.setItem(KEY + month, String(n)); } catch { /* private mode */ } };
// Which of the month's discoveries they have hunted down themselves (or asked to be shown).
const HUNT = 'cg-hunt-';
export const huntedOf = (month: string): number[] => { try { return JSON.parse(localStorage.getItem(HUNT + month) ?? '[]'); } catch { return []; } };
export const saveHunted = (month: string, l: number[]) => { try { localStorage.setItem(HUNT + month, JSON.stringify(l)); } catch { /* private mode */ } window.dispatchEvent(new Event('cg-found')); };

export function Discoveries({ painting, restored, month, calm, onPlay }: { painting: Painting; restored: number; month: string; calm?: boolean; onPlay?: () => void }) {
  const list = discoveriesOf(painting.id);
  const opened = list.filter((_, i) => restored >= AT[i]).length;
  const [open, setOpen] = useState<{ d: Discovery; i: number; fresh: boolean } | null>(null);
  const [hunt, setHunt] = useState<{ d: Discovery; i: number } | null>(null);
  const [hunted, setHunted] = useState<number[]>(() => huntedOf(month));
  useEffect(() => setHunted(huntedOf(month)), [month]);
  const found = (i: number, d: Discovery) => { const l = [...new Set([...hunted, i])]; setHunted(l); saveHunted(month, l); setHunt(null); setOpen({ d, i, fresh: true }); };
  // A discovery found since last time opens by itself, once.
  useEffect(() => {
    if (!list.length) return;
    const seen = seenOf(month);
    if (opened > seen) {
      setSeen(month, opened);
      // Only one at a time, as it happens; a month that arrives already restored doesn't pop them all.
      if (opened - seen === 1) { const i = opened - 1; const t = setTimeout(() => setHunt({ d: list[i], i }), calm ? 300 : 2600); return () => clearTimeout(t); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, month]);
  if (!list.length) return null;
  return (
    <section className="disc" aria-label="Discoveries">
      <div className="td-h"><h2>Find <i>it</i></h2><span>{hunted.filter((i) => i < opened).length} of {list.length} found{onPlay && <> · <button className="td-link" onClick={onPlay}>All games in Play<Icon.right size={12} /></button></>}</span></div>
      <div className="disc-row">
        {list.map((d, i) => {
          const on = i < opened;
          const got = on && hunted.includes(i);
          return (
            <button key={i} className={'disc-lens' + (on ? ' on' : '') + (on && !got ? ' hunt' : '')} disabled={!on} onClick={() => (got ? setOpen({ d, i, fresh: false }) : setHunt({ d, i }))}
              aria-label={got ? `Discovery: ${d.title}` : on ? `Find ${d.title} in the painting` : `Opens at ${AT[i]} painted strokes`}>
              <span className="disc-glass" style={got ? { backgroundImage: `url(${artSrc(painting.id, 'md')})`, backgroundSize: `${d.zoom * 100}% auto`, backgroundPosition: `${aim(d.x, d.zoom)}% ${aim(d.y, d.zoom)}%` } : on ? { backgroundImage: `url(${artSrc(painting.id, 'sm')})` } : undefined}>
                {!on && <span className="disc-lock">{AT[i]}</span>}
                {on && !got && <span className="disc-q">Find</span>}
              </span>
              <span className="disc-t">{got ? d.title : on ? <><em>Find:</em> {d.title}</> : `At ${AT[i]} strokes`}</span>
            </button>
          );
        })}
      </div>
      {createPortal(<AnimatePresence>{hunt && <Hunt key={'h' + hunt.i} painting={painting} d={hunt.d} calm={calm} onFound={() => found(hunt.i, hunt.d)} onClose={() => setHunt(null)} />}</AnimatePresence>, document.body)}
      {createPortal(<AnimatePresence>{open && <Lens key={open.i} painting={painting} d={open.d} fresh={open.fresh} calm={calm} onClose={() => setOpen(null)} />}</AnimatePresence>, document.body)}
    </section>
  );
}

export function Lens({ painting, d, fresh, calm, onClose }: { painting: Painting; d: Discovery; fresh: boolean; calm?: boolean; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { try { navigator.vibrate?.([10, 70, 18]); } catch { /* none */ } }, []);
  const src = artSrc(painting.id, 'lg');
  return (
    <motion.div className="lens-scrim" role="dialog" aria-label={d.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="lens-card" onClick={(e) => e.stopPropagation()} initial={calm ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <div className="lens-kicker">{fresh ? 'A discovery' : 'Discovery'}</div>
        <motion.div className="lens-glass" style={{ backgroundImage: `url(${src})` }}
          initial={calm ? false : { backgroundSize: '100% auto', backgroundPosition: '50% 50%' }}
          animate={{ backgroundSize: `${d.zoom * 100}% auto`, backgroundPosition: `${aim(d.x, d.zoom)}% ${aim(d.y, d.zoom)}%` }}
          transition={{ duration: calm ? 0 : 2.2, ease: [0.6, 0, 0.2, 1], delay: 0.25 }} />
        <h3>{d.title}</h3>
        <p>{d.note}</p>
        <div className="lens-label"><i>{painting.title}</i><span>{painting.artist}, {painting.year}</span></div>
        <button className="stamp sm lens-close" onClick={onClose} autoFocus><Icon.check size={14} />Back to my book</button>
      </motion.div>
    </motion.div>
  );
}

type Mark = { x: number; y: number; word: string; dist: number };
/** The hunt: the whole painting and a clue. Tap where you think it is; each miss says warmer or colder. */
export function Hunt({ painting, d, calm, onFound, onClose }: { painting: Painting; d: Discovery; calm?: boolean; onFound: () => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  // How close counts as found: the detail's own size, from how close the curator had to look.
  const radius = Math.max(6, 30 / d.zoom);
  const win = () => { if (done) return; setDone(true); sfx.restore(); try { navigator.vibrate?.([12, 60, 20]); } catch { /* none */ } setTimeout(onFound, calm ? 300 : 1700); };
  const tap = (e: React.MouseEvent) => {
    if (done || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
    // Distance in the painting's own proportions, measured against its shorter side.
    const ax = r.width / Math.min(r.width, r.height), ay = r.height / Math.min(r.width, r.height);
    const dist = Math.hypot((x - d.x) * ax, (y - d.y) * ay);
    if (dist <= radius * Math.min(ax, ay) * 1.15) { win(); return; }
    const last = marks[marks.length - 1];
    const word = dist < radius * 2.2 ? 'So close' : last ? (dist < last.dist - 2 ? 'Warmer' : dist > last.dist + 2 ? 'Colder' : 'About the same') : dist < radius * 4 ? 'Warm' : 'Cold';
    setMarks((m) => [...m.slice(-4), { x, y, word, dist }]);
    setMisses((n) => n + 1);
    try { navigator.vibrate?.(8); } catch { /* none */ }
  };
  // After three misses a soft glow gathers near it; it narrows after five, and never sits exactly on it.
  const off = (v: number) => ((v * 7) % 7) - 3.5;
  const glow = misses >= 3 ? { left: `${d.x + off(d.y)}%`, top: `${d.y + off(d.x)}%`, width: `${radius * (misses >= 5 ? 4 : 7)}%` } : null;
  const last = marks[marks.length - 1];
  return (
    <motion.div className="hunt-scrim" role="dialog" aria-label={`Find ${d.title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="hunt-top">
        <div className="hunt-clue"><span>Find, in the painting</span><b>{d.title}</b></div>
        <div className="hunt-acts">
          <button className="hunt-quiet" onClick={win} disabled={done}>Show me</button>
          <button className="hunt-quiet" onClick={onClose}><Icon.close size={14} />Later</button>
        </div>
      </div>
      <div className="hunt-stage">
        <motion.div ref={box} className={'hunt-pic' + (done ? ' done' : '')} onClick={tap} initial={calm ? false : { scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
          <img src={artSrc(painting.id, 'lg')} alt={painting.title} draggable={false} />
          {glow && !done && <motion.span key={misses >= 5 ? 'g2' : 'g1'} className="hunt-glow" style={glow} initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4 }} aria-hidden />}
          {done && <motion.span className="hunt-found" style={{ left: `${d.x}%`, top: `${d.y}%`, translate: d.y < 25 ? "-50% 46px" : undefined }} initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 16 }}><Icon.check size={16} />Found it</motion.span>}
          {done && <motion.span className="hunt-hit" style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${radius * 2.4}%` }} initial={{ scale: 2.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} aria-hidden />}
          {!done && marks.map((m, i) => (
            <motion.span key={m.x + ':' + m.y} className={'hunt-mark' + (i === marks.length - 1 ? ' last' : '')} style={{ left: `${m.x}%`, top: `${m.y}%` }} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: i === marks.length - 1 ? 1 : 0.4 }}>
              {i === marks.length - 1 && <em>{m.word}</em>}
            </motion.span>
          ))}
        </motion.div>
      </div>
      <div className="hunt-foot" aria-live="polite">
        <span className="hunt-label"><i>{painting.title}</i>{painting.artist}, {painting.year}</span>
        <span className="hunt-say">{done ? 'There it is. Look closer.' : !last ? 'Tap where you think it is.' : misses >= 3 ? `${last.word}. The light is gathering near it.` : `${last.word}. Try again.`}</span>
      </div>
    </motion.div>
  );
}
