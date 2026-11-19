import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { HELP, SUGGESTED, answerLocally, askMuse, type Answer, type Turn } from '../lib/ask';
import { cat } from '../lib/categories';
import { dayLabel, money } from '../lib/format';
import type { Action } from '../lib/store';
import type { State } from '../lib/types';
import { Icon } from './Icons';
import { Runway } from './Runway';
import { describeMemory } from '../lib/memory';
import type { Memory } from '../lib/types';

interface Props {
  state: State;
  dispatch: (a: Action) => void;
  aiOn: boolean;
  turns: Turn[];
  setTurns: (f: (t: Turn[]) => Turn[]) => void;
  first: string | null;
  onClose: () => void;
}

/** Ask about your money. With Muse on (and your OK), any question: Muse searches your entries and the app counts.
 *  Without it, the questions that can be counted on this device. */
export function AskPanel({ state, dispatch, aiOn, turns, setTurns, first, onClose }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<string | null>(null);
  const [step, setStep] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const cur = state.profile.currency;
  const asked = useRef<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const keep = (m: Memory) => { dispatch({ type: 'remember', memory: m }); setKept((k) => new Set(k).add(m.id)); };

  const ask = async (q: string, allowMuse = state.settings.askMuse) => {
    q = q.trim();
    if (!q || busy) return;
    setText('');
    if (aiOn && allowMuse === undefined) { setConsent(q); return; }
    if (!aiOn || !allowMuse) { setTurns((t) => [...t, { q, a: answerLocally(state, q) ?? HELP }]); return; }
    setBusy(true); setStep('Reading your question…');
    setTurns((t) => [...t, { q, a: { text: '', by: 'muse' } }]);
    let a: Answer;
    try { a = await askMuse(state, q, turns, setStep); } catch (e) {
      // Offline or Muse is down: still answer what can be counted here.
      const msg = (e as Error).message;
      a = { ...(answerLocally(state, q) ?? HELP), error: msg };
    }
    setTurns((t) => [...t.slice(0, -1), { q, a }]);
    setBusy(false); setStep('');
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
            <div className="small">{aiOn && state.settings.askMuse ? 'Ask anything. Muse looks through your entries; the app does the counting.' : "Counted from what you've written down."}</div>
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
          {turns.map((t, i) => <TurnView key={i} t={t} cur={cur} step={i === turns.length - 1 ? step : ''} kept={kept} onKeep={keep} />)}
          {consent && (
            <div className="ask-consent">
              <p><b>Let Muse answer any question?</b> Muse reads your question and asks this app to search your entries. Your question, your monthly totals and the entries each search finds (names, amounts, dates, categories) are sent to Meta Muse. The adding up happens here, and photos are never sent.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => decide(true)}>Use Muse</button>
                <button className="btn" onClick={() => decide(false)}>Keep it on this device</button>
              </div>
              <div className="small" style={{ marginTop: 8 }}>You can change this later in Settings, under The AI.</div>
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

/** Muse may answer in a few short lines and "- " lists, with **bold**. Rendered as text, never as HTML. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : p.replace(/(^|\s)\*(\S[^*]*)\*/g, '$1$2')));
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) blocks.push(<ul key={blocks.length} className="ask-list">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; };
  for (const line of text.replace(/^#+\s*/gm, '').split('\n')) {
    const li = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
    if (li) { list.push(li[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.trim())}</p>);
  }
  flush();
  return <>{blocks}</>;
}

function TurnView({ t, cur, step, kept, onKeep }: { t: Turn; cur: string; step: string; kept: Set<string>; onKeep: (m: Memory) => void }) {
  const a = t.a;
  const loading = a.by === 'muse' && !a.text;
  return (
    <div className="ask-turn">
      <div className="ask-q">{t.q}</div>
      <div className="ask-a">
        {loading ? <div className="ask-thinking"><span className="ask-dots" aria-hidden><i /><i /><i /></span><span className="small" aria-live="polite">{step || 'Thinking…'}</span></div> : <Rich text={a.text} />}
        {!loading && a.runway && a.runway.days.length > 1 && <div className="ask-runway"><Runway a={a.runway} cur={cur} compact /></div>}
        {!loading && a.remember?.map((m) => (
          <div key={m.id} className="ask-remember">
            <Icon.quill size={15} />
            <span>Remember that <b>{describeMemory(m, cur)}</b>?</span>
            {kept.has(m.id) ? <span className="small" style={{ color: 'var(--green)' }}>Kept in Memory</span> : <button className="btn" onClick={() => onKeep(m)}>Keep</button>}
          </div>
        ))}
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
            {a.by === 'muse' ? 'Muse searched your entries; the numbers were counted on this device' : `${a.by === 'device' ? 'Worked out on this device' : 'On this device'}${a.error ? ` · Muse couldn't answer (${a.error.slice(0, 60)})` : ''}`}
          </div>
        )}
      </div>
    </div>
  );
}
