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
import type { View } from '../components/Shell';
import { cardSeason, chipsFor, closeDay, dateInWords, dayClosed, monthName, partOfDay, promptFor, type CashPocket, type Chip } from './moments';
import { haptic } from './device';

export type PhonePage = 'read' | 'plans' | 'memory' | 'shelf';

interface Props {
  state: State;
  dispatch: (a: Action) => void;
  view: View;
  setView: (v: View) => void;
  setMonth: (m: string) => void;
  museChapter?: { title: Ch['title']; lede: string } | null;
  /** The writing box, built by App (it owns saving). Shown on today's chapter only. */
  composer: ReactNode;
  pages: Record<'ledger' | 'collection' | PhonePage, ReactNode>;
  online: boolean;
  /** Back to the living painting. */
  onHome: () => void;
  onAsk: () => void;
  onEdition: () => void;
  onShare: () => void;
  onSettings: () => void;
  onMusic: () => void;
}

const PAGE_TITLE: Record<PhonePage, string> = { read: 'The chapter', plans: 'Plans', memory: 'Routines & memory', shelf: 'All chapters' };
const sheetSpring = { type: 'spring', stiffness: 380, damping: 36 } as const;

export function PhoneApp(p: Props) {
  const { state, view } = p;
  const [more, setMore] = useState(false);
  const [page, setPage] = useState<PhonePage | null>(null);
  const isNow = state.month === monthOf(todayISO());
  const tab: 'chapter' | 'ledger' | 'collection' = view === 'ledger' ? 'ledger' : view === 'collection' ? 'collection' : 'chapter';
  // Views the desktop reaches from its sidebar arrive here as pushed pages.
  const pushed: PhonePage | null = page ?? (view === 'plans' ? 'plans' : view === 'memory' ? 'memory' : view === 'shelf' ? 'shelf' : null);
  const go = (v: 'chapter' | 'ledger' | 'collection') => { haptic(); setPage(null); p.setView(v); };
  const back = () => { setPage(null); if (view === 'plans' || view === 'memory' || view === 'shelf') p.setView('chapter'); };
  const open = (pg: PhonePage) => { setMore(false); setPage(pg); };
  useEffect(() => { setPage(null); }, [state.month]);

  return (
    <div className="ph-app">
      <header className="ph-top">
        {pushed ? (
          <>
            <button className="ph-icon" onClick={back} aria-label="Back"><Icon.left size={20} /></button>
            <span className="ph-top-title">{PAGE_TITLE[pushed]}</span>
            <span className="ph-icon" aria-hidden />
          </>
        ) : (
          <>
            <div className="ph-month">
              <button className="ph-icon sm" aria-label="Previous month" onClick={() => p.setMonth(shiftMonth(state.month, -1))}><Icon.left size={17} /></button>
              <button className="ph-month-name" onClick={() => open('shelf')} aria-label="All chapters">{monthName(state.month)}{state.month.slice(0, 4) !== todayISO().slice(0, 4) ? ` ${state.month.slice(0, 4)}` : ''}</button>
              <button className="ph-icon sm" aria-label="Next month" disabled={isNow} onClick={() => !isNow && p.setMonth(shiftMonth(state.month, 1))}><Icon.right size={17} /></button>
              {!isNow && <button className="ph-today" onClick={() => p.setMonth(monthOf(todayISO()))}>Today</button>}
            </div>
            {!p.online && <span className="ph-offline" role="status">Offline</span>}
            <span style={{ flex: 1 }} />
            <button className="ph-icon" onClick={p.onAsk} aria-label="Ask about your money"><Icon.ask size={19} /></button>
            <button className="ph-icon" onClick={() => setMore(true)} aria-label="More" aria-expanded={more}><MoreGlyph /></button>
          </>
        )}
      </header>

      <main className="ph-main" key={pushed ?? tab}>
        {pushed ? <div className="ph-page">{p.pages[pushed]}</div>
          : tab === 'chapter' ? <PhoneHome key={state.month} state={state} dispatch={p.dispatch} museChapter={p.museChapter} isNow={isNow} onRead={() => open('read')} onLedger={() => go('ledger')} onShare={p.onShare} />
          : <div className="ph-page">{p.pages[tab]}</div>}
      </main>

      {!pushed && tab === 'chapter' && isNow && p.composer}

      {!pushed && (
        <nav className="ph-tabs" aria-label="Sections">
          <button onClick={p.onHome}><Icon.sun size={20} /><span>Today</span></button>
          <button className={tab === 'chapter' ? 'on' : ''} onClick={() => go('chapter')}><Icon.book size={20} /><span>Chapter</span></button>
          <button className={tab === 'ledger' ? 'on' : ''} onClick={() => go('ledger')}><Icon.list size={20} /><span>Ledger</span></button>
          <button className={tab === 'collection' ? 'on' : ''} onClick={() => go('collection')}><Icon.seal size={20} /><span>Gallery</span></button>
        </nav>
      )}

      <AnimatePresence>
        {more && (
          <motion.div className="ph-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div className="ph-sheet" role="dialog" aria-label="More" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={sheetSpring} onClick={(e) => e.stopPropagation()}>
              <div className="ph-grab" aria-hidden />
              <Row icon={<Icon.book size={19} />} title="Read the chapter" sub="Where it went, day by day, and how it felt" onClick={() => open('read')} />
              <Row icon={<Icon.play size={17} />} title="Play the Edition" sub="The month as a short story, in seven parts" onClick={() => { setMore(false); p.onEdition(); }} />
              <Row icon={<Icon.share size={18} />} title="Share this chapter" sub="The painting and its title. Amounts stay hidden" onClick={() => { setMore(false); p.onShare(); }} />
              <div className="ph-rule" />
              <Row icon={<Icon.flag size={18} />} title="Plans" sub="What the month could turn into" onClick={() => open('plans')} />
              <Row icon={<Icon.quill size={18} />} title="Routines & memory" sub="Things that write themselves, and what you’ve told it" onClick={() => open('memory')} />
              <div className="ph-rule" />
              <Row icon={<Icon.music size={18} />} title="Music" onClick={() => { setMore(false); p.onMusic(); }} />
              <Row icon={<Icon.gear size={18} />} title="Settings" onClick={() => { setMore(false); p.onSettings(); }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MoreGlyph = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 6.5h12M4 10h12M4 13.5h7" /></svg>;

function Row({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub?: string; onClick: () => void }) {
  return (
    <button className="ph-row" onClick={onClick}>
      <span className="ph-row-icon">{icon}</span>
      <span className="ph-row-text"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      <Icon.right size={15} />
    </button>
  );
}

/* ——— Home: the title, the painting, one question ——— */
function PhoneHome({ state, dispatch, museChapter, isNow, onRead, onLedger, onShare }: {
  state: State; dispatch: (a: Action) => void; museChapter?: { title: Ch['title']; lede: string } | null; isNow: boolean;
  onRead: () => void; onLedger: () => void; onShare: () => void;
}) {
  const cur = state.profile.currency;
  const s = useMemo(() => computeStats(state.entries, state.month), [state.entries, state.month]);
  const local = chapterOf(state, s);
  const title = museChapter ? spaceSegs(museChapter.title) : local.title;
  const painting = paintingOf(s);
  const r = useMemo(() => restorationOf(state.entries, state.month), [state.entries, state.month]);
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
        <button className="ph-plate" onClick={onRead} aria-label={`${painting.title}. Read the chapter`}>
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
          <p className="ph-prompt" key={prompt}>{prompt}</p>
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
