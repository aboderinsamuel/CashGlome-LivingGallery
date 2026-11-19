import type { ReactNode } from 'react';
import { Icon } from './Icons';
import { ROMAN } from '../lib/analytics';
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
  { act: 'See', places: [
    { v: 'chapter', label: 'Chapter', icon: (z) => <Icon.book size={z} /> },
    { v: 'collection', label: 'Gallery', icon: (z) => <Icon.seal size={z} /> },
    { v: 'play', label: 'Play', icon: (z) => <Icon.games size={z} /> },
  ] },
  { act: 'Ask', places: [{ v: 'ask', label: 'Ask', icon: (z) => <Icon.ask size={z} /> }] },
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
  chapters: { month: string; title: string }[];
  counts: { ledger: number; play?: number };
  name: string;
  onEdition: () => void;
  /** Your book: name, currency, categories, routines, plans, backup, look and sound. */
  onBook: () => void;
  onMusic: () => void;
  /** Routines & memory, in Your book. */
  onRoutines: () => void;
  musicOn: boolean;
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
                <button className="side-sub" onClick={p.onEdition}><Icon.play size={14} />Play the Edition</button>
              </div>
            )}
          </div>
        ))}
          </div>
        ))}
        {place === 'chapter' && p.chapters.length > 1 && (
          <>
            <div className="side-label">Contents</div>
            {p.chapters.map((c) => (
              <button key={c.month} className={'toc' + (p.view === 'chapter' && p.month === c.month ? ' on' : '')} onClick={() => { p.setMonth(c.month); p.setView('chapter'); }} title={c.title}>
                <span>{monthLabel(c.month).split(' ')[0]}{c.month.slice(0, 4) !== String(new Date().getFullYear()) ? ` ’${c.month.slice(2, 4)}` : ''}</span>
                <span className="lead" />
                <span className="rn">{ROMAN[Number(c.month.slice(5, 7)) - 1]}</span>
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
        <button className={'side-music' + (p.musicOn ? ' on' : '')} onClick={p.onMusic}><Icon.music size={15} />Music{p.musicOn && <span className="music-live" aria-hidden />}</button>
      </div>
      <button className="me nodrag" onClick={p.onBook} aria-label="Your book: settings, categories, routines and backup">
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

/** The Chapter's three rooms, and two ways to look at the month. */
export function ChapterTabs({ view, setView, onEdition, onLiving, phone }: { view: View; setView: (v: View) => void; onEdition: () => void; onLiving: () => void; phone?: boolean }) {
  const T = ({ v, label }: { v: View; label: string }) => <button role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>;
  return (
    <div className="ch-tabs">
      <div className="ch-seg" role="tablist" aria-label="Chapter"><T v="chapter" label="This month" /><T v="shelf" label="Past chapters" />{phone && <><T v="collection" label="Gallery" /><T v="play" label="Play" /></>}</div>
      <div className="ch-acts">
        <button onClick={onLiving}><Icon.sun size={15} />See it alive</button>
        <button onClick={onEdition}><Icon.play size={12} />Play the Edition</button>
      </div>
    </div>
  );
}
