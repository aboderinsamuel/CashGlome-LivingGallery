import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { HELP, SUGGESTED, answerLocally, askMuse, type Answer, type Turn } from '../lib/ask';
import { cat } from '../lib/categories';
import { dayLabel, money } from '../lib/format';
import type { Action } from '../lib/store';
import type { State } from '../lib/types';
import { Icon } from './Icons';

interface Props {
  state: State;
  dispatch: (a: Action) => void;
  aiOn: boolean;
  turns: Turn[];
  setTurns: (f: (t: Turn[]) => Turn[]) => void;
  first: string | null;
  onClose: () => void;
}

/** Ask about your money: answered on this device when it can be counted, by Muse (with your OK) otherwise. */
export function AskPanel({ state, dispatch, aiOn, turns, setTurns, first, onClose }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const cur = state.profile.currency;
  const asked = useRef<string | null>(null);

  const ask = async (q: string, allowMuse = state.settings.askMuse) => {
    q = q.trim();
    if (!q || busy) return;
    setText('');
    const local = answerLocally(state, q);
    if (local) { setTurns((t) => [...t, { q, a: local }]); return; }
    if (!aiOn) { setTurns((t) => [...t, { q, a: HELP }]); return; }
    if (allowMuse === undefined) { setConsent(q); return; }
    if (!allowMuse) { setTurns((t) => [...t, { q, a: HELP }]); return; }
    setBusy(true);
    setTurns((t) => [...t, { q, a: { text: '', by: 'muse' } }]);
    let a: Answer;
    try { a = await askMuse(state, q, turns); } catch (e) { a = { ...HELP, error: (e as Error).message }; }
    setTurns((t) => [...t.slice(0, -1), { q, a }]);
    setBusy(false);
  };

  useEffect(() => { if (first && asked.current !== first) { asked.current = first; ask(first); } }, [first]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns, consent]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const decide = (yes: boolean) => {
    dispatch({ type: 'settings', patch: { askMuse: yes } });
    const q = consent!; setConsent(null);
    ask(q, yes);
  };

  return (
    <motion.div className="scrim ask-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="panel ask" role="dialog" aria-label="Ask about your money"
        initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 520, damping: 38 }}>
        <header className="ask-head">
          <span className="ask-badge"><Icon.ask size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="ask-title">Ask about your money</div>
            <div className="small">Counted from what you've written down.</div>
          </div>
          <button className="panel-x static" onClick={onClose} aria-label="Close"><Icon.close size={13} /></button>
        </header>

        <div className="ask-body">
          {!turns.length && !consent && (
            <div className="ask-try">
              <div className="label">Try one</div>
              <div className="ask-chips">
                {SUGGESTED(cur).map((s) => <button key={s} className="ask-chip" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((t, i) => <TurnView key={i} t={t} cur={cur} />)}
          {consent && (
            <div className="ask-consent">
              <p><b>Muse can answer this one.</b> To do it, the names, amounts, dates and categories of your entries from the last two months, and your monthly totals for six months, are sent to Meta Muse. Photos are never sent.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => decide(true)}>Send to Muse</button>
                <button className="btn" onClick={() => decide(false)}>Keep it on this device</button>
              </div>
              <div className="small" style={{ marginTop: 8 }}>You can change this later in Settings, Meta Muse.</div>
            </div>
          )}
          <div ref={end} />
        </div>

        <form className="ask-input" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={turns.length ? 'Ask something else' : 'How much did I spend on food this month?'} aria-label="Your question" />
          <button className="send" disabled={!text.trim() || busy} aria-label="Ask"><Icon.up size={17} /></button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function TurnView({ t, cur }: { t: Turn; cur: string }) {
  const a = t.a;
  const loading = a.by === 'muse' && !a.text;
  return (
    <div className="ask-turn">
      <div className="ask-q">{t.q}</div>
      <div className="ask-a">
        {loading ? <span className="ask-dots" aria-label="Muse is thinking"><i /><i /><i /></span> : <p>{a.text}</p>}
        {(a.figures?.length || a.rows?.length) ? (
          <details className="ask-work">
            <summary>Show the numbers</summary>
            {a.figures?.length ? (
              <dl className="ask-figs">{a.figures.map((f) => <div key={f.label}><dt>{f.label}</dt><dd className="num">{f.value}</dd></div>)}</dl>
            ) : null}
            {a.rows?.length ? (
              <ul className="ask-rows">
                {a.rows.map((e) => (
                  <li key={e.id}>
                    <span className="dotc" style={{ background: cat(e.category).color }} />
                    <span className="ask-row-label">{e.label}</span>
                    <span className="small">{dayLabel(e.date)}</span>
                    <span className="num" style={{ color: e.dir === 'in' ? 'var(--green)' : undefined }}>{e.dir === 'in' ? '+' : '−'}{money(e.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}
        {!loading && (
          <div className="ask-src">
            {a.by === 'device' ? 'Worked out on this device' : a.by === 'muse' ? 'Answered by Meta Muse from your entries' : a.error ? `Muse couldn't answer (${a.error.slice(0, 60)})` : 'On this device'}
          </div>
        )}
      </div>
    </div>
  );
}
