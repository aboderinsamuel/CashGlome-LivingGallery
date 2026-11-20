import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { computeStats, goalEta, projection, tipsOf } from '../lib/analytics';
import { findAmounts } from '../lib/parser';
import { money, uid } from '../lib/format';
import type { State } from '../lib/types';
import type { Action } from '../lib/store';
import { Icon } from '../components/Icons';
import { Sticker } from '../components/Stickers';
import { WhatIf } from './WhatIf';

const GOAL_STICKERS = ['plane', 'house', 'phone', 'books', 'gift', 'heart', 'briefcase', 'star'];

export function Plans({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const cur = state.profile.currency;
  const s = useMemo(() => computeStats(state.entries, state.month), [state.entries, state.month]);
  const pj = projection(s);
  const monthlySave = Math.max(s.inflow - pj.projectedSpend, s.inflow * 0.1, 0);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [sticker, setSticker] = useState('plane');

  const addGoal = () => {
    const amt = findAmounts(amount)[0]?.value ?? Number(amount);
    if (!name.trim() || !amt) return;
    dispatch({ type: 'goal', goal: { id: uid(), name: name.trim(), amount: amt, emoji: sticker } });
    setName(''); setAmount('');
  };
  return (
    <div className="page">
      <div className="kicker">Plans</div>
      <h1 className="display" style={{ marginTop: 24, fontSize: 'clamp(48px, 5.6vw, 92px)' }}>The next <em>chapter</em>.</h1>
      <p className="lede" style={{ marginTop: 24 }}>
        {s.inflow ? <>At this pace you’ll keep about <b style={{ fontWeight: 500, color: 'var(--ink)' }}>{money(Math.max(0, s.inflow - pj.projectedSpend), cur)}</b> this month.</> : <>Write down what comes in, and your goals get dates.</>}
      </p>

      {s.inflow > 0 && s.byCat.length > 0 && <div style={{ marginTop: 56 }}><WhatIf state={state} s={s} /></div>}

      {/* Goals */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Things you're <em>saving for</em></h2>
          <p className="body-serif">Dates come from what you’ve actually kept.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          <AnimatePresence>
            {state.goals.map((g) => {
              const eta = goalEta(g, monthlySave);
              const when = Number.isFinite(eta) ? new Date(new Date().getFullYear(), new Date().getMonth() + eta, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
              return (
                <motion.div key={g.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="card" style={{ padding: 22, position: 'relative', minHeight: 220, display: 'flex', flexDirection: 'column' }}>
                  <Sticker name={GOAL_STICKERS.includes(g.emoji) ? g.emoji : 'star'} size={74} rotate={10} style={{ position: 'absolute', right: -12, top: -18 }} />
                  <div className="kicker">Goal</div>
                  <div className="h3" style={{ marginTop: 12, maxWidth: '78%' }}>{g.name}</div>
                  <div className="stat-num num" style={{ marginTop: 10, fontSize: 26 }}>{money(g.amount, cur)}</div>
                  <div className="body-serif" style={{ fontSize: 15, marginTop: 'auto', paddingTop: 14 }}>
                    {when ? <>About <b style={{ fontWeight: 500, color: 'var(--ink)' }}>{eta} {eta === 1 ? 'month' : 'months'}</b> away, around {when}, at {money(monthlySave, cur, { compact: monthlySave >= 1e6 })} a month.</> : 'Write down some income to see when.'}
                  </div>
                  <button className="plan-remove" onClick={() => dispatch({ type: 'removeGoal', id: g.id })} aria-label={`Remove the goal ${g.name}`}><Icon.trash size={13} />Remove</button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div className="card" style={{ padding: 22, display: 'grid', gap: 10, alignContent: 'start', borderStyle: 'dashed' }}>
            <div className="label">New goal</div>
            <input className="field" placeholder="A trip to Lisbon" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="field num" placeholder={cur === 'NGN' ? '1.2m' : '2,400'} value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGoal()} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
              {GOAL_STICKERS.map((x) => (
                <button key={x} onClick={() => setSticker(x)} aria-label={x} style={{ aspectRatio: '1', borderRadius: 8, display: 'grid', placeItems: 'center', background: sticker === x ? 'var(--accent-soft)' : 'transparent', outline: sticker === x ? '1.5px solid var(--accent)' : 'none' }}>
                  <Sticker name={x} size={22} />
                </button>
              ))}
            </div>
            <button className="btn primary" onClick={addGoal} disabled={!name.trim() || !amount.trim()}><Icon.plus size={14} /> Add goal</button>
          </div>
        </div>
      </section>

      {/* Habits */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Three things <em>for next month</em></h2>
          <p className="body-serif">Picked from this month's entries.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {tipsOf(s).map((t, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--ink)', paddingTop: 14 }}>
              <div style={{ font: 'italic 400 34px/1 var(--serif)', color: 'var(--accent)' }}>{['i.', 'ii.', 'iii.'][i]}</div>
              <p className="body-serif" style={{ marginTop: 12, color: 'var(--ink)' }}>{t}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
