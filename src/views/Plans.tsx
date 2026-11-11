import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { computeStats, goalEta, projection, tipsOf } from '../lib/analytics';
import { aiEnabled } from '../lib/ai';
import { findAmounts } from '../lib/parser';
import { localAsk, museAsk } from '../lib/muse-story';
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
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<{ q: string; a: string; by: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const ai = aiEnabled(state.settings);

  const addGoal = () => {
    const amt = findAmounts(amount)[0]?.value ?? Number(amount);
    if (!name.trim() || !amt) return;
    dispatch({ type: 'goal', goal: { id: uid(), name: name.trim(), amount: amt, emoji: sticker } });
    setName(''); setAmount('');
  };
  const ask = async () => {
    const question = q.trim(); if (!question || asking) return;
    setAsking(true);
    try {
      const a = ai ? await museAsk(state, question).catch(() => localAsk(state, question)) : localAsk(state, question);
      setAnswer({ q: question, a, by: ai ? 'Meta Muse' : 'CashGlome, on this device' });
    } finally { setAsking(false); setQ(''); }
  };

  return (
    <div className="page">
      <div className="kicker">Plans</div>
      <h1 className="display" style={{ marginTop: 24, fontSize: 'clamp(48px, 5.6vw, 92px)' }}>The next <em>chapter</em>.</h1>
      <p className="lede" style={{ marginTop: 24 }}>
        {s.inflow ? <>At your current pace you'll keep about <b style={{ fontWeight: 500, color: 'var(--ink)' }}>{money(Math.max(0, s.inflow - pj.projectedSpend), cur)}</b> this month. Here's what that could turn into.</> : <>Write down what comes in, and this page will show you what it could turn into.</>}
      </p>

      {s.inflow > 0 && s.byCat.length > 0 && <div style={{ marginTop: 56 }}><WhatIf state={state} s={s} /></div>}

      {/* Goals */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Things you're <em>saving for</em></h2>
          <p className="body-serif">Each goal's date comes from what you've actually been keeping, not from a guess.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          <AnimatePresence>
            {state.goals.map((g, i) => {
              const eta = goalEta(g, monthlySave);
              const when = Number.isFinite(eta) ? new Date(new Date().getFullYear(), new Date().getMonth() + eta, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
              return (
                <motion.div key={g.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="card" style={{ padding: 22, position: 'relative', minHeight: 220, display: 'flex', flexDirection: 'column', rotate: i % 2 ? 0.8 : -0.8 }}>
                  <Sticker name={GOAL_STICKERS.includes(g.emoji) ? g.emoji : 'star'} size={74} rotate={10} style={{ position: 'absolute', right: -12, top: -18 }} />
                  <div className="kicker">Goal</div>
                  <div className="h3" style={{ marginTop: 12, maxWidth: '78%' }}>{g.name}</div>
                  <div className="stat-num num" style={{ marginTop: 10, fontSize: 26 }}>{money(g.amount, cur)}</div>
                  <div className="body-serif" style={{ fontSize: 15, marginTop: 'auto', paddingTop: 14 }}>
                    {when ? <>About <b style={{ fontWeight: 500, color: 'var(--ink)' }}>{eta} {eta === 1 ? 'month' : 'months'}</b> away, around {when}, at {money(monthlySave, cur, { compact: monthlySave >= 1e6 })} a month.</> : 'Write down some income to see when.'}
                  </div>
                  <button className="tbtn" style={{ position: 'absolute', right: 10, bottom: 10 }} onClick={() => dispatch({ type: 'removeGoal', id: g.id })} aria-label="Remove goal"><Icon.trash size={14} /></button>
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

      {/* Ask */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Ask <em>anything</em></h2>
          <p className="body-serif">“Can I afford a {cur === 'NGN' ? '300k' : '900'} phone?” “Where can I cut back?” Answers use your real numbers. {ai ? 'Answered by Meta Muse.' : 'Answered on this device. Connect Meta Muse in Settings for fuller answers.'}</p>
        </div>
        <div className="card" style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="field" style={{ border: 0, height: 44, fontSize: 16, font: '400 19px var(--serif)', background: 'transparent', boxShadow: 'none' }} placeholder="Ask about your money…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button className="send" onClick={ask} disabled={!q.trim() || asking} aria-label="Ask">
            {asking ? <span className="brushing" aria-label="Thinking"><i /><i /><i /></span> : <Icon.up size={18} />}
          </button>
        </div>
        <AnimatePresence mode="wait">
          {answer && (
            <motion.div key={answer.q} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '40px 1fr', gap: 16 }}>
              <span className="avatar" style={{ width: 40, height: 40, background: 'var(--ink)', color: 'var(--paper)', font: 'italic 400 20px var(--serif)' }}>A</span>
              <div>
                <div className="small">You asked “{answer.q}”</div>
                <p style={{ font: '400 22px/1.45 var(--serif)', letterSpacing: '-0.012em', margin: '8px 0 0', maxWidth: 680 }}>{answer.a}</p>
                <div className="small" style={{ marginTop: 10 }}>{answer.by} · General guidance, not financial advice.</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
