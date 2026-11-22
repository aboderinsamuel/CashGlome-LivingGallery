import { AnimatePresence, motion, useDragControls, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react';
import { dayCardOf, paintingOf, restorationOf, seasonalWallpaper, artSrc, PAINTINGS } from '../lib/art';
import { computeStats } from '../lib/analytics';
import { money, monthOf, todayISO } from '../lib/format';
import type { State } from '../lib/types';
import { LivingArt } from './LivingArt';
import { AppIcon, LilyGlyph } from './Logo';
import { RestorationPlate } from './Restoration';
import { Icon } from './Icons';

/* ——— The window a view lives in, so traffic lights and the toolbar can move and resize it ——— */
interface WinApi { close: () => void; minimize: () => void; zoom: () => void; startDrag: (e: RPointerEvent) => void }
const WinCtx = createContext<WinApi | null>(null);
export const useWindow = () => useContext(WinCtx);

/** Wide screens in a browser get a whole desktop: wallpaper, menu bar, widgets, a window and a dock. */
export function useDesktopMode() {
  // A wide browser hangs the app on a painted wall (see GalleryWall). ?desk shows the old painted desktop in development.
  const test = () => (import.meta.env.DEV && location.search.includes('desk')) || !window.glome?.isDesktop && window.innerWidth >= 1100 && window.innerHeight >= 680 && !window.matchMedia?.('(pointer: coarse)').matches;
  const [on, setOn] = useState(test);
  useEffect(() => { const r = () => setOn(test()); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  return on;
}

/** The old painted desktop (menu bar, dock), kept for development with ?desk. */
export const deskOS = () => import.meta.env.DEV && location.search.includes('desk');

/**
 * On a wide browser the app hangs on a wall: the season's painting behind it, the app in a gilt-edged
 * frame, the widgets beside it on very wide screens, and a museum label for the wall. No pretend computer.
 */
export function GalleryWall({ state, onOpen, children }: { state: State; onOpen: (t: DockTarget) => void; children: ReactNode }) {
  const wall = !state.settings.wallpaper || state.settings.wallpaper === 'season' ? seasonalWallpaper() : state.settings.wallpaper;
  const art = PAINTINGS[wall];
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  useEffect(() => { const r = () => { setVw(window.innerWidth); setVh(window.innerHeight); }; window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const widgets = vw >= 1500;
  const w = Math.min(1240, vw - 200 - (widgets ? 264 : 0));
  const h = Math.min(900, vh - 84);
  const left = widgets ? Math.max(40, (vw - 264 - w) / 2) : (vw - w) / 2;
  const top = Math.max(28, (vh - h - 28) / 2);
  return (
    <div className="desk wall">
      <LivingArt id={wall} sizes="100vw" drift={false} dust={false} light={false} calm={state.settings.calm} className="desk-wall" style={{ position: 'absolute', inset: 0 }} shade="linear-gradient(rgba(14,10,6,.18), transparent 22%, transparent 70%, rgba(14,10,6,.42))" />
      {widgets && <Widgets state={state} calm={state.settings.calm} onOpen={onOpen} top={top} />}
      <motion.div className="win wall-win" style={{ left, top, width: w, height: h }} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 30 }}>
        {children}
      </motion.div>
      {art && <div className="wall-label" style={{ left, top: top + h + 8 }}><i>{art.title}</i> · {art.artist}, {art.year}</div>}
    </div>
  );
}

export type MenuItem = { label: string; kbd?: string; action?: () => void; disabled?: boolean; checked?: boolean } | 'sep';
export interface Menu { title: string; items: MenuItem[] }
export type DockTarget = 'app' | 'ledger' | 'edition' | 'gallery' | 'plans' | 'settings';

interface Props {
  state: State;
  menus: Menu[];
  aiOn: boolean;
  onDock: (t: DockTarget) => void;
  active: DockTarget;
  children: ReactNode;
}

export function Desktop({ state, menus, aiOn, onDock, active, children }: Props) {
  const calm = state.settings.calm;
  const wall = !state.settings.wallpaper || state.settings.wallpaper === 'season' ? seasonalWallpaper() : state.settings.wallpaper;
  const [mode, setMode] = useState<'open' | 'min' | 'closed'>('open');
  const [zoomed, setZoomed] = useState(false);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  useEffect(() => { const r = () => { setVw(window.innerWidth); setVh(window.innerHeight); }; window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const drag = useDragControls();
  const x = useMotionValue(0), y = useMotionValue(0);

  const widgets = vw >= 1500;
  const MB = 30, DOCK = 84;
  const w = zoomed ? vw - 16 : Math.min(1320, vw - 64 - (widgets ? 264 : 0));
  const h = zoomed ? vh - MB - DOCK - 8 : Math.min(900, vh - MB - DOCK - 36);
  const left = zoomed ? 8 : 32;
  const top = zoomed ? MB + 6 : MB + 18 + Math.max(0, (vh - MB - DOCK - 36 - h) / 2);

  const api = useMemo<WinApi>(() => ({
    close: () => setMode('closed'),
    minimize: () => setMode('min'),
    zoom: () => { x.set(0); y.set(0); setZoomed((z) => !z); },
    startDrag: (e) => { if (zoomed || (e.target as HTMLElement).closest('button, input, select, textarea, a, .nodrag')) return; drag.start(e); },
  }), [zoomed, drag, x, y]);

  const reopen = () => { setMode('open'); };
  const dock = (t: DockTarget) => { if (mode !== 'open') reopen(); onDock(t); };

  return (
    <div className="desk">
      {/* Still while the window covers it: anything moving behind frosted glass makes the blur redraw every frame. */}
      <LivingArt id={wall} sizes="100vw" drift={mode !== 'open'} dust={mode !== 'open'} light={mode !== 'open'} calm={calm} className="desk-wall" style={{ position: 'absolute', inset: 0 }} shade="linear-gradient(rgba(14,10,6,.25), transparent 18%, transparent 75%, rgba(14,10,6,.3))" />

      <MenuBar aiOn={aiOn} state={state} onOpen={reopen} menus={(() => {
        const win: Menu = { title: 'Window', items: [
          { label: 'Minimise', action: () => setTimeout(api.minimize, 0), disabled: mode !== 'open' },
          { label: zoomed ? 'Restore size' : 'Zoom', action: api.zoom },
          'sep',
          { label: 'CashGlome', checked: mode === 'open', action: reopen },
        ] };
        const i = menus.findIndex((m) => m.title === 'Help');
        return i < 0 ? [...menus, win] : [...menus.slice(0, i), win, ...menus.slice(i)];
      })()} />

      {widgets && <Widgets state={state} calm={calm} onOpen={(t) => dock(t)} />}

      <AnimatePresence>
        {mode !== 'closed' && (
          <motion.div key="win" className="win" drag={!zoomed} dragControls={drag} dragListener={false} dragMomentum={false}
            dragConstraints={{ left: -left + 8 - w + 160, right: vw - left - 160, top: -top + MB, bottom: vh - top - 120 }}
            style={{ x, y, transformOrigin: '50% 100%', pointerEvents: mode === 'min' ? 'none' : undefined }}
            initial={{ opacity: 0, scale: 0.9, left, top: top + 40, width: w, height: h }}
            animate={mode === 'min'
              ? { opacity: 0, scale: 0.1, top: vh - 60, left: vw / 2 - w / 2 - x.get(), transition: { duration: 0.45, ease: [0.5, 0, 0.75, 0] } }
              : { opacity: 1, scale: 1, left, top, width: w, height: h, transition: { type: 'spring', stiffness: 260, damping: 32 } }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.22 } }}
          >
            <WinCtx.Provider value={api}>{children}</WinCtx.Provider>
          </motion.div>
        )}
      </AnimatePresence>

      <Dock state={state} active={mode === 'open' ? active : null} running={mode !== 'closed'} onClick={dock} />
    </div>
  );
}

/* ——— Menu bar ——— */
function MenuBar({ menus, aiOn, state, onOpen }: { menus: Menu[]; aiOn: boolean; state: State; onOpen: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (open === null) return;
    const away = (e: MouseEvent) => { if (!bar.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('mousedown', away); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  const all: Menu[] = [{ title: '', items: menus[0]?.items ?? [] }, ...menus.slice(1)];
  return (
    <div className="menubar" ref={bar}>
      {all.map((m, i) => (
        <div key={i} className={'mb-item' + (open === i ? ' open' : '') + (i === 1 ? ' strong' : '')}
          onMouseDown={() => setOpen(open === i ? null : i)} onMouseEnter={() => open !== null && setOpen(i)}>
          {i === 0 ? <LilyGlyph size={15} /> : m.title}
          {open === i && (
            <div className="mb-menu" onMouseDown={(e) => e.stopPropagation()}>
              {m.items.map((it, j) => it === 'sep' ? <hr key={j} /> : (
                <button key={j} disabled={it.disabled} onClick={() => { setOpen(null); onOpen(); it.action?.(); }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 12, display: 'inline-block' }}>{it.checked ? '✓' : ''}</span>{it.label}</span>
                  {it.kbd && <span className="kbd">{it.kbd}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <span style={{ flex: 1 }} />
      <span className="mb-item" title={aiOn ? 'Florin connected' : 'Reading on this device'}><span style={{ width: 6, height: 6, borderRadius: 3, background: aiOn ? '#7BE0AE' : 'rgba(255,255,255,.55)' }} />Florin</span>
      <span className="mb-item num">{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}&nbsp;&nbsp;{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

/* ——— Dock with magnification ——— */
const DOCK_ITEMS: { id: DockTarget; label: string }[] = [
  { id: 'app', label: 'CashGlome' }, { id: 'ledger', label: 'Ledger' }, { id: 'edition', label: 'The Edition' }, { id: 'gallery', label: 'Gallery' }, { id: 'plans', label: 'Plans' },
];
function Dock({ state, active, running, onClick }: { state: State; active: DockTarget | null; running: boolean; onClick: (t: DockTarget) => void }) {
  const mouseX = useMotionValue(Infinity);
  const painting = useMemo(() => paintingOf(computeStats(state.entries, monthOf(todayISO()))), [state.entries]);
  return (
    <motion.div className="dock" onMouseMove={(e) => mouseX.set(e.clientX)} onMouseLeave={() => mouseX.set(Infinity)}
      initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 26, delay: 0.2 }}>
      {DOCK_ITEMS.map((d) => (
        <DockItem key={d.id} mouseX={mouseX} label={d.label} dot={d.id === 'app' ? running : false} on={active === d.id} onClick={() => onClick(d.id)}>
          <DockIcon id={d.id} painting={painting.id} />
        </DockItem>
      ))}
      <span className="dock-sep" />
      <DockItem mouseX={mouseX} label="Settings" onClick={() => onClick('settings')}><DockIcon id="settings" painting={painting.id} /></DockItem>
    </motion.div>
  );
}

function DockItem({ mouseX, label, dot, on, onClick, children }: { mouseX: MotionValue<number>; label: string; dot?: boolean; on?: boolean; onClick: () => void; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const dist = useTransform(mouseX, (v) => { const b = ref.current?.getBoundingClientRect(); return b ? v - b.x - b.width / 2 : Infinity; });
  const size = useSpring(useTransform(dist, [-170, 0, 170], [54, 82, 54]), { mass: 0.1, stiffness: 180, damping: 13 });
  const [hover, setHover] = useState(false);
  const [bounce, setBounce] = useState(0);
  return (
    <div className="dock-item">
      <AnimatePresence>{hover && <motion.span className="dock-tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>{label}</motion.span>}</AnimatePresence>
      <motion.button ref={ref} aria-label={label} style={{ width: size, height: size }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        animate={{ y: bounce ? [0, -22, 0, -10, 0] : 0 }} transition={{ duration: 0.7 }} onClick={() => { setBounce((b) => b + 1); onClick(); setTimeout(() => setBounce(0), 700); }}>
        {children}
      </motion.button>
      <span className="dock-dot" style={{ opacity: dot || on ? 1 : 0 }} />
    </div>
  );
}

/** Dock icons drawn in the same gilt-and-pigment language as the app icon. */
function DockIcon({ id, painting }: { id: DockTarget; painting: string }) {
  if (id === 'app') return <AppIcon size={256} style={{ width: '100%', height: '100%' }} />;
  const base: React.CSSProperties = { width: '100%', height: '100%', borderRadius: '22.5%', position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,.35), 0 6px 14px -6px rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' };
  if (id === 'gallery') return (
    <span style={{ ...base, background: 'linear-gradient(160deg, #5A2A26, #2E1A18)' }}>
      <span style={{ width: '62%', height: '72%', padding: '5%', background: 'linear-gradient(135deg, #F3D98B, #B08A3A 45%, #7A5413 75%, #E2C27A)', boxShadow: '0 4px 8px rgba(0,0,0,.5)' }}>
        <span style={{ display: 'block', width: '100%', height: '100%', backgroundImage: `url(${artSrc(painting, 'sm')})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      </span>
    </span>
  );
  if (id === 'ledger') return (
    <span style={{ ...base, background: 'linear-gradient(160deg, #3F8460, #1F4A33)' }}>
      <svg viewBox="0 0 64 64" width="70%" height="70%"><rect x="14" y="8" width="36" height="48" rx="3" fill="#F3EAD3" /><rect x="14" y="8" width="7" height="48" fill="#C8402A" opacity=".85" />
        {[18, 25, 32, 39, 46].map((yy) => <line key={yy} x1="25" x2="45" y1={yy} y2={yy} stroke="#7A6A52" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />)}
        <circle cx="44" cy="46" r="7" fill="#E2C27A" stroke="#B08A3A" strokeWidth="1.5" /></svg>
    </span>
  );
  if (id === 'edition') return (
    <span style={{ ...base, background: 'linear-gradient(160deg, #A33A2A, #5C1A12)' }}>
      <svg viewBox="0 0 64 64" width="72%" height="72%"><path d="M8 16c8-3 16-3 24 2v34c-8-5-16-5-24-2z" fill="#F3EAD3" /><path d="M56 16c-8-3-16-3-24 2v34c8-5 16-5 24-2z" fill="#E8DCC0" />
        <path d="M27 28l10 6-10 6z" fill="#A33A2A" transform="translate(-10 0)" /><line x1="38" x2="51" y1="26" y2="24" stroke="#7A6A52" strokeWidth="1.5" /><line x1="38" x2="51" y1="32" y2="30" stroke="#7A6A52" strokeWidth="1.5" /><line x1="38" x2="48" y1="38" y2="36.5" stroke="#7A6A52" strokeWidth="1.5" /></svg>
    </span>
  );
  if (id === 'plans') return (
    <span style={{ ...base, background: 'linear-gradient(160deg, #3D55C9, #1B2A66)' }}>
      <svg viewBox="0 0 64 64" width="70%" height="70%"><circle cx="32" cy="32" r="22" fill="none" stroke="#E2C27A" strokeWidth="2" /><circle cx="32" cy="32" r="3" fill="#E2C27A" />
        <path d="M32 12 L36 32 L32 52 L28 32Z" fill="#F3EAD3" /><path d="M32 12 L36 32 L28 32Z" fill="#C8402A" /><text x="32" y="10" fontSize="7" textAnchor="middle" fill="#E2C27A" fontFamily="serif">N</text></svg>
    </span>
  );
  return (
    <span style={{ ...base, background: 'linear-gradient(160deg, #9A9387, #5F594F)' }}>
      <Icon.gear size={30} />
    </span>
  );
}

/* ——— Desktop widgets ——— */
function Widgets({ state, calm, onOpen, top = 48 }: { state: State; calm: boolean; onOpen: (t: DockTarget) => void; top?: number }) {
  const month = monthOf(todayISO());
  const s = useMemo(() => computeStats(state.entries, month), [state.entries, month]);
  const r = useMemo(() => restorationOf(state.entries, month, state.quiet), [state.entries, state.quiet, month]);
  const card = useMemo(() => dayCardOf(state), [state]);
  const painting = paintingOf(s);
  const cur = state.profile.currency;
  // Every widget says, in words, where it opens: a plain line at its foot, always visible.
  const W = (p: { children: ReactNode; d: number; go: string; onClick?: () => void; style?: React.CSSProperties }) => (
    <motion.button className="widget w-open" onClick={p.onClick} style={p.style} aria-label={p.go} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + p.d * 0.08, type: 'spring', stiffness: 200, damping: 24 }}>
      {p.children}
      <span className="w-foot" aria-hidden>{p.go}<Icon.right size={12} /></span>
    </motion.button>
  );
  return (
    <div style={{ position: 'absolute', right: 24, top, width: 224, display: 'grid', gap: 14, zIndex: 2 }}>
      <W d={1} go="Open the painting" onClick={() => onOpen('app')} style={{ padding: 12 }}>
        <div style={{ ['--card' as string]: 'rgba(0,0,0,0)' }}><RestorationPlate painting={painting} r={r} seen={r.restored} drift={false} ratio={16 / 11} calm /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 8, alignItems: 'baseline' }}>
          <span style={{ font: 'italic 400 13.5px/1.2 var(--serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{painting.title}</span>
          <span style={{ font: '500 11px var(--ui)', opacity: 0.8, whiteSpace: 'nowrap' }}>{r.complete ? 'Finished' : `${r.restored} of 30 painted`}</span>
        </div>
      </W>
      <W d={2} go="Open the ledger" onClick={() => onOpen('ledger')}>
        <span className="wl">This month</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <span><span style={{ display: 'block', font: '500 11px var(--ui)', opacity: 0.7 }}>In</span><span className="num" style={{ font: '360 22px var(--serif)', color: '#F1D99A' }}>{money(s.inflow, cur, { compact: true })}</span></span>
          <span><span style={{ display: 'block', font: '500 11px var(--ui)', opacity: 0.7 }}>Out</span><span className="num" style={{ font: '360 22px var(--serif)' }}>{money(s.spend, cur, { compact: true })}</span></span>
        </div>
      </W>
      {card && (
        <W d={3} go="Open Today" onClick={() => onOpen('app')}>
          <span className="wl">Today's card</span>
          <div style={{ font: '360 19px/1.15 var(--serif)', marginTop: 8 }}>{card.title}</div>
          <div style={{ font: '400 12px/1.4 var(--ui)', opacity: 0.78, marginTop: 6 }}>{card.line}</div>
        </W>
      )}
    </div>
  );
}
