import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { cat } from '../lib/categories';
import { computeStats, paceOf, type Stats } from '../lib/analytics';
import { money, shiftMonth } from '../lib/format';
import type { State } from '../lib/types';
import { LivingArt } from '../components/LivingArt';

/** "What could be": a sentence with blanks the person fills in. The maths updates as they type. */
export function WhatIf({ state, s, tone = 'accent' }: { state: State; s: Stats; tone?: 'accent' | 'paper' }) {
  const cur = state.profile.currency;
  const flexible = s.byCat.filter((c) => ['want', 'give'].includes(cat(c.id).nature) || c.id === 'groceries').sort((a, b) => b.count - a.count || b.total - a.total);
  const [catId, setCatId] = useState(flexible[0]?.id ?? 'dining');
  const [cut, setCut] = useState(30);
  const [months, setMonths] = useState(6);
  const prev = useMemo(() => computeStats(state.entries, shiftMonth(s.month, -1)), [state.entries, s.month]);
  // A typical month for this category: frequent spends scale with the days left, one-off bills don't.
  const basis = useMemo(() => {
    const c = s.byCat.find((x) => x.id === catId);
    const now = c?.total ?? 0;
    const scaled = c && c.count >= 3 && !['subscriptions', 'bills', 'rent'].includes(catId) ? now * paceOf(s) : now;
    return Math.max(scaled, prev.byCat.find((x) => x.id === catId)?.total ?? 0);
  }, [s, prev, catId]);
  const monthly = (basis * cut) / 100;
  const total = monthly * months;
  const goal = [...state.goals].sort((a, b) => a.amount - b.amount).find((g) => g.amount >= total * 0.5);
  const yearly = monthly * 12;
  const dark = tone === 'accent';
  const fg = dark ? '#F6EEDC' : 'var(--ink)';

  if (!flexible.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
      style={{ position: 'relative', borderRadius: 28, background: dark ? '#1B2A66' : 'var(--card)', color: fg, padding: 'clamp(28px, 5vw, 56px)', overflow: 'hidden', border: dark ? 0 : '1px solid var(--line)' }}>
      <div className="kicker" style={{ color: dark ? 'rgba(226,194,122,.9)' : undefined }}>What could be</div>
      <p style={{ font: '360 clamp(30px, 3.8vw, 50px)/1.18 var(--serif)', letterSpacing: '-0.028em', margin: '20px 0 0', maxWidth: 820, position: 'relative', zIndex: 2 }}>
        If I spent{' '}
        <Blank dark={dark}>
          <AutoSize text={String(cut)}>
            <input type="number" min={5} max={100} step={5} value={cut} onChange={(e) => setCut(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} style={{ ...fill, textAlign: 'right' }} aria-label="Percent less" />
          </AutoSize>%
        </Blank>{' '}
        less on{' '}
        <Blank dark={dark}>
          <AutoSize text={cat(catId).name.toLowerCase()} italic>
            <select value={catId} onChange={(e) => setCatId(e.target.value)} aria-label="Category" style={{ ...fill, fontStyle: 'italic', cursor: 'pointer' }}>
              {flexible.map((c) => <option key={c.id} value={c.id} style={{ color: '#1A140D', fontStyle: 'normal', fontSize: 14 }}>{cat(c.id).name.toLowerCase()}</option>)}
            </select>
          </AutoSize>
        </Blank>{' '}
        for{' '}
        <Blank dark={dark}>
          <AutoSize text={`${months} months`}>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Months" style={{ ...fill, cursor: 'pointer' }}>
              {[3, 6, 12, 24].map((m) => <option key={m} value={m} style={{ color: '#1A140D', fontSize: 14 }}>{m} months</option>)}
            </select>
          </AutoSize>
        </Blank>, I would have{' '}
        <AnimatePresence mode="wait">
          <motion.span key={Math.round(total)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
            style={{ display: 'inline-block', fontStyle: 'italic', background: dark ? '#E2C27A' : 'var(--accent)', color: dark ? '#1A140D' : '#fff', padding: '0 .22em', borderRadius: 10, transform: 'rotate(-1deg)' }} className="num">
            {money(total, cur, { compact: total >= 1e6 })}
          </motion.span>
        </AnimatePresence>{' '}
        {goal ? <>put aside, {total >= goal.amount ? 'enough' : `${Math.round((total / goal.amount) * 100)}% of the way`} for {goal.name.toLowerCase()}.</> : <>put aside.</>}
      </p>
      <input type="range" min={5} max={100} step={5} value={cut} onChange={(e) => setCut(Number(e.target.value))} aria-label="Adjust the cut"
        style={{ width: 'min(420px, 100%)', marginTop: 32, accentColor: dark ? '#E2C27A' : 'var(--accent)', position: 'relative', zIndex: 2 }} />
      <div style={{ display: 'flex', gap: 28, marginTop: 18, flexWrap: 'wrap', position: 'relative', zIndex: 2, font: '500 13px var(--grot)', opacity: 0.78 }}>
        <span>{money(monthly, cur)} a month</span>
        <span>{money(yearly, cur, { compact: yearly >= 1e6 })} a year</span>
        <span>{cat(catId).name} would still get {money(basis - monthly, cur, { compact: basis >= 1e6 })} a month</span>
      </div>
      {dark && <LivingArt id="babel" calm={state.settings.calm} className="hide-sm" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '46%', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 60%)', maskImage: 'linear-gradient(90deg, transparent, #000 60%)', opacity: 0.85 }} shade="linear-gradient(90deg, #1B2A66 0%, rgba(27,42,102,.35) 60%, rgba(27,42,102,.1))" />}
    </motion.div>
  );
}

function Blank({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', borderBottom: `2px dashed ${dark ? 'rgba(247,247,238,.6)' : 'var(--accent)'}`, padding: '0 .08em', lineHeight: 1.05 }}>
      {children}
    </span>
  );
}

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'textfield', background: 'none', border: 0, outline: 0, font: 'inherit', letterSpacing: 'inherit', color: 'inherit', padding: 0, margin: 0, textIndent: 0 };

/** Sizes a form control to its current text, so blanks read like words in the sentence. */
function AutoSize({ text, italic, children }: { text: string; italic?: boolean; children: React.ReactNode }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span aria-hidden style={{ visibility: 'hidden', whiteSpace: 'pre', fontStyle: italic ? 'italic' : undefined, paddingRight: '0.12em' }}>{text}</span>
      {children}
    </span>
  );
}
