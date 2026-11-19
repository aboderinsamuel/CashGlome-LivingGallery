import { motion } from 'framer-motion';
import { useMemo, useRef } from 'react';
import { badgesOf, computeStats } from '../lib/analytics';
import { paintingOf, restorationOf, PATCHES } from '../lib/art';
import { money, monthLabel, monthOf, todayISO } from '../lib/format';
import type { State } from '../lib/types';
import { Sticker } from '../components/Stickers';
import { RestorationPlate } from '../components/Restoration';
import { Photo, usePicture } from '../components/Photo';
import { Icon } from '../components/Icons';
import type { Entry } from '../lib/types';

/** The gallery: one painting per month on a salon wall, and the sticker book. */
export function Collection({ state, onOpen, onCamera, onPlay }: { state: State; onOpen: (month: string) => void; onCamera: () => void; onPlay?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const phone = document.documentElement.dataset.phone !== undefined;
  const calm = state.settings.calm;
  const badges = badgesOf(state);
  const earned = badges.filter((b) => b.done).length;
  const months = useMemo(() => {
    const set = new Set(state.entries.map((e) => monthOf(e.date)));
    set.add(monthOf(todayISO()));
    return [...set].sort().reverse().map((m) => {
      const s = computeStats(state.entries, m);
      return { m, painting: paintingOf(s), r: restorationOf(state.entries, m, state.quiet) };
    });
  }, [state.entries]);
  const done = months.filter((x) => x.r.complete).length;
  const daysWritten = new Set(state.entries.map((e) => e.date)).size;

  return (
    <div className="page" ref={ref}>
      <div>
        <div className="kicker"><span style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold)' }}>The gallery</span></div>
        <h1 className="display" style={{ marginTop: 10 }}>{months.length === 1 ? 'One painting' : `${months.length} paintings`}, <em>yours</em>.</h1>
        <p className="lede" style={{ marginTop: 14 }}>
          {done ? `${done} fully restored. ` : ''}{state.entries.length} {state.entries.length === 1 ? 'line' : 'lines'} written over {daysWritten} {daysWritten === 1 ? 'day' : 'days'}. A finished painting hangs here for good.
        </p>
      </div>

      {/* The salon wall */}
      <section className="section">
        <div className="salon">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
            <h2 className="h2" style={{ color: '#F6EEDC' }}>Your <em>collection</em></h2>
            <span style={{ font: 'italic 400 15px var(--serif)', color: 'rgba(246,238,220,.7)' }}>One painting a month, restored by writing.</span>
          </div>
          <div className="salon-wall">
            {months.map(({ m, painting, r }, i) => (
              <motion.button key={m} onClick={() => onOpen(m)} className="salon-item" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.7 }}
                whileHover={{ y: -4 }} style={{ rotate: i % 3 === 1 ? 0.6 : i % 3 === 2 ? -0.5 : 0 }}>
                <div className="frame"><div className="frame-inner"><RestorationPlate painting={painting} r={r} seen={PATCHES} drift={false} ratio={4 / 5} calm /></div></div>
                <div className="salon-label">
                  <span style={{ font: 'italic 400 15px/1.2 var(--serif)' }}>{painting.title}</span>
                  <span style={{ font: '500 12px var(--grot)', opacity: 0.7 }}>{monthLabel(m)} · {r.complete ? 'Restored' : `${r.restored} of ${PATCHES}`}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* The games moved to Play; the door stays here. */}
      {onPlay && (
        <section className="section">
          <button className="pl-door" onClick={onPlay}>
            <Icon.games size={22} />
            <span><b>Play with your paintings</b><i>Find the details a curator would point out, or put a painting back together.</i></span>
            <span className="pl-cta">Open Play<Icon.right size={14} /></span>
          </button>
        </section>
      )}

      {/* Paintings made from the user's own photos */}
      <StillLifes entries={state.entries} cur={state.profile.currency} onCamera={onCamera} />

      {/* Sticker book */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">The sticker <em>book</em></h2>
          <p className="body-serif">{earned} of {badges.length} collected. Pull an earned sticker off the page and let it go.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {badges.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="card" style={{ padding: 18, minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: b.done ? 'var(--card)' : 'transparent', borderStyle: b.done ? 'solid' : 'dashed' }}>
              <div style={{ height: 116, display: 'grid', placeItems: 'center', position: 'relative' }}>
                {b.done ? <Sticker name={b.sticker} size={100} rotate={i % 2 ? 8 : -8} peel bounds={ref} delay={i * 0.04} />
                  : <div style={{ opacity: 0.16, filter: 'grayscale(1)' }}><Sticker name={b.sticker} size={92} /></div>}
              </div>
              <div className="label" style={{ marginTop: 6 }}>{b.name}</div>
              <div className="small" style={{ marginTop: 4 }}>{b.desc}</div>
              {!b.done && (
                <div style={{ width: '70%', height: 3, borderRadius: 2, background: 'var(--fill-2)', marginTop: 'auto', overflow: 'hidden' }}>
                  <div style={{ width: `${b.progress * 100}%`, height: '100%', background: 'var(--gold)' }} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StillLifes({ entries, cur, onCamera }: { entries: Entry[]; cur: string; onCamera: () => void }) {
  const hung = entries.filter((e) => e.photo).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  return (
    <section className="section">
      <div className="salon still">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
          <h2 className="h2" style={{ color: '#F3ECD8' }}>Your <em>still lifes</em></h2>
          <button className="btn gold" onClick={onCamera}><Icon.camera size={15} /> Paint something</button>
        </div>
        <div className="salon-wall">
          {hung.map((e, i) => <Hung key={e.id} e={e} cur={cur} i={i} />)}
          {!hung.length && (
            <button className="salon-item" onClick={onCamera}>
              <div className="frame empty-frame"><div className="frame-inner"><Icon.camera size={30} /></div></div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Hung({ e, cur, i }: { e: Entry; cur: string; i: number }) {
  const p = usePicture(e.photo);
  return (
    <motion.div className="salon-item" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 8) * 0.06, duration: 0.7 }}
      style={{ rotate: i % 3 === 1 ? 0.5 : i % 3 === 2 ? -0.6 : 0 }}>
      <div className={'artwork' + (p?.kind === 'receipt' ? ' receipt' : '')}><div className="artwork-inner"><Photo id={e.photo} style={{ width: '100%', aspectRatio: p?.kind === 'receipt' ? '3 / 4' : '4 / 5' }} /></div></div>
      <div className="plaque">
        <span style={{ font: 'italic 400 15px/1.2 var(--serif)' }}>{e.label}</span>
        <span className="num" style={{ font: '500 12px var(--grot)', opacity: 0.75 }}>{money(e.amount, cur)} · {new Date(e.date + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
    </motion.div>
  );
}
