import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { Icon } from './Icons';
import { monthLabel } from '../lib/format';
import { artSrc, NATIVE_TITLE, PAINTINGS } from '../lib/art';
import { useWindow } from './Desktop';
import { AppIcon } from './Logo';

/** The places, and the pages reached from them. 'accounts' is kept as another name for People. */
export type View = 'today' | 'ledger' | 'ask' | 'people' | 'chapter' | 'play' | 'shelf' | 'collection' | 'plans' | 'memory' | 'accounts';
export type Place = 'today' | 'ledger' | 'ask' | 'people' | 'plans' | 'chapter' | 'collection' | 'play';
/** Which place in the sidebar a page belongs to. */
export const placeOf = (v: View): Place => (v === 'shelf' ? 'chapter' : v === 'accounts' ? 'people' : v === 'memory' ? 'today' : v);
/** On a phone there are five tabs: the paintings (chapter, gallery, play) share one. */
export type Tab = 'today' | 'ledger' | 'ask' | 'people' | 'chapter';
export const tabOf = (v: View): Tab => { const p = placeOf(v); return p === 'collection' || p === 'play' ? 'chapter' : p === 'plans' ? 'today' : p; };

const isDesktop = !!window.glome?.isDesktop;
const isMacDesktop = isDesktop && window.glome?.platform === 'darwin';

export function TrafficLights() {
  const win = useWindow();
  if (!win && (!isDesktop || isMacDesktop)) return <div style={{ width: isMacDesktop ? 60 : 0 }} />;
  const api = win ?? { close: () => window.glome!.close(), minimize: () => window.glome!.minimize(), zoom: () => window.glome!.zoom() };
  return (
    <div className="traffic nodrag">
      <button className="t-close" aria-label="Close" onClick={api.close}><svg width="6" height="6" viewBox="0 0 6 6"><path d="M.6.6l4.8 4.8M5.4.6.6 5.4" stroke="#4d0000" strokeWidth="1.1" /></svg></button>
      <button className="t-min" aria-label="Minimise" onClick={api.minimize}><svg width="6" height="6" viewBox="0 0 6 6"><path d="M.4 3h5.2" stroke="#985600" strokeWidth="1.2" /></svg></button>
      <button className="t-zoom" aria-label="Zoom" onClick={api.zoom}><svg width="6" height="6" viewBox="0 0 6 6"><path d="M1 .8h3.6v3.6zM5 5.2H1.4V1.6z" fill="#006500" /></svg></button>
    </div>
  );
}

type PlaceItem = { v: Place; label: string; icon: (size: number) => ReactNode };
/** The sidebar, in the book's three acts: write it down, see it painted, ask about it. */
const ACTS: { act: string; places: PlaceItem[] }[] = [
  { act: 'Write', places: [
    { v: 'today', label: 'Today', icon: (z) => <Icon.sun size={z} /> },
    { v: 'ledger', label: 'Ledger', icon: (z) => <Icon.list size={z} /> },
    { v: 'people', label: 'People', icon: (z) => <Icon.person size={z} /> },
    { v: 'plans', label: 'Plans', icon: (z) => <Icon.flag size={z} /> },
  ] },
  { act: 'Ask', places: [{ v: 'ask', label: 'Ask Florin', icon: (z) => <Icon.ask size={z} /> }] },
  { act: 'See', places: [
    { v: 'chapter', label: 'Chapter', icon: (z) => <Icon.book size={z} /> },
    { v: 'collection', label: 'Gallery', icon: (z) => <Icon.seal size={z} /> },
    { v: 'play', label: 'Play', icon: (z) => <Icon.games size={z} /> },
  ] },
];
const TABS: { v: Tab; label: string; icon: (size: number) => ReactNode }[] = [
  { v: 'today', label: 'Today', icon: (z) => <Icon.sun size={z} /> },
  { v: 'ledger', label: 'Ledger', icon: (z) => <Icon.list size={z} /> },
  { v: 'ask', label: 'Ask', icon: (z) => <Icon.ask size={z} /> },
  { v: 'people', label: 'People', icon: (z) => <Icon.person size={z} /> },
  { v: 'chapter', label: 'Paintings', icon: (z) => <Icon.book size={z} /> },
];

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  month: string;
  setMonth: (m: string) => void;
  chapters: { month: string; title: string; numeral: string }[];
  counts: { ledger: number; play?: number };
  name: string;
  onEdition: () => void;
  /** Your book: name, currency, categories, routines, plans, backup, look and sound. */
  onBook: () => void;
  onMusic: () => void;
  /** Routines & memory, in Your book. */
  onRoutines: () => void;
  musicOn: boolean;
  /** What's playing, when something is (its name, for the line under Music). */
  musicName?: string;
  /** The painting hung in the sidebar (the wallpaper setting): a painting id. */
  wall?: string;
}

export function Sidebar(p: SidebarProps) {
  const win = useWindow();
  const place = placeOf(p.view);
  const Sub = ({ v, label, icon }: { v: View; label: string; icon: ReactNode }) => (
    <button className={'side-sub' + (p.view === v ? ' on' : '')} onClick={() => p.setView(v)}>{icon}{label}</button>
  );
  return (
    <aside className="sidebar glass drag">
      <div className="lights" onPointerDown={(e) => win?.startDrag(e)} onDoubleClick={() => win?.zoom()}><TrafficLights /></div>
      <div className="side-scroll nodrag">
        <div className="side-brand"><AppIcon size={34} style={{ borderRadius: 8 }} />CashGlome</div>
        {ACTS.map((g) => (
          <div key={g.act} className="side-act">
            <div className="side-label">{g.act}</div>
            {g.places.map((x) => (
          <div key={x.v}>
            <button className={'side-item place' + (place === x.v ? ' on' : '')} onClick={() => p.setView(x.v)} aria-current={place === x.v ? 'page' : undefined}>
              {x.icon(17)}{x.label}{x.v === 'ledger' && p.counts.ledger > 0 && <span className="count">{p.counts.ledger}</span>}{x.v === 'play' && !!p.counts.play && <span className="count new" title={`${p.counts.play} to find`}>{p.counts.play} to find</span>}
            </button>
            {x.v === 'chapter' && place === 'chapter' && (
              <div className="side-subs">
                <Sub v="chapter" label="This month" icon={<Icon.book size={14} />} />
                <Sub v="shelf" label="Past chapters" icon={<Icon.shelf size={14} />} />
              </div>
            )}
          </div>
        ))}
          </div>
        ))}
        <div className="side-act">
          <div className="side-label">Listen</div>
          <button className={'side-item place side-listen' + (p.musicOn ? ' on-air' : '')} onClick={p.onMusic} data-music aria-label={p.musicName ? `Music: playing ${p.musicName}` : 'Music'}>
            <Icon.music size={17} /><span className="side-music-t">Music{p.musicName && <small title={p.musicName}>{p.musicName}</small>}</span>{p.musicOn && <span className="music-live" aria-hidden />}
          </button>
        </div>
        {place === 'chapter' && p.chapters.length > 1 && (
          <>
            <div className="side-label">Contents</div>
            {p.chapters.map((c) => (
              <button key={c.month} className={'toc' + (p.view === 'chapter' && p.month === c.month ? ' on' : '')} onClick={() => { p.setMonth(c.month); p.setView('chapter'); }} title={c.title}>
                <span>{monthLabel(c.month).split(' ')[0]}{c.month.slice(0, 4) !== String(new Date().getFullYear()) ? ` ’${c.month.slice(2, 4)}` : ''}</span>
                <span className="lead" />
                <span className="rn">{c.numeral}</span>
              </button>
            ))}
          </>
        )}
        {p.wall && PAINTINGS[p.wall] && (
          <figure className="side-plate nodrag" aria-label={`On the wall: ${PAINTINGS[p.wall].title}, ${PAINTINGS[p.wall].artist}, ${PAINTINGS[p.wall].year}`}>
            <span className="side-plate-frame"><img src={artSrc(p.wall, 'sm')} alt="" loading="lazy" /></span>
            <figcaption>
              <span className="kick">On the wall</span>
              <i>{PAINTINGS[p.wall].title}</i>
              {NATIVE_TITLE[p.wall] && <span className="native">{NATIVE_TITLE[p.wall]}</span>}
              <span>{PAINTINGS[p.wall].artist}, {PAINTINGS[p.wall].year}</span>
            </figcaption>
          </figure>
        )}
      </div>
      <div className="side-book nodrag">
        <button className="side-music" onClick={p.onRoutines}><Icon.repeat size={15} />Routines &amp; memory</button>
      </div>
      <button className="me nodrag" onClick={p.onBook} aria-label="Your book: settings, categories, routines, music and your data">
        <span className="avatar">{(p.name || 'Y').charAt(0).toUpperCase()}</span>
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || 'Your book'}</span>
          <span className="small" style={{ display: 'block', whiteSpace: 'nowrap' }}>Your book: settings</span>
        </span>
        <Icon.right size={14} />
      </button>
    </aside>
  );
}

/** The five tabs along the bottom, labelled. Used on narrow windows and on phones. */
export function TabBar({ view, setView, className = 'tabbar glass' }: { view: View; setView: (v: View) => void; className?: string }) {
  const place = tabOf(view);
  return (
    <nav className={className} aria-label="Places">
      {TABS.map((x) => (
        <button key={x.v} className={place === x.v ? 'on' : ''} onClick={() => setView(x.v)} aria-current={place === x.v ? 'page' : undefined}>
          {x.icon(20)}<span>{x.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Where the room sign's brush stroke last sat, so the next one can glide from there even when the page is rebuilt.
 *  A second run for the same room within a moment (React re-running the effect) reuses the earlier starting point. */
type Spot = { x: number; w: number };
let lastStroke: { room: string; at: number; spot: Spot; from: Spot | null } | null = null;
function Stroke({ room }: { room: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const calm = useReducedMotionConfig();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    const r = el.getBoundingClientRect();
    const now = performance.now();
    const again = lastStroke && lastStroke.room === room && now - lastStroke.at < 150;
    const from = again ? lastStroke!.from : lastStroke?.spot ?? null;
    lastStroke = { room, at: now, spot: { x: r.left, w: r.width }, from };
    if (calm || !from || r.width < 1 || (Math.abs(from.x - r.left) < 1 && Math.abs(from.w - r.width) < 1)) return;
    el.animate(
      [{ transform: `translateX(${from.x - r.left}px) scaleX(${from.w / r.width})` }, { transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.22, 1.4, .36, 1)' },
    );
  }, [calm, room]);
  return (
    <svg ref={ref} className="ch-stroke" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
      <path d="M1.5 7.2C18 4.4 41 3.9 63 5c13 .6 25 1.4 35.5.4l-.4 3.3c-12 1.2-25 .3-38.5.2-20-.1-40 1.7-57.8 1.5z" />
    </svg>
  );
}

/** The Chapter's three rooms, and two ways to look at the month. */
export function ChapterTabs({ view, setView, onEdition, phone }: { view: View; setView: (v: View) => void; onEdition: () => void; onLiving?: () => void; phone?: boolean }) {
  const rooms: [View, string][] = [['chapter', 'This month'], ['shelf', 'Past chapters'], ...(phone ? ([['collection', 'Gallery'], ['play', 'Play']] as [View, string][]) : [])];
  return (
    <div className="ch-tabs">
      {/* Room signs: the room you're in is underlined by one brush stroke, which glides when you move. */}
      <div className="ch-seg" role="tablist" aria-label="Chapter">
        {rooms.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            <span>{label}</span>
            {view === v && <Stroke room={v} />}
          </button>
        ))}
      </div>
      {(view === 'chapter' || view === 'shelf') && <div className="ch-acts">
        <button onClick={onEdition} title="Your month as a short slideshow, to watch or share"><Icon.play size={12} />Month in review</button>
      </div>}
    </div>
  );
}
