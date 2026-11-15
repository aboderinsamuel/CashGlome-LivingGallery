import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch } from 'react';
import { artSrc, NATIVE_TITLE, paintingOf, PAINTINGS } from '../lib/art';
import { computeStats } from '../lib/analytics';
import { cat } from '../lib/categories';
import { currencySymbol, money, monthOf, todayISO } from '../lib/format';
import { parseStory } from '../lib/parser';
import { sfx } from '../lib/sound';
import { toEntry, type Action } from '../lib/store';
import type { Entry, State } from '../lib/types';
import { LivingCanvas, strokeFor, type Stroke } from './LivingCanvas';
import { moodOf, nightOf, stageName, stageOf } from './mood';
import { castOf, labelOf, sitterLine } from './voices';
import { dateInWords, examplesFor } from './words';
import { brainConfigured, brainStatus, museumLabel, onBrain, paintStillLife, readLine, sitterSays, warmUp } from './brain';
import { askPainting, safeToSpend, type PaintingAnswer } from './askPainting';
import { mentionsCircle, readCircle } from './books';
import { isQuestion } from '../lib/ask';
import { describeMemory, readMemory, relDay } from '../lib/memory';
import { Icon } from '../components/Icons';
import type { View } from '../components/Shell';
import './stage.css';

// Hangul, Han, kana, Arabic, Devanagari, Cyrillic, Thai and others: lines the rules were not written for.
const OTHER_SCRIPT = /[Ͱ-῿　-鿿가-힯]/;
let snap = brainStatus();
const brainSnapshot = () => { const n = brainStatus(); if (n.device !== snap.device || Math.abs(n.progress - snap.progress) > 0.01) snap = n; return snap; };

const ease = [0.2, 0.8, 0.2, 1] as const;
// Studio controls for demos and testing: ?stage=0..3, ?night=0..1, ?mood=calm|rush|weight|plenty
const Q = new URLSearchParams(location.search);
const num = (k: string) => (Q.has(k) ? Number(Q.get(k)) : undefined);
const MOODS = { calm: { calm: 1, rush: 0, weight: 0, plenty: 0 }, rush: { calm: 0, rush: 1, weight: 0, plenty: 0 }, weight: { calm: 0.2, rush: 0, weight: 1, plenty: 0 }, plenty: { calm: 0.5, rush: 0, weight: 0, plenty: 1 } } as const;
type Seal = 'device' | 'cloud' | 'rules';
const SEAL_TEXT: Record<Seal, string> = { device: 'Read on this device', cloud: 'Read in the cloud', rules: 'Read by the rules, on this device' };
const PLAN_TEXT: Record<Seal, string> = { device: 'Planned and counted on this device', cloud: 'Planned in the cloud, counted on this device', rules: 'Counted on this device' };
/** Sentences that tell the painting something to remember, rather than something spent. */
const TELLS = /^\s*(remember\b|note\b|i have\b|i've got\b|i get paid\b|my (salary|pay|balance|rent)\b|i'm paid\b|i am paid\b|.*\bevery (day|week|weekday|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|.*\bon the \d+(st|nd|rd|th)\b)/i;

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
  /** Leave the painting for the rooms of the app: ledger, chapters, gallery. */
  onRooms: (v: View) => void;
}

/** The month's painting, alive, with a quill on the varnish. The first thing anyone sees, and home after. */
export function Stage({ state, dispatch, onRooms }: Props) {
  const cur = state.profile.currency;
  const today = todayISO();
  const month = monthOf(today);
  const monthEntries = useMemo(() => state.entries.filter((e) => monthOf(e.date) === month), [state.entries, month]);
  const painting = useMemo(() => paintingOf(computeStats(state.entries, month)), [state.entries, month]);
  const p = PAINTINGS[painting.id];
  const [night, setNight] = useState(() => num('night') ?? nightOf());
  useEffect(() => { const t = setInterval(() => setNight(num('night') ?? nightOf()), 60_000); return () => clearInterval(t); }, []);
  const forced = Q.get('mood') as keyof typeof MOODS | null;
  const mood = useMemo(() => (forced && MOODS[forced]) || moodOf(state.entries, today), [state.entries, today, forced]);
  const stage = num('stage') ?? stageOf(month, today);

  // Strokes for every line this month. Lines written before this visit are already dry.
  const opened = useRef(performance.now());
  const born = useRef(new Map<string, number>());
  const focus = p.focus.split(' ').map((s) => parseFloat(s) / 100) as [number, number];
  const strokes: Stroke[] = useMemo(() => monthEntries.map((e) => strokeFor(e.id, e.amount, born.current.get(e.id) ?? opened.current - 5000, [focus[0], 0.42])), [monthEntries, focus[0], focus[1]]);

  const [text, setText] = useState('');
  const [flash, setFlash] = useState(0);
  const [slip, setSlip] = useState<{ who: string; role: string; text: string; seal: Seal; key: number; answer?: PaintingAnswer; q?: string; sealText?: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [still, setStill] = useState<{ src: string; thing: string } | null>(null);
  const [plaque, setPlaque] = useState<string | null>(null);
  const [glReady, setGlReady] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // A sitter's remark fades on its own; an answer stays until it's dismissed or the next line is written.
  useEffect(() => { if (!slip || slip.answer) return; const t = setTimeout(() => setSlip(null), 11_000); return () => clearTimeout(t); }, [slip]);
  const safe = useMemo(() => safeToSpend(state, today), [state, today]);

  const todays = state.entries.filter((e) => e.date === today).sort((a, b) => b.createdAt - a.createdAt);
  const spent = todays.filter((e) => e.dir === 'out').reduce((s, e) => s + e.amount, 0);
  const came = todays.filter((e) => e.dir === 'in').reduce((s, e) => s + e.amount, 0);
  const weekday = new Date().toLocaleDateString('en', { weekday: 'long' });

  const [reading, setReading] = useState(false);
  const brain = useSyncExternalStore(onBrain, brainSnapshot);

  // The rooms open from the painting. Before the first line there's nothing in them yet, but they open anyway.
  const go = (v: View) => { if (!state.profile.onboarded) dispatch({ type: 'onboard', name: state.profile.name || '', currency: cur }); onRooms(v); };

  async function submit(line = text) {
    const t = line.trim();
    if (!t) return;
    const who = castOf(painting.id);
    const say = (text: string, seal: Seal = 'rules', extra: Partial<NonNullable<typeof slip>> = {}) => setSlip({ who: who.name, role: who.role, text, seal, key: Date.now(), ...extra });
    // A savings circle in one sentence.
    if (mentionsCircle(t) && /\b(people|members|of us|hands|turn|of \d+)\b/i.test(t)) {
      const c = readCircle(t, today);
      if (c) {
        dispatch({ type: 'circle', circle: c }); setText(''); sfx.brush(true);
        say(`${/^[aeiou]/i.test(c.name) ? 'An' : 'A'} ${c.name.toLowerCase()} of ${c.members}, ${money(c.contribution, cur)} a ${c.every}. Your turn is round ${c.myTurn}; the pot will be ${money(c.contribution * c.members, cur)}. It's in the accounts.`);
        return;
      }
    }
    // Something to remember: a balance, a pay day, a routine.
    if (TELLS.test(t) && !isQuestion(t)) {
      const mem = readMemory(t);
      if (mem.kind !== 'note' && mem.amount) {
        if (!state.profile.onboarded) dispatch({ type: 'onboard', name: state.profile.name || '', currency: cur });
        dispatch({ type: 'remember', memory: mem }); setText(''); sfx.brush(true);
        say(`Noted: ${describeMemory(mem, cur)}`);
        return;
      }
    }
    // A question for the painting.
    if (isQuestion(t)) {
      setReading(true); setText('');
      const p0 = PAINTINGS[painting.id];
      try {
        const a = await askPainting(state, t, { name: who.name, role: who.role, painting: p0.title, artist: p0.artist, year: p0.year });
        setWorking(false);
        say(a.text, a.planned, { answer: a, q: t, sealText: PLAN_TEXT[a.planned] + (a.wordsBy === 'device' ? '; words by the on-device model' : '') });
      } finally { setReading(false); }
      return;
    }
    await keep(t);
  }

  async function keep(line = text) {
    // The rules read English and pidgin shorthand instantly, offline. Anything they can't read, or any line in
    // another script, goes to the model: on this device if it has one.
    let read = parseStory(line, { home: cur });
    let where: Seal = 'rules';
    if ((!read.length || OTHER_SCRIPT.test(line)) && brainConfigured) {
      setReading(true);
      const r = await readLine(line, cur).finally(() => setReading(false));
      if (r?.read.length) { read = r.read; where = r.where; }
    }
    if (!read.length) {
      const who = castOf(painting.id);
      setSlip({ who: who.name, role: who.role, text: 'I couldn’t find a sum in that. Try it with the amount, the way you’d say it.', seal: where, key: Date.now() });
      return;
    }
    const kept: Entry[] = read.map((r) => ({ ...toEntry(r), date: today }));
    const now = performance.now();
    kept.forEach((e, i) => born.current.set(e.id, now + i * 260));
    if (!state.profile.onboarded) dispatch({ type: 'onboard', name: state.profile.name || '', currency: cur });
    dispatch({ type: 'addEntries', entries: kept });
    setText('');
    setFlash((f) => f + 1);
    if (kept.some((e) => e.dir === 'in')) sfx.income(); else sfx.brush(true);
    const all = [...state.entries, ...kept];
    const said = sitterLine(painting.id, kept, all, kept[0].id.charCodeAt(0) + kept.length);
    const kinds = Array.from(new Set(kept.map((e) => cat(e.category).name.toLowerCase())));
    const todayAll = all.filter((e) => e.date === today);
    setPlaque(labelOf(todayAll, weekday));
    const shown = performance.now();
    const show = (text: string, seal: Seal) => setTimeout(() => setSlip({ who: said.who.name, role: said.who.role, text, seal, key: Date.now() }), Math.max(0, 900 - (performance.now() - shown)));
    if (!brainConfigured) { show(said.text, where); return; }
    // The sitter answers in its own words when a model is there; its stock line if the model is slow or absent.
    const hint = mood.plenty > 0.5 ? 'pay day, plenty' : mood.rush > 0.5 ? 'a busy, spendy week' : mood.weight > 0.5 ? 'heavy with bills' : 'steady';
    const voiced = await Promise.race([
      sitterSays({ name: said.who.name, role: said.who.role, painting: p.title, artist: p.artist, year: p.year }, line, kinds, hint),
      new Promise<null>((r) => setTimeout(() => r(null), 4500)),
    ]);
    show(voiced?.text ?? said.text, voiced?.where ?? where);
    const l = await museumLabel(Array.from(new Set(todayAll.map((e) => cat(e.category).name.toLowerCase()))), weekday, p.title);
    if (l) setPlaque(l.text);
    // A small still life of what was bought, painted in the manner of the month's master. The cloud is told
    // only the kind of thing, never the sum or the line.
    const thing = kept.find((e) => e.dir === 'out');
    if (thing && !Q.has('nostill')) {
      const kind = cat(thing.category).name.toLowerCase();
      const src = await paintStillLife(kind === 'everything else' ? thing.label.toLowerCase() : kind, p.title, p.artist);
      if (src) setStill({ src, thing: kind === 'everything else' ? thing.label.toLowerCase() : kind });
    }
  }

  return (
    <div className="stage">
      <LivingCanvas className="st-canvas" id={painting.id} stage={stage} mood={mood} night={night} strokes={strokes} flash={flash} style={{ opacity: glReady ? 1 : 0, transition: 'opacity 1.2s ease' }} onReady={(ok) => { setGlReady(true); setGlFailed(!ok); }} />
      {glFailed && <img className="st-fallback" src={artSrc(painting.id, 'md')} alt="" />}
      <div className="st-shade" />

      <header className="st-top">
        <div className="st-mark">CashGlome <i>· {dateInWords()}</i></div>
        <div className="st-label">
          <div className="t">{p.title}</div>
          {NATIVE_TITLE[p.id] && <div className="n">{NATIVE_TITLE[p.id]}</div>}
          <div className="a">{p.artist}, {p.year}</div>
        </div>
      </header>

      <AnimatePresence>
        {slip && (
          <motion.div key={slip.key} className="st-slip" role="status"
            initial={{ opacity: 0, scaleY: 0.2, y: -10 }} animate={{ opacity: 1, scaleY: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.55, ease }}>
            <div className="who">{slip.who}<span>{slip.role}</span></div>
            {slip.q && <div className="q">{slip.q}</div>}
            <div className="say">{slip.answer ? slip.text : `“${slip.text}”`}</div>
            {slip.answer && slip.answer.figures.length > 0 && (
              <details className="work" open={working} onToggle={(e) => setWorking((e.target as HTMLDetailsElement).open)}>
                <summary>Show the working</summary>
                <dl>{slip.answer.figures.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
                {slip.answer.rows.length > 0 && <ul>{slip.answer.rows.slice(0, 5).map((e) => <li key={e.id}><span>{e.label}</span><span>{e.date.slice(5)}</span><span>{money(e.amount, cur)}</span></li>)}</ul>}
              </details>
            )}
            <div className="seal"><span className={`st-wax ${slip.seal}`}>C</span>{slip.sealText ?? SEAL_TEXT[slip.seal]}{slip.answer && <button className="close" onClick={() => setSlip(null)} aria-label="Close the answer">×</button>}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {plaque && (
          <motion.div key={plaque} className="st-plaque" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease, delay: 1.4 }}>
            <b>Today’s label</b>{plaque}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {still && (
          <motion.figure key={still.src.length} className="st-still" initial={{ opacity: 0, scale: 0.85, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease }}>
            <img src={still.src} alt={`A still life of ${still.thing}, painted in the manner of ${p.artist}`} />
            <figcaption><i>Still life with {still.thing}</i><span>after {p.artist} · painted in the cloud</span></figcaption>
            <button onClick={() => setStill(null)} aria-label="Put the still life away">×</button>
          </motion.figure>
        )}
      </AnimatePresence>

      <div className="st-ledger" aria-label="Today’s lines">
        <AnimatePresence initial={false}>
          {todays.slice(0, 4).map((e, i) => (
            <motion.div key={e.id} layout className={`row ${e.dir}`}
              initial={{ opacity: 0, y: 60, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease, delay: Math.max(0, (born.current.get(e.id) ?? 0) - opened.current) > 0 ? i * 0.12 : 0 }}>
              <span className="l">{e.label}</span>
              <span className="c">{cat(e.category).short}</span>
              <span className="m">{e.dir === 'in' ? '+' : ''}{money(e.amount, cur)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {todays.length > 4 && <div className="more">and {todays.length - 4} more today</div>}
      </div>

      <div className="st-bottom">
        {!todays.length && (
          <div className="st-examples">
            {[...examplesFor(cur).slice(0, 2), `Can I afford ${cur === 'NGN' ? '50k' : '200'}?`].map((x) => <button key={x} onClick={() => { setText(x); input.current?.focus(); }}>{x}</button>)}
          </div>
        )}
        <form className="st-quill" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void submit(); }}>
          <span className="cur" aria-hidden>{currencySymbol(cur)}</span>
          <input ref={input} value={text} onFocus={() => void warmUp()} onPointerDown={() => void warmUp()} readOnly={reading} onChange={(e) => setText(e.target.value)} placeholder={typeof window !== 'undefined' && window.innerWidth < 440 ? 'What did today cost? Or ask.' : 'What did today cost? Or ask the painting.'} aria-label="What did today cost? Or ask the painting." autoComplete="off" autoFocus />
          <button className="go" type="submit" disabled={!text.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 3c-6 1-11 6-13 13l-2 5 5-2c7-2 12-7 13-13" /><path d="M7 16l5-5" /></svg>
            <span>Keep</span>
          </button>
        </form>
        <div className="st-meta">
          <span>{todays.length ? <>Spent today <em>{money(spent, cur)}</em>{came > 0 && <> · came in <em>{money(came, cur)}</em></>}</> : 'Nothing written today yet. That’s fine.'}{safe && <> · <button className="st-safe" onClick={() => go('accounts')}>safe to spend <em>{money(safe.perDay, cur)}</em> a day{safe.until ? ` until ${relDay(safe.until)}` : ''}</button></>}</span>
          <span className="stage-name"><BrainNote s={brain} reading={reading} /><span title={stageName(stage).note}>{stageName(stage).name}, day {Number(today.slice(8))}</span></span>
        </div>
        <nav className="st-rooms-bar" aria-label="Rooms">
          <button className="on" aria-current="page"><Icon.sun size={18} /><span>Today</span></button>
          <button onClick={() => go('ledger')}><Icon.list size={18} /><span>Ledger</span></button>
          <button onClick={() => go('accounts')}><Icon.person size={18} /><span>Accounts</span></button>
          <button onClick={() => go('chapter')}><Icon.book size={18} /><span>Chapter</span></button>
          <button onClick={() => go('collection')}><Icon.seal size={18} /><span>Gallery</span></button>
        </nav>
      </div>
    </div>
  );
}

/** Where the reading happens, said plainly. */
function BrainNote({ s, reading }: { s: ReturnType<typeof brainStatus>; reading: boolean }) {
  const text = reading ? 'Reading…'
    : !s.configured ? 'Read on this device'
    : s.device === 'ready' ? 'Gemini Nano on this device'
    : s.device === 'downloading' ? `Fetching the on-device model, ${Math.round(s.progress * 100)}%`
    : s.device === 'none' ? 'Rules on this device, Gemini in the cloud'
    : 'Rules on this device';
  return <span className="brain">{text} · </span>;
}
