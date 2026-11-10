import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cat } from '../lib/categories';
import { chapterOf, computeStats, momentsOf, paceOf, projection, ROMAN, tipsOf } from '../lib/analytics';
import { paintingOf, PAINTINGS } from '../lib/art';
import { money, monthLabel } from '../lib/format';
import type { State } from '../lib/types';
import type { MuseChapter } from '../lib/muse-story';
import { Icon } from '../components/Icons';
import { LivingArt } from '../components/LivingArt';

const BONE = '#F6EEDC';
const DUR = 7500;
const ease = [0.2, 0.8, 0.2, 1] as const;

/** The month as an illustrated book: one painting to a page, read like a short film. */
export function Edition({ state, muse, close }: { state: State; muse: MuseChapter | null; close: () => void }) {
  const cur = state.profile.currency;
  const calm = state.settings.calm;
  const s = useMemo(() => computeStats(state.entries, state.month), [state]);
  const ch = chapterOf(state, s);
  const title = muse?.title ?? ch.title;
  const lede = muse?.lede ?? ch.lede;
  const moments = momentsOf(state, s);
  const top = s.byCat.filter((c) => c.id !== 'savings').slice(0, 6);
  const pj = projection(s);
  const mon = monthLabel(state.month).split(' ')[0];
  const flex = s.byCat.find((c) => cat(c.id).nature === 'want');
  const couldMonthly = flex ? flex.total * paceOf(s) * 0.3 : 0;
  const painting = paintingOf(s);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides: { name: string; art: string; render: () => ReactNode }[] = [
    { name: 'Cover', art: 'hunters', render: () => (
      <div className="ed-cover">
        <div>
          <K>{state.profile.name ? `${state.profile.name}'s` : 'Your'} money, Chapter {ch.numeral}</K>
          <div style={{ font: '330 clamp(56px, 7.4vw, 118px)/0.88 var(--serif)', letterSpacing: '-0.05em', marginTop: 22 }}>The {mon}<br /><em>Edition</em></div>
          <p style={{ font: '400 22px/1.4 var(--serif)', color: 'rgba(246,238,220,.78)', maxWidth: 520, marginTop: 28 }}>{title.map((x) => x.t).join('')} {s.entries.length} entries, {s.daysLogged} days written.</p>
        </div>
        <Book painting={painting.id} title={`The ${mon} Edition`} calm={calm} />
      </div>
    ) },
    { name: 'Came in', art: 'harvesters', render: () => (
      <div>
        <K>II. What came in</K>
        <Big color="#BFE3B4">{money(s.inflow, cur, { compact: s.inflow >= 1e7 })}</Big>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 34 }}>
          {s.inByCat.length ? s.inByCat.map((c, j) => (
            <motion.span key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + j * 0.1 }} className="ed-chip">
              {cat(c.id).name} <span style={{ opacity: 0.6 }} className="num">{money(c.total, cur, { compact: true })}</span>
            </motion.span>
          )) : <p style={{ font: '400 22px var(--serif)', opacity: 0.7 }}>No income written this month.</p>}
        </div>
        <Credit id="harvesters" />
      </div>
    ) },
    { name: 'Went out', art: 'carnival', render: () => (
      <div>
        <K>III. What went out</K>
        <Big>{money(s.spend, cur, { compact: s.spend >= 1e7 })}</Big>
        <div className="ed-panel" style={{ display: 'grid', gap: 10, marginTop: 30, maxWidth: 760 }}>
          {top.map((c, j) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 150px) 1fr 80px', gap: 14, alignItems: 'center', font: '500 14px var(--grot)' }}>
              <span>{cat(c.id).name}</span>
              <div style={{ height: 18, borderRadius: 4, background: 'rgba(246,238,220,.1)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(c.total / top[0].total) * 100}%` }} transition={{ delay: 0.3 + j * 0.1, duration: 0.9, ease }} style={{ height: '100%', background: cat(c.id).color, borderRadius: 4 }} />
              </div>
              <span className="num" style={{ textAlign: 'right', opacity: 0.75 }}>{money(c.total, cur, { compact: true })}</span>
            </div>
          ))}
        </div>
        <Credit id="carnival" />
      </div>
    ) },
    { name: 'Character', art: painting.id, render: () => (
      <div>
        <K>IV. This month you were</K>
        <div style={{ font: '330 clamp(56px, 8vw, 124px)/0.92 var(--serif)', letterSpacing: '-0.045em', marginTop: 20 }}>{ch.character.name}</div>
        <p style={{ font: '400 24px/1.4 var(--serif)', color: 'rgba(246,238,220,.8)', marginTop: 22, maxWidth: 520 }}>{ch.character.line}</p>
        <p style={{ font: 'italic 400 17px/1.4 var(--serif)', color: 'var(--gold-2)', marginTop: 18, maxWidth: 520 }}>{painting.why}</p>
        <Credit id={painting.id} />
      </div>
    ) },
    { name: 'Moments', art: 'wedding', render: () => (
      <div>
        <K>V. Moments</K>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 30 }}>
          {moments.map((m, j) => (
            <motion.div key={m.kicker} className="ed-panel" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + j * 0.12, duration: 0.7, ease }}
              style={{ minHeight: 220, display: 'flex', flexDirection: 'column' }}>
              <div style={{ font: 'italic 400 15px var(--serif)', color: 'var(--gold-2)' }}>{m.kicker}</div>
              <div style={{ font: '360 36px/1 var(--serif)', letterSpacing: '-0.03em', marginTop: 14 }}>{m.big}</div>
              <div style={{ font: '400 14px/1.45 var(--grot)', marginTop: 'auto', paddingTop: 14, opacity: 0.78 }}>{m.line}</div>
            </motion.div>
          ))}
        </div>
        <Credit id="wedding" />
      </div>
    ) },
    { name: 'Could be', art: 'babel', render: () => (
      <div>
        <K>VI. What could be</K>
        <p style={{ font: '360 clamp(36px, 5vw, 72px)/1.08 var(--serif)', letterSpacing: '-0.035em', marginTop: 24, maxWidth: 980 }}>
          {flex ? <>Spend a third less on <em>{cat(flex.id).name.toLowerCase()}</em> and a year from now you'd have <span className="num" style={{ color: 'var(--gold-2)', fontStyle: 'italic' }}>{money(couldMonthly * 12, cur, { compact: true })}</span> more.</>
            : <>Keep going like this and you'll have <em style={{ color: 'var(--gold-2)' }}>{money(Math.max(0, s.inflow - pj.projectedSpend) * 12, cur, { compact: true })}</em> more in a year.</>}
        </p>
        <p style={{ font: 'italic 400 17px var(--serif)', color: 'rgba(246,238,220,.7)', marginTop: 20 }}>Built one level at a time.</p>
        <Credit id="babel" />
      </div>
    ) },
    { name: 'Next', art: 'athens', render: () => (
      <div>
        <K>VII. For next month</K>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 40, alignItems: 'end', marginTop: 20 }}>
          <div style={{ display: 'grid', gap: 20 }}>
            {tipsOf(s).map((t, j) => (
              <motion.div key={j} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + j * 0.15 }} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', borderTop: '1px solid rgba(246,238,220,.25)', paddingTop: 14 }}>
                <span style={{ font: 'italic 400 26px var(--serif)', color: 'var(--gold-2)' }}>{['i.', 'ii.', 'iii.'][j]}</span>
                <span style={{ font: '400 23px/1.35 var(--serif)' }}>{t}</span>
              </motion.div>
            ))}
          </div>
          <div style={{ textAlign: 'right' }} className="hide-sm">
            <div style={{ font: '330 140px/0.8 var(--serif)', letterSpacing: '-0.05em' }} className="num">{s.harmony}</div>
            <div style={{ font: '500 13px var(--grot)', opacity: 0.7, marginTop: 12 }}>Balance, out of 100</div>
          </div>
        </div>
        <p style={{ font: '400 18px/1.45 var(--serif)', color: 'rgba(246,238,220,.72)', marginTop: 36, maxWidth: 640 }}>{lede}</p>
        <Credit id="athens" />
      </div>
    ) },
  ];

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => (i < slides.length - 1 ? setI(i + 1) : setPaused(true)), DUR);
    return () => clearTimeout(t);
  }, [i, paused, slides.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setI((x) => Math.min(slides.length - 1, x + 1)); }
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [close, slides.length]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="edition"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0E0A06', color: BONE, overflow: 'hidden' }}>
      {/* The painting behind each page, crossfading as the pages turn */}
      <AnimatePresence initial={false}>
        <motion.div key={slides[i].art + i} style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease }}>
          <LivingArt id={slides[i].art} dust light calm={calm} style={{ position: 'absolute', inset: 0 }}
            shade="linear-gradient(90deg, rgba(14,10,6,.9) 0%, rgba(14,10,6,.7) 42%, rgba(14,10,6,.25) 75%, rgba(14,10,6,.45) 100%), linear-gradient(rgba(14,10,6,.5), transparent 25%, transparent 70%, rgba(14,10,6,.7))" />
        </motion.div>
      </AnimatePresence>

      <div style={{ position: 'relative', height: '100%', display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr' }} className="ed-grid">
        <aside className="drag hide-sm" style={{ padding: '64px 26px 26px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(246,238,220,.14)' }}>
          <div style={{ font: 'italic 400 15px var(--serif)', color: 'var(--gold-2)' }}>Contents</div>
          <div style={{ marginTop: 16, display: 'grid', gap: 2 }} className="nodrag">
            {slides.map((sl, j) => (
              <button key={sl.name} onClick={() => setI(j)} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '6px 0', font: '500 14px var(--grot)', color: j === i ? BONE : 'rgba(246,238,220,.45)', transition: 'color .2s', textAlign: 'left' }}>
                <span>{sl.name}</span><span style={{ flex: 1, borderBottom: '1px dotted currentColor', opacity: 0.5, transform: 'translateY(-4px)' }} /><span style={{ font: 'italic 400 13px var(--serif)' }}>{ROMAN[j]}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 'auto', font: '400 13px/1.4 var(--serif)', opacity: 0.55 }}>{monthLabel(state.month)}<br />{state.profile.name || 'Your'} edition</div>
        </aside>

        <main style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="drag" style={{ display: 'flex', gap: 6, padding: '22px 28px 0', alignItems: 'center' }}>
            {slides.map((_, j) => (
              <div key={j} style={{ flex: 1, height: 2, borderRadius: 1, background: 'rgba(246,238,220,.2)', overflow: 'hidden' }}>
                <motion.div key={`${j}-${i}-${paused}`} initial={{ width: j < i ? '100%' : '0%' }} animate={{ width: j < i ? '100%' : j === i ? (paused ? undefined : '100%') : '0%' }} transition={{ duration: j === i && !paused ? DUR / 1000 : 0, ease: 'linear' }} style={{ height: '100%', background: 'var(--gold-2)' }} />
              </div>
            ))}
            <button className="nodrag" onClick={close} aria-label="Close" style={{ marginLeft: 14, width: 30, height: 30, borderRadius: 15, display: 'grid', placeItems: 'center', background: 'rgba(246,238,220,.12)', color: BONE }}><Icon.close size={14} /></button>
          </div>
          <div style={{ flex: 1, position: 'relative', padding: 'clamp(28px, 6vw, 80px)', display: 'flex', alignItems: 'center' }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if ((e.target as HTMLElement).closest('button')) return; setI((x) => (e.clientX - r.left < r.width / 3 ? Math.max(0, x - 1) : Math.min(slides.length - 1, x + 1))); }}>
            <AnimatePresence mode="wait">
              <motion.div key={i} style={{ width: '100%', position: 'relative' }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6, ease }}>
                {slides[i].render()}
              </motion.div>
            </AnimatePresence>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 28px 22px', font: '500 12px var(--grot)', opacity: 0.55 }}>
            <span style={{ font: 'italic 400 14px var(--serif)' }}>{ROMAN[i]} of {ROMAN[slides.length - 1]}</span>
            <span className="hide-sm">Arrow keys to turn the page. Esc to close.</span>
          </div>
        </main>
      </div>
    </motion.div>
  );
}

/** A bound book whose cover swings open to show the month's painting. */
function Book({ painting, title, calm }: { painting: string; title: string; calm: boolean }) {
  return (
    <div className="book hide-sm" aria-hidden>
      <div className="book-page"><LivingArt id={painting} calm={calm} drift={false} grain style={{ position: 'absolute', inset: 14, borderRadius: 2 }} /></div>
      <motion.div className="book-cover" initial={{ rotateY: 0 }} animate={{ rotateY: -150 }} transition={{ delay: 0.9, duration: 1.8, ease: [0.6, 0, 0.2, 1] }}>
        <div className="book-front">
          <svg viewBox="-140 -170 280 300" width="64" height="70" fill="#E2C27A" style={{ opacity: 0.9 }}>
            <path d="M0 -150 C 30 -118 40 -64 18 -8 L -18 -8 C -40 -64 -30 -118 0 -150 Z" />
            <path d="M16 -4 C 48 -40 104 -58 122 -20 C 134 6 112 34 88 24 C 104 6 94 -16 72 -10 C 52 -4 38 14 26 30 Z" />
            <path d="M-16 -4 C -48 -40 -104 -58 -122 -20 C -134 6 -112 34 -88 24 C -104 6 -94 -16 -72 -10 C -52 -4 -38 14 -26 30 Z" />
            <rect x="-58" y="22" width="116" height="26" rx="9" />
            <path d="M-10 46 L10 46 L6 112 L-6 112 Z" />
          </svg>
          <div style={{ font: 'italic 400 20px/1.1 var(--serif)', color: '#E2C27A', marginTop: 18, textAlign: 'center' }}>{title}</div>
        </div>
        <div className="book-back" />
      </motion.div>
    </div>
  );
}

function Credit({ id }: { id: string }) {
  const p = PAINTINGS[id];
  if (!p) return null;
  return <div className="ed-credit"><em>{p.title}</em>, {p.artist}, {p.year}</div>;
}

const K = ({ children }: { children: ReactNode }) => <div style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold-2)' }}>{children}</div>;
const Big = ({ children, color }: { children: ReactNode; color?: string }) => (
  <motion.div className="num" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.8, ease }} style={{ font: '330 clamp(72px, 12vw, 180px)/0.86 var(--serif)', letterSpacing: '-0.05em', marginTop: 18, color }}>{children}</motion.div>
);
