// Discoveries: three details of the month's painting, each found by a curator's lens as the varnish comes off.
// Locked ones show where they'll be found; an open one zooms in from the whole picture to the detail.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { artSrc, type Painting } from '../lib/art';
import { aim, AT, discoveriesOf, type Discovery } from '../lib/discoveries';
import { Icon } from './Icons';

const KEY = 'cg-found-';
const seenOf = (month: string) => { try { return Number(localStorage.getItem(KEY + month) ?? 0); } catch { return 0; } };
const setSeen = (month: string, n: number) => { try { localStorage.setItem(KEY + month, String(n)); } catch { /* private mode */ } };

export function Discoveries({ painting, restored, month, calm }: { painting: Painting; restored: number; month: string; calm?: boolean }) {
  const list = discoveriesOf(painting.id);
  const opened = list.filter((_, i) => restored >= AT[i]).length;
  const [open, setOpen] = useState<{ d: Discovery; i: number; fresh: boolean } | null>(null);
  // A discovery found since last time opens by itself, once.
  useEffect(() => {
    if (!list.length) return;
    const seen = seenOf(month);
    if (opened > seen) {
      setSeen(month, opened);
      // Only one at a time, as it happens; a month that arrives already restored doesn't pop them all.
      if (opened - seen === 1) { const i = opened - 1; const t = setTimeout(() => setOpen({ d: list[i], i, fresh: true }), calm ? 300 : 2600); return () => clearTimeout(t); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, month]);
  if (!list.length) return null;
  return (
    <section className="disc" aria-label="Discoveries">
      <div className="td-h"><h2>Dis<i>coveries</i></h2><span>{opened} of {list.length} found</span></div>
      <div className="disc-row">
        {list.map((d, i) => {
          const on = i < opened;
          return (
            <button key={i} className={'disc-lens' + (on ? ' on' : '')} disabled={!on} onClick={() => setOpen({ d, i, fresh: false })}
              aria-label={on ? `Discovery: ${d.title}` : `Found at ${AT[i]} cleaned patches`}>
              <span className="disc-glass" style={on ? { backgroundImage: `url(${artSrc(painting.id, 'md')})`, backgroundSize: `${d.zoom * 100}% auto`, backgroundPosition: `${aim(d.x, d.zoom)}% ${aim(d.y, d.zoom)}%` } : undefined}>
                {!on && <span className="disc-lock">{AT[i]}</span>}
              </span>
              <span className="disc-t">{on ? d.title : `At ${AT[i]} patches`}</span>
            </button>
          );
        })}
      </div>
      {createPortal(<AnimatePresence>{open && <Lens key={open.i} painting={painting} d={open.d} fresh={open.fresh} calm={calm} onClose={() => setOpen(null)} />}</AnimatePresence>, document.body)}
    </section>
  );
}

function Lens({ painting, d, fresh, calm, onClose }: { painting: Painting; d: Discovery; fresh: boolean; calm?: boolean; onClose: () => void }) {
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
