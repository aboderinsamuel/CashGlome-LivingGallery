// The phone app: one screen to write on, with the month's painting in front of you.
// Chapter · Ledger · Gallery along the bottom; everything else is one tap away in the More sheet.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { chapterOf, computeStats, spaceSegs, type Chapter as Ch } from '../lib/analytics';
import { paintingOf, PATCHES, restorationOf } from '../lib/art';
import { money, monthOf, shiftMonth, todayISO } from '../lib/format';
import { findAmounts } from '../lib/parser';
import { onDay } from '../lib/memory';
import type { Action } from '../lib/store';
import type { Entry, State } from '../lib/types';
import { Icon } from '../components/Icons';
import { RestorationPlate, revealTime } from '../components/Restoration';
import { ChapterTabs, TabBar, placeOf, type Place, type View } from '../components/Shell';
import { cardSeason, chipsFor, closeDay, dateInWords, dayClosed, monthName, partOfDay, promptFor, type CashPocket, type Chip } from './moments';
import { haptic } from './device';

export type PhonePage = 'read' | 'plans' | 'memory';

interface Props {
  state: State;
  dispatch: (a: Action) => void;
  view: View;
  setView: (v: View) => void;
  setMonth: (m: string) => void;
  museChapter?: { title: Ch['title']; lede: string } | null;
  /** The writing box, built by App (it owns saving). On every place but Ask, which has its own. */
  composer: ReactNode;
  pages: Record<'today' | 'ledger' | 'ask' | 'people' | 'play' | 'shelf' | 'collection' | PhonePage, ReactNode>;
  online: boolean;
  /** Your book: settings, categories, routines, plans, backup. */
  onBook: () => void;
  onEdition: () => void;
  onShare: () => void;
  /** The living painting, full size. */
  onLiving: () => void;
}

const PAGE_TITLE: Record<PhonePage, string> = { read: 'The chapter', plans: 'Plans', memory: 'Routines & memory' };
const PLACE_TITLE: Record<Place, string> = { today: 'Today', ledger: 'Ledger', ask: 'Ask', people: 'People', chapter: 'Chapter', play: 'Play' };

export function PhoneApp(p: Props) {
  const { state, view } = p;
  const [page, setPage] = useState<PhonePage | null>(null);
  const isNow = state.month === monthOf(todayISO());
  const place = placeOf(view);
  // Plans and routines arrive from Your book as pushed pages.
  const pushed: PhonePage | null = page ?? (view === 'plans' ? 'plans' : view === 'memory' ? 'memory' : null);
  const go = (v: View) => { haptic(); setPage(null); p.setView(v); };
  const back = () => { setPage(null); if (view === 'plans' || view === 'memory') p.setView('today'); };
  useEffect(() => { setPage(null); }, [state.month]);
  const months = place === 'ledger' || (place === 'chapter' && view === 'chapter');
  const first = state.profile.name?.split(' ')[0];

  return (
    <div className="ph-app">
      <header className="ph-top">
        {pushed ? (
          <>
            <button className="ph-back" onClick={back}><Icon.left size={18} /><span>Back</span></button>
            <span className="ph-top-title">{PAGE_TITLE[pushed]}</span>
            <span style={{ width: 64 }} aria-hidden />
          </>
        ) : (
          <>
            {months ? (
              <div className="ph-month">
                <button className="ph-icon sm" aria-label="Previous month" onClick={() => p.setMonth(shiftMonth(state.month, -1))}><Icon.left size={17} /></button>
                <span className="ph-month-name">{monthName(state.month)}{state.month.slice(0, 4) !== todayISO().slice(0, 4) ? ` ${state.month.slice(0, 4)}` : ''}</span>
                <button className="ph-icon sm" aria-label="Next month" disabled={isNow} onClick={() => !isNow && p.setMonth(shiftMonth(state.month, 1))}><Icon.right size={17} /></button>
                {!isNow && <button className="ph-today" onClick={() => p.setMonth(monthOf(todayISO()))}>Now</button>}
              </div>
            ) : (
              <span className="ph-place">{place === 'today' ? <span className="ph-brand">CashGlome</span> : PLACE_TITLE[place]}</span>
            )}
            {!p.online && <span className="ph-offline" role="status">Offline</span>}
            <span style={{ flex: 1 }} />
            <button className="ph-book" onClick={p.onBook} aria-label="Your book: settings, categories, routines and backup">
              <span className="ph-book-face" aria-hidden>{(first || 'Y').charAt(0).toUpperCase()}</span>
              <span>Your book</span>
            </button>
          </>
        )}
      </header>

      <main className="ph-main" key={pushed ?? view}>
        {pushed ? <div className="ph-page">{pushed === 'read' ? p.pages.read : p.pages[pushed]}</div>
          : place === 'chapter' ? (
            <>
              <ChapterTabs view={view} setView={go} onEdition={p.onEdition} onLiving={p.onLiving} />
              {view === 'chapter' ? <PhoneHome key={state.month} state={state} dispatch={p.dispatch} museChapter={p.museChapter} isNow={isNow} onRead={() => setPage('read')} onLedger={() => go('ledger')} onShare={p.onShare} onLiving={p.onLiving} />
                : <div className="ph-page">{view === 'shelf' ? p.pages.shelf : p.pages.collection}</div>}
            </>
          )
          : <div className="ph-page">{p.pages[place === 'people' ? 'people' : place]}</div>}
      </main>

      {!pushed && place !== 'ask' && p.composer}

      {!pushed && <TabBar view={view} setView={go} className="ph-tabs" />}
    </div>
  );
}

/* ——— Home: the title, the painting, one question ——— */
function PhoneHome({ state, dispatch, museChapter, isNow, onRead, onLedger, onShare, onLiving }: {
  state: State; dispatch: (a: Action) => void; museChapter?: { title: Ch['title']; lede: string } | null; isNow: boolean;
  onRead: () => void; onLedger: () => void; onShare: () => void; onLiving: () => void;
}) {
  const cur = state.profile.currency;
  const s = useMemo(() => computeStats(state.entries, state.month), [state.entries, state.month]);
  const local = chapterOf(state, s);
  const title = museChapter ? spaceSegs(museChapter.title) : local.title;
  const painting = paintingOf(s);
  const r = useMemo(() => restorationOf(state.entries, state.month, state.quiet), [state.entries, state.quiet, state.month]);
  const empty = !s.entries.length;

  // Patches cleaned since you last looked lift as the screen opens; ones you earn while here lift at once.
  const seen = state.seenRestored[state.month] ?? 0;
  const [shownSeen] = useState(seen);
  useEffect(() => {
    if (r.restored <= seen) return;
    const t = setTimeout(() => dispatch({ type: 'seenRestored', month: state.month, n: r.restored }), revealTime(r.restored - shownSeen) * 1000 + 300);
    return () => clearTimeout(t);
  }, [r.restored, seen, shownSeen, state.month, dispatch]);

  // The prompt follows the clock, not the moment the page was opened.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const [closed, setClosed] = useState(() => dayClosed());
  const today = todayISO(now);
  const writtenToday = useMemo(() => state.entries.filter((e) => e.date === today).length, [state.entries, today]);
  const part = partOfDay(now.getHours());
  const evening = part === 'evening' || part === 'night';
  const prompt = promptFor(part, writtenToday, closed);

  return (
    <div className="ph-home">
      <div className="ph-head">
        <div className="ph-kicker"><em>Chapter {local.numeral}</em><span>{isNow ? dateInWords(now) : `${monthName(state.month)} ${state.month.slice(0, 4)}`}</span></div>
        <motion.h1 className="ph-title" key={title.map((x) => x.t).join('')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
          {title.map((seg, i) => (seg.em ? <em key={i}>{seg.t}</em> : <span key={i}>{seg.t}</span>))}
        </motion.h1>
      </div>

      <figure className="ph-art">
        <button className="ph-plate" onClick={onLiving} aria-label={`${painting.title}: see it alive`}>
          <RestorationPlate painting={painting} r={r} seen={shownSeen} ratio={1} drift={false} calm={state.settings.calm} lead={0.25} />
        </button>
        <figcaption className="ph-label">
          <span className="ph-label-work"><i>{painting.title}</i>{painting.artist}, {painting.year}</span>
          <span className="ph-label-count num">{r.complete ? 'Restored' : `${r.restored} of ${PATCHES} cleaned`}</span>
        </figcaption>
      </figure>

      {!empty && (
        <button className="ph-sums num" onClick={onLedger} aria-label="Open the ledger">
          <span>In <b>{money(s.inflow, cur)}</b></span><i aria-hidden />
          <span>Out <b>{money(s.outflow, cur)}</b></span>
          <Icon.right size={13} />
        </button>
      )}

      {isNow ? (
        <div className="ph-prompt-row">
          <button className="ph-link" onClick={onRead}>Read the chapter</button>
          {evening && writtenToday > 0 && !closed && <button className="ph-link" onClick={() => { closeDay(); setClosed(true); haptic('done'); }}>That’s the day</button>}
        </div>
      ) : (
        <div className="ph-past">
          <button className="ph-btn" onClick={onRead}>Read the chapter</button>
          {!empty && <button className="ph-btn gilt" onClick={onShare}><Icon.share size={15} /> Share its card</button>}
        </div>
      )}
      {isNow && !empty && cardSeason(state.month, now) && (
        <button className="ph-card-ready" onClick={onShare}><Icon.share size={14} /> {monthName(state.month)} is nearly written. Its card is ready to share</button>
      )}
    </div>
  );
}

/* ——— One-tap chips, in the row above the box ——— */
export function Chips({ state, onRepeat, onFill }: { state: State; onRepeat: (e: Entry) => void; onFill: (text: string) => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 5 * 60000); return () => clearInterval(t); }, []);
  const chips = useMemo(() => chipsFor(state), [state, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chips.length) return null;
  const cur = state.profile.currency;
  const tap = (c: Chip) => { if (c.entry) onRepeat(c.entry); else if (c.fill) { haptic(); onFill(c.fill); } };
  return (
    <div className="ph-chips" role="group" aria-label="Quick entries">
      {chips.map((c) => (
        <button key={c.key} className={'ph-chip' + (c.entry ? ' usual' : '')} onMouseDown={(e) => e.preventDefault()} onClick={() => tap(c)} title={c.entry ? `Write ${c.label} again, for today` : `Start with ${c.label}`}>
          {c.label}{c.entry && <b className="num">{money(c.entry.amount, cur)}</b>}
        </button>
      ))}
    </div>
  );
}

/* ——— Cash by balance: one question, a day or more after a withdrawal ——— */
export function CashCard({ pocket, cur, onAnswer, onLater }: { pocket: CashPocket; cur: string; onAnswer: (left: number) => void; onLater: () => void }) {
  const [v, setV] = useState('');
  const left = v.trim() ? (findAmounts(v)[0]?.value ?? (Number(v.replace(/,/g, '')) || 0)) : null;
  const tooMuch = left !== null && left > pocket.left;
  return (
    <motion.div className="ph-cash" role="group" aria-label="Cash check-in" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
      <p>You took out <b className="num">{money(pocket.amount, cur)}</b> in cash {onDay(pocket.date)}{pocket.left < pocket.amount ? <>, and had <b className="num">{money(pocket.left, cur)}</b> left last time</> : null}. How much is left now?</p>
      <form onSubmit={(e) => { e.preventDefault(); if (left !== null && !tooMuch) onAnswer(left); }}>
        <input className="num" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={money(pocket.left / 2, cur)} aria-label="Cash left" aria-invalid={tooMuch} />
        <button className="ph-btn gilt" disabled={left === null || tooMuch}>Write the rest</button>
      </form>
      {tooMuch
        ? <small className="warn" role="alert">That is more than you had. Check the number.</small>
        : <small>{left !== null ? <>That files <b className="num">{money(pocket.left - left, cur)}</b> as cash spending.</> : 'The gap goes down as cash spending.'}</small>}
      <div className="ph-cash-quick">
        <button onClick={() => onAnswer(0)}>All gone</button>
        <button onClick={() => onAnswer(pocket.left)}>All still here</button>
        <button onClick={onLater}>Ask tomorrow</button>
      </div>
    </motion.div>
  );
}
