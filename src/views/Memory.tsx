import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { Runway } from '../components/Runway';
import { CATEGORIES, cat } from '../lib/categories';
import { ex, money } from '../lib/format';
import {
  DAY_LETTERS, affordability, balanceNow, daysLeftToRestore, describeMemory, forgotten, live, nextIncome, ordinal, readMemory,
  relDay, rhythmOf, routineRecord, routinesOf,
} from '../lib/memory';
import { findAmounts } from '../lib/parser';
import type { Action } from '../lib/store';
import type { Memory, MemoryKind, State } from '../lib/types';

const KINDS: { id: MemoryKind; name: string }[] = [
  { id: 'routine', name: 'Routine' }, { id: 'balance', name: 'Balance' }, { id: 'income', name: 'Pay day' }, { id: 'note', name: 'Note' },
];
const EXAMPLES = (cur: string) => [`I spend ${ex(12, cur)} on the train every weekday`, `I have ${ex(1800, cur)} in my account`, `I get paid ${ex(3200, cur)} on the 28th`, `Rent ${ex(1400, cur)} on the 1st`, 'I’m saving for a laptop'];

/** The commonplace book: what CashGlome knows about your days, so it can write the usual things for you
 *  and tell you what you can really afford. Everything can be changed, forgotten, and brought back. */
export function MemoryView({ state, dispatch, notify }: { state: State; dispatch: (a: Action) => void; notify: (text: string, undo?: () => void) => void }) {
  const cur = state.profile.currency;
  const [line, setLine] = useState('');
  const [draft, setDraft] = useState<Memory | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [think, setThink] = useState('');
  const items = live(state);
  const gone = forgotten(state);
  const bal = balanceNow(state);
  const pay = nextIncome(state);
  const amount = findAmounts(think)[0]?.value ?? 0;
  const what = think.replace(/(?:[₦$£€]\s?)?\d[\d,.]*\s*(?:k|m)?(?![a-z])/gi, '').replace(/\b(a|an|the|for|on)\b/gi, ' ').replace(/\s+/g, ' ').trim() || 'it';
  const plan = useMemo(() => affordability(state, amount, what), [state, amount, what]);

  const read = (t = line) => { if (!t.trim()) return; setDraft(readMemory(t)); setLine(''); };
  const save = (m: Memory) => { dispatch({ type: 'remember', memory: m }); setDraft(null); setEditing(null); };
  const forget = (m: Memory) => { dispatch({ type: 'forget', id: m.id }); notify(`Forgot “${m.label ?? m.text}”. It can be restored for ${30} days.`, () => dispatch({ type: 'restoreMemory', id: m.id })); };

  const groups: { title: JSX.Element; note: string; list: Memory[] }[] = [
    { title: <>Your <em>routines</em></>, note: 'Each one is written down for you, or checked with one tap, on the days it happens.', list: routinesOf(state) },
    { title: <>What's <em>true now</em></>, note: 'Your balance and pay day. Today’s money is the balance plus everything written since.', list: items.filter((m) => m.kind === 'balance' || m.kind === 'income') },
    { title: <>Notes for <em>Florin</em></>, note: 'Anything else worth knowing when you ask about your money.', list: items.filter((m) => m.kind === 'note' || (m.kind === 'routine' && !routinesOf(state).includes(m))) },
  ];

  return (
    <div className="page memory">
      <div className="kicker">Memory</div>
      <h1 className="display" style={{ marginTop: 24, fontSize: 'clamp(46px, 5.4vw, 88px)' }}>The <em>commonplace</em> book.</h1>
      <p className="lede" style={{ marginTop: 24 }}>
        Tell CashGlome how your days go: the fare to work, the rent, what's in the bank, when you're paid. It writes the usual things down for you and answers “can I afford it?” with the days ahead in mind.
      </p>

      <form className="mem-add card" onSubmit={(e) => { e.preventDefault(); read(); }}>
        <span className="mem-quill" aria-hidden>❦</span>
        <input className="field mem-input" value={line} onChange={(e) => setLine(e.target.value)} placeholder="Tell me something to remember…" aria-label="Something to remember" />
        <button className="btn primary" disabled={!line.trim()}>Remember</button>
      </form>
      {!draft && (
        <div className="mem-examples">
          {EXAMPLES(cur).map((x) => <button key={x} className="ask-chip" onClick={() => read(x)}>{x}</button>)}
        </div>
      )}
      <AnimatePresence>
        {draft && (
          <motion.div key={draft.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} style={{ marginTop: 16 }}>
            <Editor m={draft} cur={cur} onSave={save} onCancel={() => setDraft(null)} heading="Here's how I read that. Change anything, then keep it." />
          </motion.div>
        )}
      </AnimatePresence>

      {bal && plan && (
        <section className="section">
          <div className="section-head">
            <h2 className="h2">The purse, <em>until {pay ? 'payday' : 'next week'}</em></h2>
            <p className="body-serif">{bal.changes ? `${money(bal.stated, cur)} in your ${bal.label.toLowerCase()} when you said so, moved on by ${bal.changes} ${bal.changes === 1 ? 'entry' : 'entries'} since.` : `From the ${money(bal.stated, cur)} you said is in your ${bal.label.toLowerCase()}.`}{pay ? ` ${pay.label} arrives ${relDay(pay.date)}.` : ''}</p>
          </div>
          <div className="card mem-purse">
            <Runway a={plan} cur={cur} />
            <div className="mem-think">
              <input className="field" value={think} onChange={(e) => setThink(e.target.value)} placeholder={`Thinking of buying… e.g. headphones ${ex(80, cur)}`} aria-label="Something you're thinking of buying" />
              <p className={'mem-verdict ' + (amount ? plan.verdict : '')}>{plan.text}</p>
            </div>
          </div>
        </section>
      )}

      {groups.map((g, gi) => (
        <section className="section" key={gi}>
          <div className="section-head">
            <h2 className="h2">{g.title}</h2>
            <p className="body-serif">{g.note}</p>
          </div>
          {g.list.length ? (
            <div className="mem-grid">
              <AnimatePresence>
                {g.list.map((m) => (
                  <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
                    {editing === m.id
                      ? <Editor m={m} cur={cur} onSave={save} onCancel={() => setEditing(null)} />
                      : <Card m={m} state={state} cur={cur} onEdit={() => setEditing(m.id)} onForget={() => forget(m)} onRevert={(at) => dispatch({ type: 'revertMemory', id: m.id, at })} />}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : <p className="body-serif mem-empty">{gi === 0 ? `Nothing yet. Try “I spend ${ex(12, cur)} on the train every weekday”.` : gi === 1 ? `Try “I have ${ex(1800, cur)} in my account” and “I get paid on the 28th”.` : 'Nothing yet.'}</p>}
        </section>
      ))}

      {gone.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="h2">Recently <em>forgotten</em></h2>
            <p className="body-serif">Kept for 30 days in case you want them back, then gone for good.</p>
          </div>
          <ul className="mem-gone">
            {gone.map((m) => (
              <li key={m.id}>
                <span className="mem-gone-text">{describeMemory(m, cur)}</span>
                <span className="small">{daysLeftToRestore(m)} days left</span>
                <button className="btn" onClick={() => dispatch({ type: 'restoreMemory', id: m.id })}><Icon.undo size={14} /> Restore</button>
                <button className="tbtn" aria-label="Forget for good" title="Forget for good" onClick={() => dispatch({ type: 'purgeMemory', id: m.id })}><Icon.trash size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Card({ m, state, cur, onEdit, onForget, onRevert }: { m: Memory; state: State; cur: string; onEdit: () => void; onForget: () => void; onRevert: (at: number) => void }) {
  const rec = m.kind === 'routine' ? routineRecord(state, m) : null;
  const c = m.category ? cat(m.category) : null;
  return (
    <div className={'card mem-card ' + m.kind}>
      <div className="mem-card-top">
        <span className="kicker">{KINDS.find((k) => k.id === m.kind)?.name}</span>
        {c && <span className="mem-cat"><i style={{ background: c.color }} />{c.short}</span>}
      </div>
      {m.kind === 'note'
        ? <p className="mem-note">“{m.text}”</p>
        : <>
          <div className="h3 mem-title">{m.label}</div>
          <div className="stat-num num mem-amt" style={{ color: m.dir === 'in' || m.kind === 'income' ? 'var(--green)' : undefined }}>{m.kind === 'routine' ? (m.dir === 'in' ? '+' : '−') : ''}{money(m.amount ?? 0, cur)}</div>
          <div className="body-serif mem-when">
            {m.kind === 'routine' && <>{rhythmOf(m).replace(/^./, (x) => x.toUpperCase())}. {m.mode === 'auto' ? `Written down for you at ${m.time}.` : `I'll ask at ${m.time}.`}</>}
            {m.kind === 'income' && <>On the {ordinal(m.payDay ?? 28)} of each month.</>}
            {m.kind === 'balance' && <>As of {new Date(m.asOf ?? m.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}.</>}
          </div>
          {m.kind === 'routine' && !m.monthDay && <div className="mem-days" aria-label="Days">{DAY_LETTERS.map((d, i) => <span key={i} className={m.days?.includes(i) ? 'on' : ''}>{d}</span>)}</div>}
          {rec && (rec.done + rec.skipped > 0) && <div className="small mem-rec">This month: {rec.done} written{rec.skipped ? `, ${rec.skipped} skipped` : ''}.</div>}
        </>}
      <div className="mem-actions">
        <button className="btn" onClick={onEdit}>Edit</button>
        {m.history?.length ? (
          <details className="mem-hist">
            <summary className="btn">Earlier ({m.history.length})</summary>
            <ul>
              {m.history.map((h) => (
                <li key={h.at}>
                  <span>{describeMemory({ ...m, ...h.was } as Memory, cur)}{h.was.kind === 'routine' ? ` · ${h.was.mode === 'auto' ? 'writes' : 'asks'} at ${h.was.time}` : ''}</span>
                  <span className="small">{new Date(h.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <button className="tbtn" onClick={() => onRevert(h.at)}>Use this</button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <button className="tbtn" style={{ marginLeft: 'auto' }} onClick={onForget} aria-label="Forget" title="Forget"><Icon.trash size={14} /></button>
      </div>
    </div>
  );
}

function Editor({ m: start, cur, onSave, onCancel, heading }: { m: Memory; cur: string; onSave: (m: Memory) => void; onCancel: () => void; heading?: string }) {
  const [m, setM] = useState<Memory>(start);
  const [amt, setAmt] = useState(start.amount ? String(start.amount) : '');
  const set = (p: Partial<Memory>) => setM((x) => ({ ...x, ...p }));
  const value = findAmounts(amt)[0]?.value ?? (Number(amt) || 0);
  const monthly = !!m.monthDay;
  const ok = m.kind === 'note' ? !!m.text.trim() : value > 0 && (m.kind !== 'routine' || monthly || !!m.days?.length);
  const keep = () => {
    const out: Memory = { ...m, amount: m.kind === 'note' ? undefined : value };
    if (m.kind === 'balance' && (value !== start.amount || start.kind !== 'balance')) out.asOf = Date.now();
    if (m.kind === 'routine' && !m.time) out.time = '19:00';
    if (m.kind === 'routine' && !m.mode) out.mode = 'ask';
    if (m.kind === 'routine' && !m.dir) out.dir = 'out';
    if (m.kind === 'routine' && !m.since) out.since = new Date().toISOString().slice(0, 10);
    if (m.kind === 'income') { out.dir = 'in'; out.payDay = out.payDay ?? 28; }
    if (!out.label && m.kind !== 'note') out.label = m.kind === 'balance' ? 'Bank' : m.kind === 'income' ? 'Pay' : 'Routine';
    onSave(out);
  };
  const cats = CATEGORIES.filter((c) => c.dir === (m.dir ?? 'out'));

  return (
    <div className="card mem-editor">
      {heading && <div className="small" style={{ marginBottom: 12 }}>{heading}</div>}
      <div className="seg mem-kinds" role="radiogroup" aria-label="Kind">
        {KINDS.map((k) => <button key={k.id} role="radio" aria-checked={m.kind === k.id} className={m.kind === k.id ? 'on' : ''} onClick={() => set({ kind: k.id })}>{k.name}</button>)}
      </div>
      {m.kind === 'note' ? (
        <textarea className="field mem-text" rows={3} value={m.text} onChange={(e) => set({ text: e.target.value })} placeholder="Anything Florin should know" />
      ) : (
        <div className="mem-fields">
          <div className="mem-f"><span className="label">{m.kind === 'balance' ? 'Where' : 'Name'}</span><input className="field" value={m.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder={m.kind === 'balance' ? 'Bank' : m.kind === 'income' ? 'Salary' : 'Transport to work'} /></div>
          <div className="mem-f"><span className="label">Amount</span><input className="field num" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={ex(12, cur)} /></div>
          {m.kind === 'routine' && <>
            <div className="mem-f"><span className="label">Money</span>
              <div className="seg"><button className={m.dir !== 'in' ? 'on' : ''} onClick={() => set({ dir: 'out', category: 'other' })}>Goes out</button><button className={m.dir === 'in' ? 'on' : ''} onClick={() => set({ dir: 'in', category: 'windfall' })}>Comes in</button></div>
            </div>
            <div className="mem-f"><span className="label">Category</span>
              <select className="field" value={m.category ?? cats[0]?.id} onChange={(e) => set({ category: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="mem-f wide"><span className="label">When</span>
              <div className="mem-when-row">
                <div className="seg"><button className={!monthly ? 'on' : ''} onClick={() => set({ monthDay: undefined, days: m.days?.length ? m.days : [1, 2, 3, 4, 5] })}>Weekly</button><button className={monthly ? 'on' : ''} onClick={() => set({ monthDay: m.monthDay ?? 1, days: [] })}>Monthly</button></div>
                {monthly
                  ? <span className="mem-dom">on the <input className="field num" type="number" min={1} max={31} value={m.monthDay} onChange={(e) => set({ monthDay: Math.max(1, Math.min(31, +e.target.value || 1)) })} /></span>
                  : <div className="mem-days edit">{DAY_LETTERS.map((d, i) => <button key={i} className={m.days?.includes(i) ? 'on' : ''} aria-pressed={!!m.days?.includes(i)} onClick={() => set({ days: m.days?.includes(i) ? m.days.filter((x) => x !== i) : [...(m.days ?? []), i].sort() })}>{d}</button>)}</div>}
              </div>
            </div>
            <div className="mem-f"><span className="label">At</span><input className="field" type="time" value={m.time ?? '19:00'} onChange={(e) => set({ time: e.target.value || '19:00' })} /></div>
            <div className="mem-f"><span className="label">Then</span>
              <div className="seg"><button className={m.mode !== 'auto' ? 'on' : ''} onClick={() => set({ mode: 'ask' })}>Ask me</button><button className={m.mode === 'auto' ? 'on' : ''} onClick={() => set({ mode: 'auto' })}>Write it for me</button></div>
            </div>
          </>}
          {m.kind === 'income' && <div className="mem-f"><span className="label">Day of the month</span><input className="field num" type="number" min={1} max={31} value={m.payDay ?? 28} onChange={(e) => set({ payDay: Math.max(1, Math.min(31, +e.target.value || 28)) })} /></div>}
          <div className="mem-f wide"><span className="label">In your words</span><input className="field" value={m.text} onChange={(e) => set({ text: e.target.value })} /></div>
        </div>
      )}
      {m.kind === 'routine' && <p className="small mem-hint">{m.mode === 'auto' ? 'On those days it is written down at that time, and you can undo it.' : 'On those days you get a notification at that time: one tap writes it down, or say it didn’t happen.'}</p>}
      <div className="mem-actions">
        <button className="btn primary" disabled={!ok} onClick={keep}><Icon.check size={14} /> Keep</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
