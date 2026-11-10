import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { chapterOf, computeStats } from '../lib/analytics';
import { artSrc, paintingOf, restorationOf } from '../lib/art';
import { money, monthLabel, monthOf, todayISO } from '../lib/format';
import type { State } from '../lib/types';

/** Every month as a bound book, its painting set into the cover. */
export function Shelf({ state, months, onOpen }: { state: State; months: string[]; onOpen: (m: string) => void }) {
  const cur = state.profile.currency;
  const books = useMemo(() => months.map((m) => {
    const s = computeStats(state.entries, m);
    return { m, s, ch: chapterOf(state, s), p: paintingOf(s), r: restorationOf(state.entries, m) };
  }), [months, state]);
  const total = books.reduce((a, b) => a + b.s.entries.length, 0);
  return (
    <div className="page">
      <div className="kicker"><span style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold)' }}>All chapters</span></div>
      <h1 className="display" style={{ marginTop: 20, fontSize: 'clamp(48px, 5.6vw, 88px)' }}>Your story <em>so far</em>.</h1>
      <p className="lede" style={{ marginTop: 24 }}>{books.length} {books.length === 1 ? 'chapter' : 'chapters'}, {total} entries. Each month is bound from what you wrote. Open one to read it.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '40px 28px', marginTop: 64 }}>
        {books.map(({ m, s, ch, p, r }, i) => {
          const current = m === monthOf(todayISO());
          const clean = r.restored / 30;
          return (
            <motion.button key={m} onClick={() => onOpen(m)} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6 }}
              whileHover={{ y: -8 }} style={{ textAlign: 'left', cursor: 'pointer', position: 'relative' }}>
              <div className="bound">
                <div style={{ display: 'flex', justifyContent: 'space-between', font: 'italic 400 13px var(--serif)', color: '#E2C27A' }}>
                  <span>Chapter {ch.numeral}</span><span>{current ? 'Being written' : m.slice(0, 4)}</span>
                </div>
                <div className="bound-plate" style={{ backgroundImage: `url(${artSrc(p.id)})`, backgroundPosition: p.focus, filter: `sepia(${(1 - clean) * 0.75}) saturate(${0.55 + clean * 0.5}) brightness(${0.75 + clean * 0.25})` }} />
                <div style={{ font: '360 24px/1.02 var(--serif)', letterSpacing: '-0.025em', color: '#F6EEDC', marginTop: 14 }}>
                  {ch.title.map((x, j) => x.em ? <em key={j}>{x.t}</em> : <span key={j}>{x.t}</span>)}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 12, font: '500 11.5px/1.45 var(--grot)', color: 'rgba(246,238,220,.7)' }}>
                  <div>{monthLabel(m)}</div>
                  <div className="num">{s.entries.length ? `${money(s.spend, cur, { compact: true })} out, ${money(s.inflow, cur, { compact: true })} in` : 'Not written yet'}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', font: '500 12px var(--grot)', color: 'var(--ink-3)' }}>
                <span>{ch.character.name}</span><span className="num">{r.complete ? 'Restored' : `${r.restored} of 30 clean`}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
