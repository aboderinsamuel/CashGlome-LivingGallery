// Ask: a conversation with Florin, the voice of this month's painting. Ask it anything; it knows the book.
// Gemini writes the words; this device counts every figure, and each answer shows its working and its seal.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAINTINGS, paintingOf, artSrc } from '../lib/art';
import { computeStats } from '../lib/analytics';
import { exAmount, money, monthOf, todayISO } from '../lib/format';
import type { State } from '../lib/types';
import { Icon } from '../components/Icons';
import { Runway } from '../components/Runway';
import { safeToSpend } from '../stage/askPainting';
import { askFlorin, type FlorinAnswer } from '../stage/florin';
import { brainConfigured } from '../stage/brain';
import { peopleOf } from '../stage/books';
import { castOf } from '../stage/voices';
import { STATEMENT_QUESTION } from '../components/StatementSheet';
import './ask-room.css';
import '../stage/stage.css';

export interface AskTurn { q: string; a: FlorinAnswer | null; at: number }
const KEY = 'cg-ask-room';
const SEAL: Record<FlorinAnswer['planned'], [string, string]> = {
  cloud: ['G', 'Gemini wrote this · every figure counted on this device'],
  device: ['N', 'Gemini Nano, on this device · nothing left it'],
  rules: ['C', 'Counted on this device'],
};

export function loadTurns(): AskTurn[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as AskTurn[]).filter((t) => t.a).slice(-30); } catch { return []; }
}
/** One question at a time, across every copy of the room: a second tap or a re-run effect can't ask it again. */
let asking = false;
const saveTurns = (t: AskTurn[]) => { try { localStorage.setItem(KEY, JSON.stringify(t.filter((x) => x.a).slice(-30))); } catch { /* the conversation still works */ } };

/** Everyday things people weigh up before buying; one is offered each day, priced in the person's own currency. */
const WANTS: [string, number][] = [
  ['these shoes', 120], ['a new bag', 180], ['a new phone', 600], ['concert tickets', 90],
  ['a weekend away', 400], ['a new jacket', 150], ['a gym membership', 45], ['new headphones', 200],
];

/** Questions worth asking, from what is actually written, and one that isn't about money at all. */
function suggestions(state: State): string[] {
  const today = todayISO();
  const s = computeStats(state.entries, monthOf(today));
  const out: string[] = [];
  // A statement just brought in: the question it invites comes first.
  if (state.entries.some((e) => e.statement)) out.push(STATEMENT_QUESTION);
  const safe = safeToSpend(state, today);
  const cur = state.profile.currency;
  const [want, usd] = WANTS[Math.floor(Date.now() / 864e5) % WANTS.length];
  if (safe) out.push(`Can I afford ${want} for ${money(exAmount(usd, cur), cur)}?`);
  if (s.outflow) out.push('What do you make of my month so far?');
  if (safe) out.push('Can I go on a date this weekend?');
  if (s.outflow) out.push('Where did my money go this month?');
  if (peopleOf(state.entries).some((p) => p.net !== 0)) out.push('Who owes me money?');
  if (s.entries.length > 5) out.push('What did I spend most on this week?');
  out.push('Tell me about this painting');
  if (out.length < 3) out.push(`Can I afford ${money(exAmount(50, cur), cur)} on dinner?`);
  return out.slice(0, 4);
}

const useOnline = () => {
  const [on, setOn] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
};

export function AskRoom({ state, turns, setTurns, first, onFirstDone }: { state: State; turns: AskTurn[]; setTurns: (f: (t: AskTurn[]) => AskTurn[]) => void; first: string | null; onFirstDone: () => void }) {
  const cur = state.profile.currency;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const online = useOnline();
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const painting = paintingOf(computeStats(state.entries, monthOf(todayISO())));
  const p = PAINTINGS[painting.id];
  const sitter = castOf(painting.id);
  const ideas = useMemo(() => suggestions(state), [state]);

  const ask = async (q: string) => {
    q = q.trim();
    if (!q || busy || asking) return;
    asking = true;
    setText(''); setBusy(true); setLive('');
    try { navigator.vibrate?.(8); } catch { /* none */ }
    const history = turns.map((t) => ({ q: t.q, a: t.a }));
    const at = Date.now();
    setTurns((t) => [...t, { q, a: null, at }]);
    let a: FlorinAnswer;
    try { a = await askFlorin(state, q, history, { name: sitter.name, role: sitter.role, painting: p.title, artist: p.artist, year: p.year }, setLive); }
    catch { a = { text: 'I lost my train of thought. Ask me again in a moment.', figures: [], rows: [], planned: 'rules', wordsBy: 'app' }; }
    // The answer goes to its own question, found by when it was asked, never simply the last one.
    setTurns((t) => { const next = t.map((x) => (x.at === at && !x.a ? { q, a, at: Date.now() } : x)); saveTurns(next); return next; });
    setBusy(false); setLive(''); asking = false;
  };

  // A question left unanswered (the room was closed mid-answer) is dropped, not left thinking forever.
  useEffect(() => { if (!asking) setTurns((t) => (t.some((x) => !x.a) ? t.filter((x) => x.a) : t)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A question handed over from another page (How is this counted?, a chip): asked once. If it was just asked
  // and answered, the room shows that answer again instead of asking a second time.
  useEffect(() => {
    if (!first) return;
    onFirstDone();
    const q = first.trim(), last = turns[turns.length - 1];
    if (last && last.q === q && Date.now() - last.at < 10 * 60_000) return;
    void ask(q);
  }, [first]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [turns, live.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = input.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; }, [text]);

  const onDevice = !online || !brainConfigured;
  const where = !brainConfigured ? 'This build has no Florin, so the book answers on its own, on this device.'
    : !online ? 'You’re offline. The book still answers, counted on this device.'
      : 'Your question and a summary of your book go to Gemini. Your entries stay here, and every figure is counted here.';

  return (
    <div className="page ask-room">
      <header className="ar-head">
        <img src={artSrc(painting.id, 'sm')} alt="" className="ar-face" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div>
          <div className="ar-kicker">Florin, your assistant · speaking as {sitter.name}</div>
          <h1>Ask me <i>anything</i></h1>
          <p>Ask in plain words. Every sum is counted on this device, with its working.</p>
        </div>
      </header>

      <div className={'ar-where' + (!online ? ' off' : '')}>
        <span className={'st-wax ' + (onDevice ? 'device' : 'cloud')} aria-hidden>{onDevice ? 'N' : 'G'}</span>
        <span className="ar-where-t">{where}</span>
      </div>

      <div className="ar-thread" aria-live="polite">
        {!turns.length && (
          <div className="ar-start">
            <p>Start anywhere:</p>
            <div className="ar-ideas">{ideas.map((q) => <button key={q} onClick={() => void ask(q)}>{q}</button>)}</div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div key={t.at + ':' + i} className="ar-turn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="ar-q">{t.q}</div>
              {t.a ? <AnswerCard a={t.a} cur={cur} who={sitter.name} />
                : live ? <div className="ar-a"><div className="ar-who">{sitter.name}</div><p>{live}<span className="ar-caret" aria-hidden /></p></div>
                  : <div className="ar-a ar-wait"><span className="brushing" aria-hidden><i /><i /><i /></span> {sitter.name} is thinking…</div>}
            </motion.div>
          ))}
        </AnimatePresence>
        {turns.length > 0 && !busy && (
          <div className="ar-ideas again">{ideas.filter((q) => !turns.some((t) => t.q === q)).slice(0, 3).map((q) => <button key={q} onClick={() => void ask(q)}>{q}</button>)}</div>
        )}
        <div ref={end} />
      </div>

      <form className="ar-box" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <textarea ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Florin anything" aria-label="Ask Florin anything"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text); } }} />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Ask"><Icon.up size={17} /></button>
      </form>
      {turns.length > 0 && <button className="ar-clear" onClick={() => { setTurns(() => []); saveTurns([]); }}>Clear this conversation</button>}
    </div>
  );
}

function AnswerCard({ a, cur, who }: { a: FlorinAnswer; cur: string; who: string }) {
  const [open, setOpen] = useState(false);
  const [mark, line] = SEAL[a.planned] ?? SEAL.rules;
  return (
    <div className="ar-a">
      <div className="ar-who">{who}</div>
      <p>{a.text}</p>
      {a.runway && <div className="ar-runway"><Runway a={a.runway} cur={cur} compact /></div>}
      {a.estimate && <div className="ar-est">Holds an estimate: a guess, not a figure from your book.</div>}
      {a.figures.length > 0 && (
        <>
          <button className="ar-work-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Hide the working' : 'Show the working'}</button>
          {open && (
            <div className="ar-work">
              <dl>{a.figures.map((f, i) => <div key={i} className={f.label.startsWith('  ') ? 'sub' : ''}><dt>{f.label.trim()}</dt><dd className="num">{f.value}</dd></div>)}</dl>
              {a.rows.length > 0 && <ul>{a.rows.slice(0, 8).map((e) => <li key={e.id}><span>{e.label}</span><span>{new Date(e.date + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><span className="num">{money(e.amount, cur)}</span></li>)}</ul>}
              {/* Where it ran stays in the working, for anyone who looks; the conversation itself carries no label. */}
              <div className="ar-seal"><span className={'st-wax ' + a.planned}>{mark}</span>{a.note ?? line}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
