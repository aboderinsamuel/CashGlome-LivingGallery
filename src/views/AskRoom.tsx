// Ask: a room of its own. Questions in your words; Gemini plans the search, this device counts every sum,
// and each answer shows its working and says where it was planned.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAINTINGS, paintingOf, artSrc } from '../lib/art';
import { computeStats } from '../lib/analytics';
import { money, monthOf, todayISO } from '../lib/format';
import type { State } from '../lib/types';
import { Icon } from '../components/Icons';
import { Runway } from '../components/Runway';
import { askPainting, safeToSpend, type PaintingAnswer } from '../stage/askPainting';
import { peopleOf } from '../stage/books';
import { castOf } from '../stage/voices';
import './ask-room.css';

export interface AskTurn { q: string; a: PaintingAnswer | null; at: number }
const KEY = 'cg-ask-room';
const PLANNED: Record<PaintingAnswer['planned'], string> = { device: 'Planned and counted on this device', cloud: 'Planned in the cloud, counted on this device', rules: 'Counted on this device' };

export function loadTurns(): AskTurn[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as AskTurn[]).filter((t) => t.a).slice(-30); } catch { return []; }
}
const saveTurns = (t: AskTurn[]) => { try { localStorage.setItem(KEY, JSON.stringify(t.filter((x) => x.a).slice(-30))); } catch { /* the conversation still works */ } };

/** Questions worth asking, from what is actually written. */
function suggestions(state: State): string[] {
  const today = todayISO();
  const s = computeStats(state.entries, monthOf(today));
  const out: string[] = [];
  const safe = safeToSpend(state, today);
  if (safe) out.push(`Can I afford ${money(Math.round(safe.free / 4 / 100) * 100 || 50, state.profile.currency)} on something today?`);
  if (s.outflow) out.push('Where did my money go this month?');
  if (s.entries.length > 5) out.push('What did I spend most on this week?');
  if (peopleOf(state.entries).some((p) => p.net !== 0)) out.push('Who owes me money?');
  if (s.inflow) out.push('How much came in this month?');
  if (!out.length) out.push('Can I afford 50 on dinner?', 'Where did my money go this month?');
  return out.slice(0, 4);
}

export function AskRoom({ state, turns, setTurns, first, onFirstDone }: { state: State; turns: AskTurn[]; setTurns: (f: (t: AskTurn[]) => AskTurn[]) => void; first: string | null; onFirstDone: () => void }) {
  const cur = state.profile.currency;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const painting = paintingOf(computeStats(state.entries, monthOf(todayISO())));
  const sitter = castOf(painting.id);
  const ideas = useMemo(() => suggestions(state), [state]);

  const ask = async (q: string) => {
    q = q.trim();
    if (!q || busy) return;
    setText(''); setBusy(true);
    setTurns((t) => [...t, { q, a: null, at: Date.now() }]);
    const p = PAINTINGS[painting.id];
    let a: PaintingAnswer;
    try { a = await askPainting(state, q, { name: sitter.name, role: sitter.role, painting: p.title, artist: p.artist, year: p.year }); }
    catch { a = { text: 'I couldn’t count that just now. Try again in a moment.', figures: [], rows: [], planned: 'rules', wordsBy: 'app' }; }
    setTurns((t) => { const next = [...t.slice(0, -1), { q, a, at: Date.now() }]; saveTurns(next); return next; });
    setBusy(false);
  };

  useEffect(() => { if (first) { onFirstDone(); void ask(first); } }, [first]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [turns]);
  useEffect(() => { const el = input.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; }, [text]);

  return (
    <div className="page ask-room">
      <header className="ar-head">
        <img src={artSrc(painting.id, 'sm')} alt="" className="ar-face" />
        <div>
          <h1>Ask about your <i>money</i></h1>
          <p>{sitter.name} keeps the book this month. Ask in your own words; every sum is counted on this device.</p>
        </div>
      </header>

      <div className="ar-thread" aria-live="polite">
        {!turns.length && (
          <div className="ar-start">
            <p>Some things people ask:</p>
            <div className="ar-ideas">{ideas.map((q) => <button key={q} onClick={() => void ask(q)}>{q}</button>)}</div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div key={t.at + ':' + i} className="ar-turn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="ar-q">{t.q}</div>
              {t.a ? <AnswerCard a={t.a} cur={cur} who={sitter.name} /> : <div className="ar-a ar-wait"><span className="brushing" aria-label="Counting"><i /><i /><i /></span> Counting…</div>}
            </motion.div>
          ))}
        </AnimatePresence>
        {turns.length > 0 && !busy && (
          <div className="ar-ideas again">{ideas.filter((q) => !turns.some((t) => t.q === q)).slice(0, 3).map((q) => <button key={q} onClick={() => void ask(q)}>{q}</button>)}</div>
        )}
        <div ref={end} />
      </div>

      <form className="ar-box" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <textarea ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your money" aria-label="Ask about your money"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text); } }} />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Ask"><Icon.up size={17} /></button>
      </form>
      {turns.length > 0 && <button className="ar-clear" onClick={() => { setTurns(() => []); saveTurns([]); }}>Clear this conversation</button>}
    </div>
  );
}

function AnswerCard({ a, cur, who }: { a: PaintingAnswer; cur: string; who: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ar-a">
      <div className="ar-who">{who}</div>
      <p>{a.text}</p>
      {a.runway && <div className="ar-runway"><Runway a={a.runway} cur={cur} compact /></div>}
      {a.figures.length > 0 && (
        <>
          <button className="ar-work-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Hide the working' : 'Show the working'}</button>
          {open && (
            <div className="ar-work">
              <dl>{a.figures.map((f, i) => <div key={i} className={f.label.startsWith('  ') ? 'sub' : ''}><dt>{f.label.trim()}</dt><dd className="num">{f.value}</dd></div>)}</dl>
              {a.rows.length > 0 && <ul>{a.rows.slice(0, 8).map((e) => <li key={e.id}><span>{e.label}</span><span>{new Date(e.date + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><span className="num">{money(e.amount, cur)}</span></li>)}</ul>}
            </div>
          )}
        </>
      )}
      <div className="ar-seal"><span className={'st-wax ' + a.planned}>C</span>{PLANNED[a.planned]}{a.wordsBy === 'device' ? '; words by Gemini Nano' : ''}</div>
    </div>
  );
}
