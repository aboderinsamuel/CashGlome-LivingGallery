import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGlomeStore, toEntry } from './lib/store';
import { aiEnabled, readMoney } from './lib/ai';
import { badgesOf, chapterOf, computeStats } from './lib/analytics';
import { chapterIsStale, chapterStep, loadChapters, museChapter, saveChapters, validChapter, type SavedChapter } from './lib/muse-story';
import { cat } from './lib/categories';
import { demoEntries } from './lib/demo';
import { artSrc, isGilded, paintingOf, restorationOf, seasonalWallpaper } from './lib/art';
import { money, monthLabel, monthOf, shiftMonth, todayISO, uid } from './lib/format';
import { setSound, sfx } from './lib/sound';
import type { Entry, Parsed } from './lib/types';
import { prunePictures, savePicture, pictureURL } from './lib/images';
import { Sidebar, TabBar, type View } from './components/Shell';
import { Composer, type ComposerHandle, type Notice } from './components/Composer';
import { Desktop, useDesktopMode, useWindow, type DockTarget, type Menu } from './components/Desktop';
import { StickerDefs } from './components/Stickers';
import { CaptureSheet, type CaptureDone } from './components/CaptureSheet';
import { AskPanel } from './components/AskPanel';
import { MusicDock } from './components/Music';
import { finishSpotifyLink } from './lib/spotify';
import { learn, recall, usuals } from './lib/learn';
import type { Turn } from './lib/ask';
import { Icon } from './components/Icons';
import { Chapter } from './views/Chapter';
import { Shelf } from './views/Shelf';
import { Ledger } from './views/Ledger';
import { Plans } from './views/Plans';
import { Accounts } from './stage/Accounts';
import { Collection } from './views/Collection';
import { SettingsSheet } from './views/Settings';
import { Edition } from './views/Edition';
import { ShareSheet } from './components/ShareSheet';
import { Welcome } from './views/Welcome';
import { MemoryView } from './views/Memory';
import { CheckIns, type CheckIn } from './components/CheckIns';
import { describeMemory, dueRoutines, pendingRoutines, readMemory, routineEntry } from './lib/memory';
import { useCloudSync, useSyncStatus } from './lib/useCloud';
import { museParse } from './lib/ai';
import { parseStory } from './lib/parser';
import { CashCard, Chips, PhoneApp } from './phone/PhoneApp';
import { PhoneWelcome } from './phone/PhoneWelcome';
import { haptic, useKeyboardViewport, useOnline, usePhone } from './phone/device';
import { WITHDRAWAL, cashEntry, dueCash, markOffered, newPocket, recurringOffer, routineFrom } from './phone/moments';
import { daysPhrase } from './lib/memory';
import { Stage } from './stage/Stage';

const TITLES: Record<View, string> = { chapter: 'Chapter', shelf: 'All chapters', ledger: 'Ledger', plans: 'Plans', memory: 'Memory', collection: 'Gallery', accounts: 'Accounts' };
const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || window.glome?.platform === 'darwin';
const kbd = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`);
type Pane = 'general' | 'account' | 'appearance' | 'music' | 'muse' | 'data' | 'about';

export default function App() {
  const [state, dispatch] = useGlomeStore();
  const [view, setViewRaw] = useState<View>('chapter');
  // Home is the living painting; the rooms (ledger, chapters, gallery) are one tap away.
  const [home, setHome] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [settings, setSettingsPane] = useState<Pane | null>(null);
  const [edition, setEdition] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [capture, setCapture] = useState<{ file: Blob | null; attach?: Entry } | null>(null);
  const [saved, setSaved] = useState<Record<string, SavedChapter>>(loadChapters);
  const [ask, setAsk] = useState<{ first: string | null } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [music, setMusic] = useState(false);
  const closeMusic = useCallback(() => setMusic(false), []);
  const composer = useRef<ComposerHandle>(null);
  const main = useRef<HTMLDivElement>(null);
  const cur = state.profile.currency;
  const ai = aiEnabled(state.settings);
  const desk = useDesktopMode();
  const phone = usePhone();
  useKeyboardViewport(phone);
  const online = useOnline();
  const openSettings = useCallback((p: Pane = 'general') => setSettingsPane(p), []);

  // ——— Account & sync: in the background while signed in ———
  useCloudSync(state, dispatch);
  const sync = useSyncStatus();
  useEffect(() => { if (sync.recovering) setSettingsPane('account'); }, [sync.recovering]);

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? (phone ? '#17120C' : '#14110D') : phone ? '#EEE6D6' : '#F6F2E8');
  }, [theme, phone]);
  useEffect(() => setSound(state.settings.sound), [state.settings.sound]);
  // Back from Spotify's sign-in page (web): finish linking, then show the Music pane.
  useEffect(() => { finishSpotifyLink().then((ok) => ok && setSettingsPane('music')).catch(() => setSettingsPane('music')); }, []);

  const setView = useCallback((v: View) => { setViewRaw(v); if (v !== 'ledger') setQuery(''); }, []);
  const setMonth = useCallback((m: string) => dispatch({ type: 'month', month: m }), [dispatch]);
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [view, state.month]);

  // ——— Derived ———
  const months = useMemo(() => {
    const set = new Set(state.entries.map((e) => monthOf(e.date)));
    set.add(monthOf(todayISO()));
    return [...set].sort().reverse();
  }, [state.entries]);
  // The oldest entry of each month: ties a saved Muse story to the data it was written from.
  const firstOf = useMemo(() => {
    const f: Record<string, { id: string; at: number; n: number }> = {};
    for (const e of state.entries) {
      const m = monthOf(e.date);
      if (!f[m]) f[m] = { id: e.id, at: e.createdAt, n: 0 };
      f[m].n++;
      if (e.createdAt < f[m].at) { f[m].id = e.id; f[m].at = e.createdAt; }
    }
    return f;
  }, [state.entries]);
  const muse = useMemo(() => Object.fromEntries(months.map((m) => [m, validChapter(saved[m], firstOf[m]?.id, firstOf[m]?.n ?? 0)])), [months, saved, firstOf]);
  const chapters = useMemo(() => months.map((m) => ({ month: m, title: (muse[m]?.title ?? chapterOf(state, computeStats(state.entries, m)).title).map((x) => x.t).join('') })), [months, state, muse]);
  const badges = useMemo(() => badgesOf(state), [state]);
  const wroteToday = useMemo(() => state.entries.some((e) => e.date === todayISO()), [state.entries]);
  const monthCount = useMemo(() => state.entries.filter((e) => monthOf(e.date) === state.month).length, [state.entries, state.month]);
  const wall = !state.settings.wallpaper || state.settings.wallpaper === 'season' ? seasonalWallpaper() : state.settings.wallpaper;

  // ——— Muse writes the chapter when connected ———
  useEffect(() => {
    const m = state.month, first = firstOf[m]?.id, model = state.settings.ai.storyModel, today = todayISO();
    if (!ai || monthCount < 4 || !first) return;
    if (!chapterIsStale(saved[m], { month: m, count: monthCount, first, model, today, current: m === monthOf(today) })) return;
    const t = setTimeout(() => {
      museChapter(state, m).then((ch) => setSaved((x) => {
        const next = { ...x, [m]: { step: chapterStep(m, monthCount, model), day: today, count: monthCount, first, ch } };
        saveChapters(next);
        return next;
      })).catch(() => { /* the local chapter stays */ });
    }, 1500);
    return () => clearTimeout(t);
  }, [ai, state.month, monthCount, state.settings.ai.storyModel, firstOf[state.month]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ——— Evening reminder, only on a day nothing has been written ———
  useEffect(() => {
    const r = state.settings.reminder;
    if (!r?.on || typeof Notification === 'undefined') return;
    const check = () => {
      if (Notification.permission !== 'granted' || wroteToday) return;
      const now = new Date();
      const [h, m] = r.time.split(':').map(Number);
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
      const key = 'cg-reminded';
      try { if (localStorage.getItem(key) === todayISO()) return; localStorage.setItem(key, todayISO()); } catch { /* still remind */ }
      new Notification('What did today cost?', { body: 'One line is enough. Skipping a day costs nothing.', icon: './icon.png', silent: true });
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [state.settings.reminder, wroteToday]);

  // ——— Routines: written down for you, or asked about with one tap ———
  const latest = useRef(state);
  latest.current = state;
  const handled = useRef(new Set<string>());
  useEffect(() => {
    const tick = () => {
      const s = latest.current;
      const due = dueRoutines(s).filter((d) => !handled.current.has(d.key));
      if (!due.length) return;
      due.forEach((d) => handled.current.add(d.key));
      const auto = due.filter((d) => d.m.mode === 'auto'), ask = due.filter((d) => d.m.mode !== 'auto');
      const c = s.profile.currency;
      if (auto.length) {
        const entries = auto.map((d) => routineEntry(d.m, d.date));
        auto.forEach((d) => dispatch({ type: 'mark', key: d.key, mark: 'done' }));
        dispatch({ type: 'addEntries', entries });
        const total = entries.reduce((a, e) => a + (e.dir === 'out' ? e.amount : 0), 0);
        setNotice({
          text: <>Wrote down <b>{auto.length === 1 ? auto[0].m.label : `${auto.length} routines`}</b> for you{total ? <span className="num" style={{ color: 'var(--ink-3)' }}> −{money(total, c)}</span> : null}</>,
          undo: () => { entries.forEach((e) => dispatch({ type: 'remove', id: e.id })); auto.forEach((d) => dispatch({ type: 'mark', key: d.key, mark: 'skipped' })); setNotice(null); },
        });
      }
      ask.forEach((d) => dispatch({ type: 'mark', key: d.key, mark: 'pending' }));
      // A system notification for today's, when CashGlome isn't in front of you.
      const today = due.filter((d) => d.date === todayISO());
      if (today.length && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const d = today[0], a = money(d.m.amount ?? 0, c);
        const n = new Notification(d.m.mode === 'auto' ? `Wrote down ${d.m.label}: ${a}` : d.m.dir === 'in' ? `Did ${d.m.label} come in today? ${a}` : `${d.m.label} today? ${a}`, {
          body: d.m.mode === 'auto' ? 'From your routine. Open CashGlome to undo it.' : today.length > 1 ? `And ${today.length - 1} more. One tap in CashGlome writes them down.` : 'One tap in CashGlome writes it down.',
          icon: './icon.png', tag: 'cg-routine', silent: false,
        });
        n.onclick = () => { window.focus(); n.close(); };
      }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [dispatch]);
  const checkins = useMemo(() => pendingRoutines(state), [state]);

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
    // On a phone every line is one brush stroke you can hear and feel; a patch lifting gets a second.
    if (phone) { sfx.brush(gained > 0 || !!opts.hung); haptic(gained > 0 ? 'lift' : 'tap'); }
    else if (gained > 0 || opts.hung) sfx.restore(); else if (first.dir === 'in') sfx.income(); else if (cat(first.category).nature === 'save') sfx.vault(); else sfx.spend();
    const ids = entries.map((e) => e.id);
    const outSum = entries.filter((e) => e.dir === 'out').reduce((a, e) => a + e.amount, 0);
    const inSum = entries.filter((e) => e.dir === 'in').reduce((a, e) => a + e.amount, 0);
    const elsewhere = entries.every((e) => monthOf(e.date) !== state.month) ? m0 : null;
    setNotice({
      art: opts.art ?? (gained > 0 ? artSrc(painting.id, 'sm') : undefined),
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
  }, [state.entries, state.month, cur, dispatch, phone]);

  /** After the third "Lunch 2,500", offer once to let it write itself. */
  const offerRoutine = useCallback((just: Entry) => {
    const offer = recurringOffer(latest.current, just);
    if (!offer) return;
    markOffered(offer.label);
    setTimeout(() => setNotice({
      text: <>You’ve written <b>{offer.label}</b> a few times. Let it write itself {daysPhrase(offer.days)}?</>,
      action: { label: 'Yes', run: () => {
        const m = routineFrom(offer);
        dispatch({ type: 'remember', memory: m });
        haptic('done');
        setNotice({ text: <><b>{offer.label}</b> will write itself {daysPhrase(offer.days)}, starting tomorrow.</>, undo: () => { dispatch({ type: 'purgeMemory', id: m.id }); setNotice(null); } });
      } },
    }), 3200);
  }, [dispatch]);

  /** Phone: what the chips showed is saved the moment you send. Muse only improves the wording afterwards. */
  const submitNow = useCallback((text: string, overrides: Record<number, Partial<Parsed>>) => {
    const seen = parseStory(text, { home: cur }).map((p, i) => ({ ...recall(p), ...overrides[i] }));
    seen.forEach((p, i) => { if (overrides[i]?.category) learn(p.label, p.category); });
    if (!seen.length) { setNotice({ text: 'No amount in that. Try “Lunch 2,500” or “Got paid 350k”.' }); return; }
    // Cash taken out is not spending yet: it becomes a pocket to ask about later.
    const isCash = (p: Parsed) => WITHDRAWAL.test(p.text) && !/\b(charge|fee)s?\b/i.test(p.text);
    const pockets = seen.filter(isCash).map((p) => newPocket(p.amount, p.date));
    pockets.forEach((pocket) => dispatch({ type: 'cash', pocket }));
    const kept = seen.map((p, i) => ({ p, i })).filter(({ p }) => !isCash(p));
    const entries = kept.map(({ p }) => toEntry(p));
    if (entries.length) { commit(entries); offerRoutine(entries[0]); }
    else if (pockets.length) {
      haptic();
      setNotice({ text: <>Noted <b className="num">{money(pockets.reduce((a, x) => a + x.amount, 0), cur)}</b> in cash. I’ll ask what’s left in a day or two.</>, undo: () => { pockets.forEach((x) => dispatch({ type: 'removeCash', id: x.id })); setNotice(null); } });
    }
    if (ai && entries.length && navigator.onLine !== false) {
      museParse(state.settings, text, cur).then((muse) => {
        if (muse.length !== seen.length || muse.some((m, i) => Math.abs(m.amount - seen[i].amount) > 0.005)) return;
        kept.forEach(({ p, i }, k) => {
          const m = muse[i];
          const patch = { label: m.label, ...(m.dir === p.dir && !overrides[i]?.category && recall(p).category === p.category ? { category: m.category } : {}) };
          dispatch({ type: 'refine', id: entries[k].id, patch });
        });
      }).catch(() => { /* the on-device reading stands */ });
    }
  }, [cur, ai, state.settings, commit, dispatch, offerRoutine]);

  const submit = useCallback(async (text: string, overrides: Record<number, Partial<Parsed>>) => {
    if (phone) { submitNow(text, overrides); return; }
    setBusy(true);
    try {
      const res = await readMoney(state.settings, text, cur);
      // Your own corrections win: first what you changed just now, then what you taught it before.
      const items = res.items.map((p, i) => ({ ...recall(p), ...(res.engine === 'oracle' ? overrides[i] : overrides[i]?.dir || overrides[i]?.category ? overrides[i] : {}) }));
      items.forEach((p, i) => { if (overrides[i]?.category) learn(p.label, p.category); });
      if (!items.length) { setNotice({ text: 'No amount in that. Try “Lunch 14” or “Got paid 3,200”.' }); return; }
      commit(items.map(toEntry), { error: res.error });
    } finally { setBusy(false); }
  }, [state.settings, cur, commit, phone, submitNow]);

  // ——— Shared from another app (Android share menu): a bank receipt or alert lands in the box, read and ready ———
  useEffect(() => {
    if (!state.profile.onboarded) return;
    const q = new URLSearchParams(location.search);
    const shared = [q.get('text'), q.get('title')].filter(Boolean).join('\n').trim();
    if (!shared) return;
    history.replaceState(null, '', location.pathname);
    setViewRaw('chapter');
    setTimeout(() => composer.current?.fill(shared.slice(0, 2000)), 300);
  }, [state.profile.onboarded]);

  // ——— Cash by balance ———
  const cashDue = useMemo(() => (phone ? dueCash(state) : null), [phone, state]);
  const answerCash = useCallback((left: number) => {
    if (!cashDue) return;
    const gap = cashDue.left - left;
    dispatch({ type: 'cash', pocket: { ...cashDue, left, askedOn: todayISO(), closed: left <= 0 } });
    if (gap > 0) commit([cashEntry(gap, cashDue, left)]);
    else { haptic(); setNotice({ text: 'Nothing spent from it yet. I’ll ask again another day.' }); }
  }, [cashDue, commit, dispatch]);

  const answerCheckIn = useCallback((c: CheckIn, yes: boolean, amount?: number) => {
    dispatch({ type: 'mark', key: c.key, mark: yes ? 'done' : 'skipped' });
    if (yes) commit([routineEntry(c.m, c.date, amount ?? c.m.amount)]);
  }, [commit, dispatch]);
  const allYes = useCallback(() => {
    checkins.forEach((c) => dispatch({ type: 'mark', key: c.key, mark: 'done' }));
    if (checkins.length) commit(checkins.map((c) => routineEntry(c.m, c.date)));
  }, [checkins, commit, dispatch]);

  /** "Remember I spend 4k on transport every weekday", typed or said in the composer. */
  const remember = useCallback((text: string) => {
    const m = readMemory(text);
    dispatch({ type: 'remember', memory: m });
    if (m.kind === 'routine' && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    setNotice({
      text: <>Remembered: <b>{describeMemory(m, cur)}</b>. <button className="notice-undo" style={{ display: 'inline' }} onClick={() => { setView('memory'); setNotice(null); }}>Change it</button></>,
      undo: () => { dispatch({ type: 'purgeMemory', id: m.id }); setNotice(null); },
    });
  }, [cur, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // One tap to write the same thing again (today), for the things you buy all the time.
  const usual = useMemo(() => usuals(state.entries, todayISO()), [state.entries]);
  const repeat = useCallback((e: Entry) => {
    commit([{ id: uid(), text: e.text, label: e.label, amount: e.amount, dir: e.dir, category: e.category, date: todayISO(), createdAt: Date.now(), source: 'manual', confidence: 1 }]);
  }, [commit]);

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
      const map: Record<string, View> = { '1': 'chapter', '2': 'shelf', '3': 'ledger', '4': 'plans', '5': 'collection', '6': 'memory' };
      if (map[e.key]) { e.preventDefault(); setView(map[e.key]); }
      else if (e.key === 'n') { e.preventDefault(); composer.current?.focus(); }
      else if (e.key === 'k') { e.preventDefault(); setAsk({ first: null }); }
      else if (e.key === ',') { e.preventDefault(); openSettings(); }
      else if (e.key === 'e') { e.preventDefault(); setEdition(true); }
      else if (e.key === '[') { e.preventDefault(); setMonth(shiftMonth(state.month, -1)); }
      else if (e.key === ']' && state.month < monthOf(todayISO())) { e.preventDefault(); setMonth(shiftMonth(state.month, 1)); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [edition, state.month, setMonth, setView, openSettings]);

  if (home || !state.profile.onboarded) return <Stage state={state} dispatch={dispatch} onRooms={(v) => { setView(v); setHome(false); }} />;

  const numeral = chapterOf(state, computeStats(state.entries, state.month)).numeral;
  const isNow = state.month === monthOf(todayISO());
  const subtitle = view === 'chapter' || view === 'ledger' ? monthLabel(state.month) : view === 'shelf' ? `${months.length} months` : '';
  const goView = (v: View) => () => setView(v);

  const appWindow = (
    <div className="app">
      <Sidebar
        view={view} setView={setView} month={state.month} setMonth={setMonth} chapters={chapters}
        counts={{ ledger: monthCount, stickers: `${months.length}` }}
        name={state.profile.name}
        onEdition={() => setEdition(true)} onSettings={() => openSettings()} wall={artSrc(wall, 'sm')} onHome={() => setHome(true)}
      />

      <main className="main" ref={main}>
        {/* The new page is on screen in the same frame as the tap; it only settles in, like iOS. No waiting for the old one to leave. */}
        <motion.div key={`${view}:${state.month}`} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
            {view === 'chapter' && <Chapter state={state} dispatch={dispatch} museChapter={muse[state.month] ?? null} onOpenCategory={(id) => { setFilter(id); setView('ledger'); }} onEdition={() => setEdition(true)} onWrite={(h) => composer.current?.fill(h ?? '')} onPlans={goView('plans')} onGallery={goView('collection')} onSay={() => composer.current?.speak()} onSnap={() => setCapture({ file: null })} onShare={() => setSharing(true)} />}
            {view === 'shelf' && <Shelf state={state} months={months} onOpen={(m) => { setMonth(m); setView('chapter'); }} />}
            {view === 'ledger' && <Ledger state={state} dispatch={dispatch} filter={filter} setFilter={setFilter} query={query} onAttach={(e) => setCapture({ file: null, attach: e })} />}
            {view === 'plans' && <Plans state={state} dispatch={dispatch} />}
            {view === 'accounts' && <Accounts state={state} dispatch={dispatch} onToday={() => setHome(true)} />}
            {view === 'memory' && <MemoryView state={state} dispatch={dispatch} notify={(text, undo) => setNotice({ text, undo: undo ? () => { undo(); setNotice(null); } : undefined })} />}
            {view === 'collection' && <Collection state={state} onOpen={(m) => { setMonth(m); setView('chapter'); }} onCamera={() => setCapture({ file: null })} />}
        </motion.div>
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
          <button className={'tbtn' + (music ? ' on' : '')} onClick={() => setMusic((x) => !x)} aria-label="Music" aria-expanded={music} title="Music"><Icon.music size={15} />{state.settings.music?.on && <span className="music-live" aria-hidden />}</button>
          <span className="sep" />
          <button className="tbtn" onClick={() => setAsk({ first: null })} title={`Ask about your money (${kbd('K')})`}><Icon.ask size={15} /><span className="hide-sm"> Ask</span></button>
          <span className="sep" />
          <button className="tbtn hide-sm" onClick={() => setEdition(true)} title={`Open the Edition (${kbd('E')})`}><Icon.play size={13} /> Edition</button>
          <span className="sep hide-sm" />
          <button className="tbtn" onClick={() => openSettings()} aria-label="Settings" title={`Settings (${kbd(',')})`}><Icon.gear size={16} /></button>
          <button className="tbtn solid" onClick={() => composer.current?.focus()} aria-label="New entry" title={`New entry (${kbd('N')})`}><Icon.plus size={15} /></button>
        </div>
      </TitleBar>

      <MusicDock state={state} open={music} onClose={closeMusic} onChange={() => { setMusic(false); openSettings('music'); }} />
      <Composer ref={composer} currency={cur} aiOn={ai} busy={busy} notice={notice} onSubmit={submit} onCamera={(file) => setCapture({ file: file ?? null })} onAsk={(q) => setAsk({ first: q })} usuals={usual} onRepeat={repeat} onRemember={remember}
        above={<CheckIns list={checkins} cur={cur} onYes={(c, a) => answerCheckIn(c, true, a)} onNo={(c) => answerCheckIn(c, false)} onAllYes={allYes} />} />
      <TabBar view={view} setView={setView} onEdition={() => setEdition(true)} onHome={() => setHome(true)} />
    </div>
  );

  const phoneWindow = phone && (
    <PhoneApp
      state={state} dispatch={dispatch} view={view} setView={setView} setMonth={setMonth} museChapter={muse[state.month] ?? null} online={online}
      onHome={() => setHome(true)} onAsk={() => setAsk({ first: null })} onEdition={() => setEdition(true)} onShare={() => setSharing(true)} onSettings={() => openSettings()} onMusic={() => openSettings('music')}
      composer={
        <Composer ref={composer} currency={cur} aiOn={ai} busy={busy} notice={notice} onSubmit={submit} onCamera={(file) => setCapture({ file: file ?? null })} onAsk={(q) => setAsk({ first: q })} onRemember={remember}
          idle={<Chips state={state} onRepeat={repeat} onFill={(t) => composer.current?.fill(t)} />}
          above={<>
            <AnimatePresence>{cashDue && <CashCard key={cashDue.id} pocket={cashDue} cur={cur} onAnswer={answerCash} onLater={() => dispatch({ type: 'cash', pocket: { ...cashDue, askedOn: todayISO() } })} />}</AnimatePresence>
            {!cashDue && <CheckIns list={checkins} cur={cur} onYes={(c, a) => answerCheckIn(c, true, a)} onNo={(c) => answerCheckIn(c, false)} onAllYes={allYes} />}
          </>} />
      }
      pages={{
        ledger: <Ledger state={state} dispatch={dispatch} filter={filter} setFilter={setFilter} query={query} onAttach={(e) => setCapture({ file: null, attach: e })} />,
        collection: <Collection state={state} onOpen={(m) => { setMonth(m); setView('chapter'); }} onCamera={() => setCapture({ file: null })} />,
        read: <Chapter state={state} dispatch={dispatch} museChapter={muse[state.month] ?? null} onOpenCategory={(id) => { setFilter(id); setView('ledger'); }} onEdition={() => setEdition(true)} onWrite={(h) => composer.current?.fill(h ?? '')} onPlans={goView('plans')} onGallery={goView('collection')} onSay={() => composer.current?.speak()} onSnap={() => setCapture({ file: null })} onShare={() => setSharing(true)} />,
        plans: <Plans state={state} dispatch={dispatch} />,
        accounts: <Accounts state={state} dispatch={dispatch} onToday={() => setHome(true)} />,
        memory: <MemoryView state={state} dispatch={dispatch} notify={(text, undo) => setNotice({ text, undo: undo ? () => { undo(); setNotice(null); } : undefined })} />,
        shelf: <Shelf state={state} months={months} onOpen={(m) => { setMonth(m); setView('chapter'); }} />,
      }}
    />
  );

  const menus: Menu[] = [
    { title: '', items: [
      { label: 'About CashGlome', action: () => openSettings('about') },
      'sep',
      { label: 'Change wallpaper…', action: () => openSettings('appearance') },
      { label: 'Music…', action: () => openSettings('music') },
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
      { label: 'Ask about your money…', kbd: kbd('K'), action: () => setAsk({ first: null }) },
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
      { label: 'Memory', kbd: kbd('6'), checked: view === 'memory', action: goView('memory') },
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
      {phoneWindow || (desk ? <Desktop state={state} menus={menus} aiOn={ai} onDock={onDock} active={active}>{appWindow}</Desktop> : appWindow)}

      <AnimatePresence>
        {settings && <SettingsSheet key="settings" state={state} dispatch={dispatch} initial={settings} close={() => setSettingsPane(null)} />}
        {capture && <CaptureSheet key="capture" file={capture.file} attachTo={capture.attach?.label} settings={state.settings} currency={cur} onDone={captured} onClose={() => setCapture(null)} />}
        {ask && <AskPanel key="ask" state={state} dispatch={dispatch} aiOn={ai} turns={turns} setTurns={setTurns} first={ask.first} onClose={() => setAsk(null)} />}
        {edition && <Edition key="edition" state={state} muse={muse[state.month] ?? null} close={() => setEdition(false)} onShare={() => setSharing(true)} />}
        {sharing && <ShareSheet key="share" state={state} title={muse[state.month]?.title} onClose={() => setSharing(false)} />}
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
