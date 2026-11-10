import type { ReactNode } from 'react';
import { Icon } from './Icons';
import { ROMAN } from '../lib/analytics';
import { monthLabel } from '../lib/format';
import { useWindow } from './Desktop';

export type View = 'chapter' | 'shelf' | 'ledger' | 'plans' | 'collection';

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

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  month: string;
  setMonth: (m: string) => void;
  chapters: { month: string; title: string }[];
  counts: { ledger: number; stickers: string };
  name: string;
  rank: string;
  streak: number;
  onEdition: () => void;
  onSettings: () => void;
  wall?: string;
}

export function Sidebar(p: SidebarProps) {
  const win = useWindow();
  const Item = ({ v, icon, label, count }: { v: View; icon: ReactNode; label: string; count?: string | number }) => (
    <button className={'side-item' + (p.view === v ? ' on' : '')} onClick={() => p.setView(v)}>{icon}{label}{count !== undefined && <span className="count">{count}</span>}</button>
  );
  return (
    <aside className="sidebar glass drag">
      {p.wall && <div className="side-wall" style={{ backgroundImage: `url(${p.wall})` }} aria-hidden />}
      <div className="lights" onPointerDown={(e) => win?.startDrag(e)} onDoubleClick={() => win?.zoom()}><TrafficLights /></div>
      <div className="side-scroll nodrag">
        <div className="side-label">Story</div>
        <Item v="chapter" icon={<Icon.book size={17} />} label="This chapter" />
        <Item v="shelf" icon={<Icon.shelf size={17} />} label="All chapters" />
        <button className="side-item" onClick={p.onEdition}><Icon.play size={15} /> <span style={{ marginLeft: 2 }}>Play the Edition</span></button>
        <div className="side-label">Money</div>
        <Item v="ledger" icon={<Icon.list size={17} />} label="Ledger" count={p.counts.ledger} />
        <Item v="plans" icon={<Icon.flag size={17} />} label="Plans" />
        <Item v="collection" icon={<Icon.seal size={17} />} label="Gallery" count={p.counts.stickers} />
        <div className="side-label">Contents</div>
        {p.chapters.map((c) => (
          <button key={c.month} className={'toc' + (p.view === 'chapter' && p.month === c.month ? ' on' : '')} onClick={() => { p.setMonth(c.month); p.setView('chapter'); }} title={c.title}>
            <span>{monthLabel(c.month).split(' ')[0]}{c.month.slice(0, 4) !== String(new Date().getFullYear()) ? ` ’${c.month.slice(2, 4)}` : ''}</span>
            <span className="lead" />
            <span className="rn">{ROMAN[Number(c.month.slice(5, 7)) - 1]}</span>
          </button>
        ))}
      </div>
      <button className="me nodrag" onClick={p.onSettings}>
        <span className="avatar">{(p.name || 'Y').charAt(0).toUpperCase()}</span>
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || 'You'}</span>
          <span className="small" style={{ display: 'block', whiteSpace: 'nowrap' }}>{p.rank}, candle at {p.streak}</span>
        </span>
        <Icon.gear size={16} />
      </button>
    </aside>
  );
}

export function TabBar({ view, setView, onEdition }: { view: View; setView: (v: View) => void; onEdition: () => void }) {
  const B = ({ v, icon, label }: { v: View; icon: ReactNode; label: string }) => <button className={view === v ? 'on' : ''} onClick={() => setView(v)}>{icon}{label}</button>;
  return (
    <nav className="tabbar glass">
      <B v="chapter" icon={<Icon.book />} label="Chapter" />
      <B v="ledger" icon={<Icon.list />} label="Ledger" />
      <button onClick={onEdition}><Icon.play />Edition</button>
      <B v="plans" icon={<Icon.flag />} label="Plans" />
      <B v="collection" icon={<Icon.seal />} label="Gallery" />
    </nav>
  );
}
