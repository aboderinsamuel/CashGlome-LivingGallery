// Today: the money first. What is safe to spend, what today cost, what is coming, who owes whom.
// The month's painting is the hero, the money hangs beside it like a museum label; every line lifts a patch.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { computeStats } from '../lib/analytics';
import { paintingOf, PATCHES, restorationOf } from '../lib/art';
import { cat } from '../lib/categories';
import { dateInWords, ex, money, monthOf, todayISO } from '../lib/format';
import { addDays, nextIncome, occursOn, relDay, routineKey, routinesOf } from '../lib/memory';
import type { Action } from '../lib/store';
import type { Entry, State } from '../lib/types';
import { RestorationPlate, revealTime } from '../components/Restoration';
import { Icon } from '../components/Icons';
import { Sitting } from '../components/Sitting';
import { HousePlate } from '../components/HousePlate';
import { safeToSpend } from '../stage/askPainting';
import { circleStatus, peopleOf } from '../stage/books';
import { usePhone } from '../phone/device';
import { InstallNudge } from '../components/Install';
import { momentOf, seatOf, sitterMoment, type Moment } from '../stage/voices';
import './today.css';

/** What a sitter just said about a line, shown beside the miniature. */
/** What the sitters are saying now: one remark and usually an answer, in speaking order. */
export interface Voice { lines: { who: string; role: string; text: string }[]; where: string; key: number; moment?: string }

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
  voice: Voice | null;
  onVoiceDone: () => void;
  /** Put a line in the writing box, ready to send. */
  onFill: (text: string) => void;
  onLedger: () => void;
  onPeople: () => void;
  onAsk: (q?: string) => void;
  /** The living painting, full size. */
  onPainting: () => void;
  onEdit: (e: Entry) => void;
  /** Opens Play, where the games live. */
  onPlay?: () => void;
}

// "Good night" reads as a goodbye, so late hours stay "evening".
const part = (h: number) => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening');

export function Today({ state, dispatch, voice, onVoiceDone, onFill, onLedger, onPeople, onAsk, onPainting, onEdit, onPlay }: Props) {
  const cur = state.profile.currency;
  const phone = usePhone();
  const m = (n: number) => money(n, cur);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const today = todayISO(now);
  const month = monthOf(today);

  const safe = useMemo(() => safeToSpend(state, today), [state, today]);
  const todays = useMemo(() => state.entries.filter((e) => e.date === today).sort((a, b) => b.createdAt - a.createdAt), [state.entries, today]);
  const spent = todays.filter((e) => e.dir === 'out').reduce((a, e) => a + e.amount, 0);
  const came = todays.filter((e) => e.dir === 'in').reduce((a, e) => a + e.amount, 0);
  const people = useMemo(() => peopleOf(state.entries).filter((p) => p.net !== 0).slice(0, 3), [state.entries]);
  const coming = useMemo(() => comingUp(state, today), [state, today]);
  const fresh = state.entries.length === 0;

  // The miniature: the same restoration as the Chapter, so both always agree.
  const stats = useMemo(() => computeStats(state.entries, month), [state.entries, month]);
  const painting = paintingOf(stats);
  const r = useMemo(() => restorationOf(state.entries, month, state.quiet), [state.entries, state.quiet, month]);
  const seen = state.seenRestored[month] ?? 0;
  const [shownSeen, setShownSeen] = useState(seen);
  useEffect(() => {
    if (r.restored <= seen) return;
    const t = setTimeout(() => { dispatch({ type: 'seenRestored', month, n: r.restored }); }, revealTime(r.restored - shownSeen) * 1000 + 400);
    return () => clearTimeout(t);
  }, [r.restored, seen, shownSeen, month, dispatch]);
  useEffect(() => { if (seen > shownSeen && r.restored === seen) { const t = setTimeout(() => setShownSeen(seen), 2500); return () => clearTimeout(t); } }, [seen, shownSeen, r.restored]);
  // The sitters speak once the new strokes have finished painting, never over them. Two lines take 11 s,
  // one takes 8; a tap puts them away sooner.
  // Besides answering what you write (`voice`, from App), they notice things on their own (`own`): you
  // arriving, a quiet day, the last stroke. Those are theirs to say, so Today holds them.
  const [own, setOwn] = useState<Voice | null>(null);
  // The last stroke outranks everything: the farewell is said even if a reply to the line is on its way.
  const talk = own?.moment === 'finished' ? own : voice ?? own;
  useEffect(() => { if (own?.moment === 'finished' && voice) onVoiceDone(); }, [own, voice, onVoiceDone]);
  const hush = () => { if (talk === voice) onVoiceDone(); else setOwn(null); };
  const [spoken, setSpoken] = useState<number | null>(null);
  const talkKey = talk?.key ?? null;
  useEffect(() => {
    if (talkKey === null) { setSpoken(null); return; }
    const wait = state.settings.calm ? 0 : revealTime(Math.max(0, r.restored - shownSeen)) * 1000;
    const t = setTimeout(() => setSpoken(talkKey), wait);
    return () => clearTimeout(t);
  }, [talkKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leaving Today ends the remark: coming back later never finds an old one waiting.
  useEffect(() => () => onVoiceDone(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // On a phone the answer takes the first speaker's place after a beat (see talkBlock).
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    setBeat(0);
    if (spoken === null || (talk?.lines.length ?? 0) < 2) return;
    const t = setTimeout(() => setBeat(1), phone ? 4500 : 1500); // desktop: when the answer appears
    return () => clearTimeout(t);
  }, [spoken]); // eslint-disable-line react-hooks/exhaustive-deps
  // The one speaking is ringed in gilt where they sit in the painting.
  const speaker = talk && spoken === talk.key ? talk.lines[Math.min(beat, talk.lines.length - 1)]?.who : undefined;
  const seat = useMemo(() => (speaker ? seatOf(painting.id, speaker) : null), [speaker, painting.id]);
  const hushRef = useRef(hush); hushRef.current = hush;
  useEffect(() => {
    if (spoken === null) return;
    const t = setTimeout(() => hushRef.current(), (talk?.lines.length ?? 1) > 1 ? 11_000 : 8000);
    return () => clearTimeout(t);
  }, [spoken]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = (moment: Moment, keepIt: boolean) => {
    const at = Date.now();
    const lines = sitterMoment(painting.id, moment, at >> 10);
    setOwn({ lines: lines.map((l) => ({ who: l.who.name, role: l.who.role, text: l.text })), where: 'Written on this device', key: at, moment });
    if (keepIt) dispatch({ type: 'overheard', month, heard: { at, painting: painting.id, lines: lines.map((l) => ({ who: l.who.name, text: l.text })), moment } });
  };
  // Arriving: once per part of the day, a word of welcome; after three or more days away, a kinder one.
  useEffect(() => {
    if (fresh || voice) return;
    const last = state.entries.reduce((m, e) => (e.date > m ? e.date : m), '');
    const away = !!last && Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000) >= 3;
    const moment: Moment = away ? 'away' : momentOf(now.getHours());
    const mark = `cg-greeted-${today}-${moment}`;
    try { if (sessionStorage.getItem(mark) || localStorage.getItem(mark)) return; } catch { return; }
    const t = setTimeout(() => {
      try { sessionStorage.setItem(mark, '1'); localStorage.setItem(mark, '1'); } catch { /* private window: greet anyway */ }
      say(moment, away);
    }, 1400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The last stroke: the sitters notice they are finished.
  const wasComplete = useRef(r.complete);
  useEffect(() => {
    if (r.complete && !wasComplete.current) { onVoiceDone(); say('finished', true); }
    wasComplete.current = r.complete;
  }, [r.complete]); // eslint-disable-line react-hooks/exhaustive-deps

  const greeting = part(now.getHours());
  const quietToday = (state.quiet ?? []).includes(today);
  const evening = now.getHours() >= 17 || now.getHours() < 4;
  const setQuiet = (on: boolean) => { dispatch({ type: 'quiet', date: today, on }); if (on) { onVoiceDone(); say('quiet', true); } };
  const first = state.profile.name?.split(' ')[0];

  const days = safe ? Math.max(1, Math.round(safe.free / Math.max(1, safe.perDay))) : 0;

  // On a phone the sitters speak under the painting's label; on a wide screen, in the wide column under the
  // greeting, where there is room for a conversation and the floating notice never reaches.
  const talkBlock = (
          <AnimatePresence>
            {talk && spoken === talk.key && (
              // Unfolds like a slip of paper in the page, so it pushes nothing out of reach and covers nothing.
              // The second sitter answers a beat later, the way people in a room do.
              <motion.div key={talk.key} className="td-voice-fold" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}>
                <button className="td-voice" role="status" onClick={hush} title="Tap to put away">
                  {phone ? (
                    // A phone has room for one voice at a time: the sitters take turns in the same slip, so it
                    // stays one line tall and the money under it stays in view.
                    <AnimatePresence mode="wait" initial={false}>
                      {talk.lines.slice(beat, beat + 1).map((l) => (
                        <motion.div key={beat} className={'td-say' + (beat ? ' answer turn' : '')} initial={state.settings.calm ? false : { opacity: 0, x: beat ? 10 : 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.35 }}>
                          <div className="who">{l.who}<span>{l.role}</span></div>
                          <p>“{l.text}”</p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  ) : talk.lines.map((l, i) => (
                    <motion.div key={i} className={'td-say' + (i ? ' answer' : '')} initial={state.settings.calm ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i ? 1.5 : 0, duration: 0.45 }}>
                      <div className="who">{l.who}<span>{l.role}</span></div>
                      <p>“{l.text}”</p>
                    </motion.div>
                  ))}
                  <div className="where">{talk.where}</div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
  );

  return (
    <div className="page td-page">
      {/* Candlelight: the room is lit from the painting, not evenly. */}
      <div className="td-light" aria-hidden />

      <div className="td-wall">
        {/* The painting is the hero; the money hangs beside it like its label. */}
        <figure className="td-art">
          <button className="td-plate" onClick={onPainting} aria-label={`${painting.title}. Open this month's chapter`}>
            <RestorationPlate painting={painting} r={r} seen={shownSeen} ratio={phone ? 3 / 2 : 4 / 5} drift={false} calm={state.settings.calm} lead={0.3} mark={seat} />
          </button>
          <figcaption className={"td-label-card" + (phone && talk && spoken === talk.key ? " speaking" : "")}>
            <i>{painting.title}</i>
            <span>{painting.artist}, {painting.year}</span>
            <span className="td-patches" aria-label={r.complete ? 'Finished' : `${r.restored} of ${PATCHES} strokes painted`}>
              {Array.from({ length: PATCHES }, (_, i) => <b key={i} className={i < r.restored ? 'on' : ''} />)}
            </span>
            <span className="td-count">{r.complete ? (phone ? 'Finished' : 'Finished. It hangs in your Gallery.') : phone ? `${r.restored} of ${PATCHES} painted` : `${r.restored} of ${PATCHES} painted · one per line`}</span>
            <button className="td-link" onClick={onPainting}>Open the chapter<Icon.right size={12} /></button>
          </figcaption>
          {phone && talkBlock}
        </figure>

        <div className="td-money">
          <header className="td-head">
            <div className="td-kicker">{dateInWords(now)}</div>
            <h1>{fresh ? <>Your money, <i>painted</i>.</> : <>Good <i>{greeting}</i>{first ? `, ${first}` : ''}.</>}</h1>
            {fresh && <p className="td-lede">Write what you spent or earned, the way you’d say it. Every line paints a stroke of the painting.</p>}
          </header>
          {!phone && talkBlock}

          {safe ? (
            <section className="td-hero" aria-label="Safe to spend">
              <div className="td-label">Safe to spend today</div>
              <Big text={m(safe.perDay)} />
              <div className="td-per">{safe.until ? <>a day, until pay {relDay(safe.until)}</> : <>a day, to the end of the month</>}</div>
              <dl className="td-work">
                <div><dt>Free after what’s due</dt><dd className="num">{m(safe.free)}</dd></div>
                <div><dt>{safe.until ? 'Days until pay' : 'Days left'}</dt><dd className="num">÷ {days}</dd></div>
              </dl>
              <button className="td-link" onClick={() => onAsk('How is safe to spend counted?')}>How is this counted?</button>
            </section>
          ) : !fresh ? (
            <section className="td-hero" aria-label="Today so far">
              <div className="td-label">Spent today</div>
              <Big text={m(spent)} />
              <p className="td-per">Tell me what you have and when you’re paid, and I’ll work out a daily amount.</p>
              <div className="td-chips">
                <button onClick={() => onFill('I have ')}>I have …</button>
                <button onClick={() => onFill('I get paid  on the ')}>I get paid … on the …</button>
              </div>
            </section>
          ) : null}

          {!fresh && <div className="td-house"><HousePlate state={state} dispatch={dispatch} /></div>}
        </div>
      </div>

      {!fresh && <FirstWeek state={state} />}

      {!fresh && todays.length === 0 && (evening || quietToday) && (
        <Sitting painting={painting} todays={todays} quiet={quietToday} calm={state.settings.calm} onWrite={() => onFill('')} onQuiet={setQuiet} />
      )}

      {phone && <InstallNudge lines={state.entries.length} />}

      <div className="td-book">
        <section className="td-section" aria-label="Today’s lines">
          <div className="td-h">
            <h2>Today</h2>
            {todays.length > 0 && <span className="num">{spent > 0 && <>out {m(spent)}</>}{spent > 0 && came > 0 && ' · '}{came > 0 && <>in {m(came)}</>}</span>}
          </div>
          {todays.length ? (
            <ul className="td-rows">
              <AnimatePresence initial={false}>
                {todays.slice(0, 6).map((e) => (
                  <motion.li key={e.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                    <button onClick={() => onEdit(e)}>
                      <span className="sw" style={{ background: cat(e.category).color }} aria-hidden />
                      <span className="l">{e.label}<small>{cat(e.category).name}</small></span>
                      <span className={'a num ' + e.dir}>{e.dir === 'in' ? '+' : '−'}{m(e.amount)}</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <div className="td-empty-row">
              <p className="td-empty">{fresh ? 'Try a line below, or write your own.' : quietToday ? 'A quiet day, kept.' : 'Nothing yet today.'}</p>
              {!fresh && !quietToday && !evening && <button className="chip td-quiet" onClick={() => setQuiet(true)}>Mark a quiet day</button>}
            </div>
          )}
          {todays.length > 0 && <button className="td-link" onClick={onLedger}>{todays.length > 6 ? `All ${todays.length} lines today` : 'Open the ledger'}<Icon.right size={12} /></button>}
        </section>

        {(coming.length > 0 || people.length > 0) && (
          <div className="td-side">
            {coming.length > 0 && (
              <section className="td-section" aria-label="Coming up">
                <div className="td-h"><h2>Coming <i>up</i></h2></div>
                <ul className="td-seals">
                  {coming.slice(0, 4).map((c) => (
                    <li key={c.key}>
                      <span className={'seal ' + c.dir} aria-hidden>{c.dir === 'in' ? '+' : c.kind === 'circle' ? '○' : '−'}</span>
                      <span className="l">{c.label}<small>{relDay(c.date, today)}</small></span>
                      <span className={'a num ' + c.dir}>{c.amount ? (c.dir === 'in' ? '+' : '') + m(c.amount) : ''}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {people.length > 0 && (
              <section className="td-section" aria-label="People">
                <div className="td-h"><h2>People</h2><button className="td-link" onClick={onPeople}>All<Icon.right size={12} /></button></div>
                <ul className="td-people">
                  {people.map((p) => (
                    <li key={p.name}>
                      <span className="initial" aria-hidden>{p.name[0]}</span>
                      <span className="l">{p.name}</span>
                      <span className={'a num ' + (p.net > 0 ? 'in' : 'out')}>{p.net > 0 ? `owes you ${m(p.net)}` : `you owe ${m(-p.net)}`}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The one loud number: the currency sign smaller and raised, the figure in old-style numerals. */
function Big({ text }: { text: string }) {
  const m = text.match(/^([^\d−-]*)(.*)$/);
  return <div className="td-big num">{m?.[1] && <span className="td-sign">{m[1].trim()}</span>}{m ? m[2] : text}</div>;
}

interface Coming { key: string; date: string; label: string; amount: number; dir: 'in' | 'out'; kind: 'routine' | 'pay' | 'circle' }
/** The next fortnight: routines, pay day, and your turn in a savings circle. */
function comingUp(s: State, today: string): Coming[] {
  const out: Coming[] = [];
  const routines = routinesOf(s);
  for (let i = 0; i <= 14; i++) {
    const d = addDays(today, i);
    for (const r of routines) {
      if (!occursOn(r, d)) continue;
      if (i === 0 && s.routineLog[routineKey(r, d)]) continue;
      out.push({ key: r.id + d, date: d, label: r.label ?? 'Routine', amount: r.amount ?? 0, dir: r.dir === 'in' ? 'in' : 'out', kind: 'routine' });
    }
  }
  const pay = nextIncome(s, today);
  if (pay && pay.date <= addDays(today, 31) && !out.some((x) => x.dir === 'in' && x.date === pay.date)) out.push({ key: 'pay' + pay.date, date: pay.date, label: pay.label, amount: pay.amount, dir: 'in', kind: 'pay' });
  for (const c of s.circles ?? []) {
    const st = circleStatus(c, s.entries, today);
    const next = st.schedule.find((x) => x.date >= today);
    if (next) out.push({ key: c.id + next.date, date: next.date, label: next.mine ? `${c.name}: your turn to take the pot` : `${c.name}: round ${next.round}`, amount: next.mine ? st.pot : c.contribution, dir: next.mine ? 'in' : 'out', kind: 'circle' });
  }
  // Show each routine once: its next date.
  const seen = new Set<string>();
  return out.sort((a, b) => a.date.localeCompare(b.date)).filter((x) => { const k = x.label + x.dir; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** The first week: three plain cards on what Today shows and why there is a painting. Gone once read. */
function FirstWeek({ state }: { state: State }) {
  const KEY = 'cg-guide-read';
  const [read, setRead] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const first = state.entries.reduce((a, e) => (e.date < a ? e.date : a), todayISO());
  const days = Math.round((Date.parse(todayISO()) - Date.parse(first)) / 864e5);
  if (read || days > 7) return null;
  const done = () => { setRead(true); try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } };
  return (
    <section className="fw" aria-label="How CashGlome works">
      <div className="fw-head"><b>How this works</b><button className="td-link" onClick={done}>Got it</button></div>
      <ol className="fw-cards">
        <li><b>Write it as you’d say it.</b><span>“lunch {ex(14, state.profile.currency)}, taxi {ex(12, state.profile.currency)}, got paid {ex(2400, state.profile.currency)}” in the bar below.</span></li>
        <li><b>The big number.</b><span>What you can spend each day and still cover what’s due.</span></li>
        <li><b>The painting.</b><span>Each line paints a stroke. Finished months hang in your Gallery.</span></li>
      </ol>
    </section>
  );
}
