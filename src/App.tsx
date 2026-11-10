import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGlomeStore, toEntry } from './lib/store';
import { aiEnabled, readMoney } from './lib/ai';
import { badgesOf, chapterOf, computeStats, levelOf, xpOf } from './lib/analytics';
import { museChapter, type MuseChapter } from './lib/muse-story';
import { cat } from './lib/categories';
import { demoEntries } from './lib/demo';
import { artSrc, candleOf, isGilded, paintingOf, restorationOf, seasonalWallpaper } from './lib/art';
import { money, monthLabel, monthOf, shiftMonth, todayISO } from './lib/format';
import { setSound, sfx } from './lib/sound';
import type { Entry, Parsed } from './lib/types';
import { prunePictures, savePicture, pictureURL } from './lib/images';
import { Sidebar, TabBar, type View } from './components/Shell';
import { Composer, type ComposerHandle, type Notice } from './components/Composer';
import { Desktop, useDesktopMode, useWindow, type DockTarget, type Menu } from './components/Desktop';
import { StickerDefs } from './components/Stickers';
import { CaptureSheet, type CaptureDone } from './components/CaptureSheet';
import { Icon } from './components/Icons';
import { Chapter } from './views/Chapter';
import { Shelf } from './views/Shelf';
import { Ledger } from './views/Ledger';
import { Plans } from './views/Plans';
import { Collection } from './views/Collection';
import { SettingsSheet } from './views/Settings';
import { Edition } from './views/Edition';
import { Welcome } from './views/Welcome';

const TITLES: Record<View, string> = { chapter: 'Chapter', shelf: 'All chapters', ledger: 'Ledger', plans: 'Plans', collection: 'Gallery' };
const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || window.glome?.platform === 'darwin';
const kbd = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`);
type Pane = 'general' | 'appearance' | 'muse' | 'data' | 'about';

export default function App() {
  const [state, dispatch] = useGlomeStore();
  const [view, setViewRaw] = useState<View>('chapter');
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [settings, setSettingsPane] = useState<Pane | null>(null);
  const [edition, setEdition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [capture, setCapture] = useState<{ file: Blob | null; attach?: Entry } | null>(null);
  const [muse, setMuse] = useState<Record<string, { key: string; ch: MuseChapter }>>({});
  const composer = useRef<ComposerHandle>(null);
  const main = useRef<HTMLDivElement>(null);
  const cur = state.profile.currency;
  const ai = aiEnabled(state.settings);
  const desk = useDesktopMode();
  const openSettings = useCallback((p: Pane = 'general') => setSettingsPane(p), []);

  // ——— Theme & sound ———
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq?.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  const theme = state.settings.theme === 'auto' || !state.settings.theme ? (systemDark ? 'dark' : 'light') : state.settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14110D' : '#F6F2E8');
  }, [theme]);
  useEffect(() => setSound(state.settings.sound), [state.settings.sound]);

  const setView = useCallback((v: View) => { setViewRaw(v); if (v !== 'ledger') setQuery(''); }, []);
  const setMonth = useCallback((m: string) => dispatch({ type: 'month', month: m }), [dispatch]);
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [view, state.month]);

  // ——— Derived ———
  const months = useMemo(() => {
    const set = new Set(state.entries.map((e) => monthOf(e.date)));
    set.add(monthOf(todayISO()));
    return [...set].sort().reverse();
  }, [state.entries]);
  const chapters = useMemo(() => months.map((m) => ({ month: m, title: (muse[m]?.ch.title ?? chapterOf(state, computeStats(state.entries, m)).title).map((x) => x.t).join('') })), [months, state, muse]);
  const badges = useMemo(() => badgesOf(state), [state]);
  const lv = levelOf(xpOf(state.entries));
  const candle = useMemo(() => candleOf(state.entries), [state.entries]);
  const monthCount = useMemo(() => state.entries.filter((e) => monthOf(e.date) === state.month).length, [state.entries, state.month]);
  const wall = !state.settings.wallpaper || state.settings.wallpaper === 'season' ? seasonalWallpaper() : state.settings.wallpaper;

  // ——— Muse writes the chapter when connected ———
  useEffect(() => {
    if (!ai || monthCount < 4) return;
    const key = `${state.month}:${monthCount}:${state.settings.ai.storyModel}`;
    if (muse[state.month]?.key === key) return;
    const m = state.month;
    const t = setTimeout(() => {
      museChapter(state, m).then((ch) => setMuse((x) => ({ ...x, [m]: { key, ch } }))).catch(() => { /* local chapter stays */ });
    }, 1500);
    return () => clearTimeout(t);
  }, [ai, state.month, monthCount, state.settings.ai.storyModel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Stickers: one quiet line, never a pile of toasts ———
  const prevLen = useRef(state.entries.length);
  useEffect(() => {
    const grew = state.entries.length - prevLen.current;
    prevLen.current = state.entries.length;
    const fresh = badges.filter((b) => b.done && !state.seenBadges.includes(b.id));
    if (!fresh.length) return;
    dispatch({ type: 'seenBadges', ids: fresh.map((b) => b.id) });
    if (grew > 0 && grew < 10 && state.profile.onboarded) {
      setTimeout(() => { setNotice({ text: <>New sticker for the book: <b>{fresh[0].name}</b>{fresh.length > 1 ? ` and ${fresh.length - 1} more` : ''}. <button className="notice-undo" style={{ display: 'inline' }} onClick={() => setView('collection')}>See it</button></> }); sfx.badge(); }, 4600);
    }
  }, [badges]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(t); }, [notice]);

  // ——— Evening reminder, only when the candle is still unlit ———
  useEffect(() => {
    const r = state.settings.reminder;
    if (!r?.on || typeof Notification === 'undefined') return;
    const check = () => {
      if (Notification.permission !== 'granted' || candle.litToday) return;
      const now = new Date();
      const [h, m] = r.time.split(':').map(Number);
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
      const key = 'cg-reminded';
      try { if (localStorage.getItem(key) === todayISO()) return; localStorage.setItem(key, todayISO()); } catch { /* still remind */ }
      new Notification(candle.streak ? `Your ${candle.streak}-day candle is still unlit` : 'One line lights your candle', { body: 'Write what came in or went out today. One line is enough.', icon: './icon.png', silent: true });
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [state.settings.reminder, candle.litToday, candle.streak]);

  // ——— Writing entries ———
  /** Adds entries, plays the right sound and says what changed in one line (with Undo). */
  const commit = useCallback((entries: Entry[], opts: { error?: string; art?: string; hung?: boolean } = {}) => {
    const m0 = monthOf(entries[0].date);
    const next = [...state.entries, ...entries];
    const gained = restorationOf(next, m0).restored - restorationOf(state.entries, m0).restored;
    const painting = paintingOf(computeStats(next, m0));
    const gilded = entries.some(isGilded);
    dispatch({ type: 'addEntries', entries });
    const first = entries[0];
    if (gained > 0 || opts.hung) sfx.restore(); else if (first.dir === 'in') sfx.income(); else if (cat(first.category).nature === 'save') sfx.vault(); else sfx.spend();
    const ids = entries.map((e) => e.id);
    const outSum = entries.filter((e) => e.dir === 'out').reduce((a, e) => a + e.amount, 0);
    const inSum = entries.filter((e) => e.dir === 'in').reduce((a, e) => a + e.amount, 0);
    const elsewhere = entries.every((e) => monthOf(e.date) !== state.month) ? m0 : null;
    setNotice({
      art: opts.art ?? (gained > 0 ? artSrc(painting.id) : undefined),
      text: <>
        {entries.length === 1 ? <>Added <b>{first.label}</b></> : <>Added {entries.length} entries</>}
        <span className="num" style={{ color: 'var(--ink-3)' }}> {[inSum ? `+${money(inSum, cur)}` : '', outSum ? `−${money(outSum, cur)}` : ''].filter(Boolean).join(' ')}</span>
        {elsewhere && <> in {monthLabel(elsewhere)}</>}
        {opts.hung && <>, painted and hung in the Gallery</>}
        {gained > 0 && <>. {gilded ? 'Gilded, so it cleaned' : 'Cleaned'} {gained === 1 ? 'a patch' : `${gained} patches`} of <i>{painting.title}</i></>}
        {opts.error && <span style={{ color: 'var(--rust)' }}>. Muse unavailable, read on this device</span>}
      </>,
      undo: () => { ids.forEach((id) => dispatch({ type: 'remove', id })); setNotice(null); },
    });
  }, [state.entries, state.month, cur, dispatch]);

  const submit = useCallback(async (text: string, overrides: Record<number, Partial<Parsed>>) => {
    setBusy(true);
    try {
      const res = await readMoney(state.settings, text, cur);
      const items = res.items.map((p, i) => ({ ...p, ...(res.engine === 'oracle' ? overrides[i] : overrides[i]?.dir || overrides[i]?.category ? overrides[i] : {}) }));
      if (!items.length) { setNotice({ text: 'No amount in that. Try “Lunch 14” or “Got paid 3,200”.' }); return; }
      commit(items.map(toEntry), { error: res.error });
    } finally { setBusy(false); }
  }, [state.settings, cur, commit]);

  const captured = useCallback(async ({ parsed, picture }: CaptureDone) => {
    const attach = capture?.attach;
    setCapture(null);
    try { await savePicture(picture); } catch { setNotice({ text: 'This device is out of room for pictures.' }); return; }
    const art = (await pictureURL(picture.id))?.url;
    if (attach) {
      dispatch({ type: 'update', id: attach.id, patch: { photo: picture.id } });
      sfx.restore();
      setNotice({ art, text: <><b>{attach.label}</b> is painted and hung in the Gallery</>, undo: () => { dispatch({ type: 'update', id: attach.id, patch: { photo: attach.photo } }); setNotice(null); } });
    } else if (parsed) commit([{ ...toEntry(parsed), photo: picture.id }], { art, hung: picture.kind === 'thing' });
  }, [capture, commit, dispatch]);

  // Photos dropped or pasted anywhere open the same sheet.
  useEffect(() => {
    const img = (l?: FileList | null) => [...(l ?? [])].find((f) => f.type.startsWith('image/'));
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => { const f = img(e.dataTransfer?.files); if (f && !capture) { e.preventDefault(); setCapture({ file: f }); } };
    const paste = (e: ClipboardEvent) => { if ((e.target as HTMLElement)?.closest?.('textarea, input')) return; const f = img(e.clipboardData?.files); if (f && !capture) setCapture({ file: f }); };
    window.addEventListener('dragover', over); window.addEventListener('drop', drop); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); window.removeEventListener('paste', paste); };
  }, [capture]);

  // Pictures whose entry was deleted are removed from the device a few minutes later.
  const photoKey = state.entries.map((e) => e.photo).filter(Boolean).join();
  useEffect(() => {
    const t = setTimeout(() => prunePictures(new Set(photoKey.split(',').filter(Boolean))), 8000);
    return () => clearTimeout(t);
  }, [photoKey]);

  // ——— Keyboard ———
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || edition) return;
      const map: Record<string, View> = { '1': 'chapter', '2': 'shelf', '3': 'ledger', '4': 'plans', '5': 'collection' };
      if (map[e.key]) { e.preventDefault(); setView(map[e.key]); }
      else if (e.key === 'n') { e.preventDefault(); composer.current?.focus(); }
      else if (e.key === ',') { e.preventDefault(); openSettings(); }
      else if (e.key === 'e') { e.preventDefault(); setEdition(true); }
      else if (e.key === '[') { e.preventDefault(); setMonth(shiftMonth(state.month, -1)); }
      else if (e.key === ']' && state.month < monthOf(todayISO())) { e.preventDefault(); setMonth(shiftMonth(state.month, 1)); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [edition, state.month, setMonth, setView, openSettings]);

  if (!state.profile.onboarded) {
    return (
      <>
        <StickerDefs />
        <Welcome initialCurrency={cur} onDone={(name, currency, sample) => {
          dispatch({ type: 'onboard', name, currency });
          if (sample) dispatch({ type: 'addEntries', entries: demoEntries(currency) });
          prevLen.current = Number.MAX_SAFE_INTEGER;
        }} />
      </>
    );
  }

  const numeral = chapterOf(state, computeStats(state.entries, state.month)).numeral;
  const isNow = state.month === monthOf(todayISO());
  const subtitle = view === 'chapter' || view === 'ledger' ? monthLabel(state.month) : view === 'shelf' ? `${months.length} months` : '';
  const goView = (v: View) => () => setView(v);

  const appWindow = (
    <div className="app">
      <Sidebar
        view={view} setView={setView} month={state.month} setMonth={setMonth} chapters={chapters}
        counts={{ ledger: monthCount, stickers: `${months.length}` }}
        name={state.profile.name} rank={lv.title} streak={candle.streak}
        onEdition={() => setEdition(true)} onSettings={() => openSettings()} wall={artSrc(wall)}
      />

      <main className="main" ref={main}>
        <AnimatePresence mode="wait">
          <motion.div key={`${view}:${state.month}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}>
            {view === 'chapter' && <Chapter state={state} dispatch={dispatch} museChapter={muse[state.month]?.ch ?? null} onOpenCategory={(id) => { setFilter(id); setView('ledger'); }} onEdition={() => setEdition(true)} onWrite={(h) => composer.current?.fill(h ?? '')} onPlans={goView('plans')} onGallery={goView('collection')} onSay={() => composer.current?.speak()} onSnap={() => setCapture({ file: null })} />}
            {view === 'shelf' && <Shelf state={state} months={months} onOpen={(m) => { setMonth(m); setView('chapter'); }} />}
            {view === 'ledger' && <Ledger state={state} dispatch={dispatch} filter={filter} setFilter={setFilter} query={query} onAttach={(e) => setCapture({ file: null, attach: e })} />}
            {view === 'plans' && <Plans state={state} dispatch={dispatch} />}
            {view === 'collection' && <Collection state={state} onOpen={(m) => { setMonth(m); setView('chapter'); }} onCamera={() => setCapture({ file: null })} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="edge drag" />
      <TitleBar>
        <div className="title drag" style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          {view === 'chapter' ? <>Chapter <span style={{ font: 'italic 400 16px var(--serif)' }}>{numeral}</span></> : TITLES[view]}
          {subtitle && <span className="sub hide-sm">{subtitle}</span>}
        </div>
        <div className="drag" style={{ flex: 1, alignSelf: 'stretch' }} />
        {(view === 'chapter' || view === 'ledger') && (
          <div className="capsule glass nodrag">
            <button className="tbtn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(state.month, -1))}><Icon.left size={15} /></button>
            <span className="num" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 86, textAlign: 'center' }}>{monthLabel(state.month, 'short')}</span>
            <button className="tbtn" aria-label="Next month" disabled={isNow} style={{ opacity: isNow ? 0.3 : 1 }} onClick={() => !isNow && setMonth(shiftMonth(state.month, 1))}><Icon.right size={15} /></button>
            {!isNow && <><span className="sep" /><button className="tbtn" onClick={() => setMonth(monthOf(todayISO()))}>Today</button></>}
          </div>
        )}
        {view === 'ledger' && (
          <div className="capsule glass nodrag hide-sm" style={{ paddingLeft: 10 }}>
            <Icon.search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ border: 0, outline: 0, background: 'transparent', width: 150, fontSize: 13, padding: '0 8px' }} />
          </div>
        )}
        <div className="capsule glass nodrag">
          <button className="tbtn hide-sm" onClick={() => setEdition(true)} title={`Open the Edition (${kbd('E')})`}><Icon.play size={13} /> Edition</button>
          <span className="sep hide-sm" />
          <button className="tbtn" onClick={() => openSettings()} aria-label="Settings" title={`Settings (${kbd(',')})`}><Icon.gear size={16} /></button>
          <button className="tbtn solid" onClick={() => composer.current?.focus()} aria-label="New entry" title={`New entry (${kbd('N')})`}><Icon.plus size={15} /></button>
        </div>
      </TitleBar>

      <Composer ref={composer} currency={cur} aiOn={ai} busy={busy} notice={notice} onSubmit={submit} onCamera={(file) => setCapture({ file: file ?? null })} />
      <TabBar view={view} setView={setView} onEdition={() => setEdition(true)} />
    </div>
  );

  const menus: Menu[] = [
    { title: '', items: [
      { label: 'About CashGlome', action: () => openSettings('about') },
      'sep',
      { label: 'Change wallpaper…', action: () => openSettings('appearance') },
      { label: 'Reduce motion', checked: state.settings.calm, action: () => dispatch({ type: 'settings', patch: { calm: !state.settings.calm } }) },
    ] },
    { title: 'CashGlome', items: [
      { label: 'About CashGlome', action: () => openSettings('about') },
      'sep',
      { label: 'Settings…', kbd: kbd(','), action: () => openSettings() },
      { label: 'Meta Muse…', action: () => openSettings('muse') },
      'sep',
      { label: 'Sounds', checked: state.settings.sound, action: () => dispatch({ type: 'settings', patch: { sound: !state.settings.sound } }) },
    ] },
    { title: 'File', items: [
      { label: 'New entry', kbd: kbd('N'), action: () => setTimeout(() => composer.current?.focus(), 50) },
      'sep',
      { label: 'Export…', action: () => openSettings('data') },
      { label: 'Import…', action: () => openSettings('data') },
    ] },
    { title: 'Edit', items: [
      { label: 'Undo last entry', disabled: !notice?.undo, action: () => notice?.undo?.() },
      'sep',
      { label: 'Find in Ledger', action: goView('ledger') },
    ] },
    { title: 'View', items: [
      { label: 'This chapter', kbd: kbd('1'), checked: view === 'chapter', action: goView('chapter') },
      { label: 'All chapters', kbd: kbd('2'), checked: view === 'shelf', action: goView('shelf') },
      { label: 'Ledger', kbd: kbd('3'), checked: view === 'ledger', action: goView('ledger') },
      { label: 'Plans', kbd: kbd('4'), checked: view === 'plans', action: goView('plans') },
      { label: 'Gallery', kbd: kbd('5'), checked: view === 'collection', action: goView('collection') },
      'sep',
      ...(['auto', 'light', 'dark'] as const).map((t) => ({ label: t === 'auto' ? 'Match system' : t === 'light' ? 'Light' : 'Dark', checked: (state.settings.theme ?? 'auto') === t, action: () => dispatch({ type: 'settings', patch: { theme: t } }) })),
    ] },
    { title: 'Chapter', items: [
      { label: 'Previous month', kbd: kbd('['), action: () => setMonth(shiftMonth(state.month, -1)) },
      { label: 'Next month', kbd: kbd(']'), disabled: isNow, action: () => setMonth(shiftMonth(state.month, 1)) },
      { label: 'Back to this month', disabled: isNow, action: () => setMonth(monthOf(todayISO())) },
      'sep',
      { label: 'Open the Edition', kbd: kbd('E'), action: () => setEdition(true) },
    ] },
    { title: 'Help', items: [
      { label: 'How restoration works', action: goView('chapter') },
      { label: 'About the paintings', action: () => openSettings('about') },
    ] },
  ];

  const onDock = (t: DockTarget) => {
    if (t === 'app') setView('chapter');
    else if (t === 'ledger') setView('ledger');
    else if (t === 'gallery') setView('collection');
    else if (t === 'plans') setView('plans');
    else if (t === 'edition') setEdition(true);
    else openSettings();
  };
  const active: DockTarget = view === 'ledger' ? 'ledger' : view === 'collection' ? 'gallery' : view === 'plans' ? 'plans' : 'app';

  return (
    <MotionConfig reducedMotion={state.settings.calm ? 'always' : 'user'}>
      <StickerDefs />
      {desk ? <Desktop state={state} menus={menus} aiOn={ai} onDock={onDock} active={active}>{appWindow}</Desktop> : appWindow}

      <AnimatePresence>
        {settings && <SettingsSheet key="settings" state={state} dispatch={dispatch} initial={settings} close={() => setSettingsPane(null)} />}
        {capture && <CaptureSheet key="capture" file={capture.file} attachTo={capture.attach?.label} settings={state.settings} currency={cur} onDone={captured} onClose={() => setCapture(null)} />}
        {edition && <Edition key="edition" state={state} muse={muse[state.month]?.ch ?? null} close={() => setEdition(false)} />}
      </AnimatePresence>
    </MotionConfig>
  );
}

/** The toolbar; in the browser desktop it also moves and zooms the window, like a real title bar. */
function TitleBar({ children }: { children: ReactNode }) {
  const win = useWindow();
  return (
    <header className="toolbar" onPointerDown={(e) => win?.startDrag(e)} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button, input')) win?.zoom(); }}>
      {children}
    </header>
  );
}
