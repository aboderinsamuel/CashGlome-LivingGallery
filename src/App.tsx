import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGlomeStore, toEntry } from './lib/store';
import { readMoney } from './lib/ai';
import { badgesOf, chapterOf, computeStats, chapterNumeral } from './lib/analytics';
import { cat } from './lib/categories';
import { demoEntries } from './lib/demo';
import { artSrc, isGilded, paintingOf, restorationOf, seasonalWallpaper } from './lib/art';
import { money, monthLabel, monthOf, shiftMonth, todayISO, uid } from './lib/format';
import { setSound, sfx } from './lib/sound';
import type { Entry, Parsed } from './lib/types';
import { prunePictures, savePicture, pictureURL } from './lib/images';
import { ChapterTabs, Sidebar, TabBar, type View } from './components/Shell';
import { Composer, type ComposerHandle, type Notice } from './components/Composer';
import { Desktop, GalleryWall, deskOS, useDesktopMode, useWindow, type DockTarget, type Menu } from './components/Desktop';
import { StickerDefs } from './components/Stickers';
import { CaptureSheet, type CaptureDone } from './components/CaptureSheet';
import { StatementSheet, STATEMENT_QUESTION } from './components/StatementSheet';
import { isStatementFile, type Statement } from './lib/statement';
import { MusicDock } from './components/Music';
import { finishSpotifyLink } from './lib/spotify';
import { learn, recall, usuals } from './lib/learn';
import { Icon } from './components/Icons';
import { Chapter } from './views/Chapter';
import { Shelf } from './views/Shelf';
import { Ledger } from './views/Ledger';
import { Plans } from './views/Plans';
import { LedgerReports, PeoplePage } from './stage/Accounts';
import { Today, type Voice } from './views/Today';
import { AskRoom, loadTurns, type AskTurn } from './views/AskRoom';
import { brainConfigured, readLine, sitterSays, warmUp } from './stage/brain';
import { sitterLine } from './stage/voices';
import { mentionsCircle, readCircle } from './stage/books';
import { PAINTINGS } from './lib/art';
import { Collection } from './views/Collection';
import { Play, readyToFind } from './views/Play';
import { SettingsSheet } from './views/Settings';
import { Edition } from './views/Edition';
import { ShareSheet } from './components/ShareSheet';
import { Onboarding } from './views/Onboarding';
import { ExampleGuide, type TourStep } from './components/ExampleGuide';
import { settleOverture } from './lib/overture';
import type { Calling } from './lib/houses';
import { MemoryView } from './views/Memory';
import { CheckIns, type CheckIn } from './components/CheckIns';
import { describeMemory, dueRoutines, pendingRoutines, readMemory, routineEntry } from './lib/memory';
import { useCloudSync, useSyncStatus } from './lib/useCloud';
import { parseStory } from './lib/parser';
import { CashCard, Chips, PhoneApp } from './phone/PhoneApp';
import { haptic, useKeyboardViewport, useOnline, usePhone } from './phone/device';
import { WITHDRAWAL, cashEntry, dueCash, markOffered, newPocket, recurringOffer, routineFrom } from './phone/moments';
import { daysPhrase } from './lib/memory';
import { examplesFor } from './stage/words';

const TITLES: Record<View, string> = { today: 'Today', ask: 'Ask', people: 'People', chapter: 'Chapter', shelf: 'Past chapters', ledger: 'Ledger', plans: 'Plans', memory: 'Routines & memory', collection: 'Gallery', accounts: 'People', play: 'Play' };
// Lines the rules were not written for: other scripts go to the model.
const OTHER_SCRIPT = /[Ͱ-῿　-鿿가-힯]/;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || window.glome?.platform === 'darwin';
const kbd = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`);
type Pane = import('./views/Settings').Pane;

export default function App() {
  const [state, dispatch] = useGlomeStore();
  const [view, setViewRaw] = useState<View>('today');
  const [voice, setVoice] = useState<Voice | null>(null);
  const clearVoice = useCallback(() => setVoice(null), []);
  const [askTurns, setAskTurns] = useState<AskTurn[]>(loadTurns);
  const [askFirst, setAskFirst] = useState<string | null>(null);
  // First run: the cover, a name, and the first line. Shown until the book has been started.
  const [welcoming, setWelcoming] = useState(() => !state.profile.onboarded && state.entries.length === 0);
  const [firstLine, setFirstLine] = useState<string | null>(null);
  // The example month's tour: Write, See, Ask, then the way into a book of your own.
  const [tour, setTour] = useState<TourStep | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [settings, setSettingsPane] = useState<Pane | 'list' | null>(null);
  const [edition, setEdition] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [capture, setCapture] = useState<{ file: Blob | null; attach?: Entry } | null>(null);
  const [statement, setStatement] = useState<{ file: File | null } | null>(null);
  const openStatement = useCallback(() => setStatement({ file: null }), []);
  const [music, setMusic] = useState(false);
  const closeMusic = useCallback(() => setMusic(false), []);
  const composer = useRef<ComposerHandle>(null);
  const main = useRef<HTMLDivElement>(null);
  const cur = state.profile.currency;
  const desk = useDesktopMode();
  // Gemini Nano starts on the first tap or keypress (Chrome only lets a page start it after a gesture).
  useEffect(() => {
    if (!brainConfigured) return;
    const go = () => { void warmUp(); off(); };
    const off = () => { window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true); };
    window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
    return off;
  }, []);
  const phone = usePhone();
  useKeyboardViewport(phone);
  const online = useOnline();
  const openSettings = useCallback((p?: Pane) => setSettingsPane(p ?? 'list'), []);

  // ——— Account & sync: in the background while signed in ———
  useCloudSync(state, dispatch);
  const sync = useSyncStatus();
  useEffect(() => { if (sync.recovering) setSettingsPane('account'); }, [sync.recovering]);

  // ——— Theme & sound ———
  // By the hour: parchment by day, candlelight from seven in the evening until six.
  const evening = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };
  const [candle, setCandle] = useState(evening);
  useEffect(() => { const t = setInterval(() => setCandle(evening()), 60_000); return () => clearInterval(t); }, []);
  const theme = state.settings.theme === 'auto' || !state.settings.theme ? (candle ? 'dark' : 'light') : state.settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17120C' : '#EEE6D6');
  }, [theme, phone]);
  useEffect(() => setSound(state.settings.sound), [state.settings.sound]);
  // Back from Spotify's sign-in page (web): finish linking, then show the Music pane.
  useEffect(() => { finishSpotifyLink().then((ok) => ok && setMusic(true)).catch(() => setMusic(true)); }, []);

  const setView = useCallback((v: View) => { setViewRaw(v === 'accounts' ? 'people' : v); if (v !== 'ledger') setQuery(''); }, []);
  /** A question from anywhere opens Ask with it. */
  const askAbout = useCallback((q?: string) => { setAskFirst(q?.trim() || null); setViewRaw('ask'); }, []);
  const setMonth = useCallback((m: string) => dispatch({ type: 'month', month: m }), [dispatch]);
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [view, state.month]);

  // ——— Derived ———
  const months = useMemo(() => {
    const set = new Set(state.entries.map((e) => monthOf(e.date)));
    set.add(monthOf(todayISO()));
    return [...set].sort().reverse();
  }, [state.entries]);
  const chapters = useMemo(() => months.map((m) => ({ month: m, numeral: chapterNumeral(state.entries, m), title: chapterOf(state, computeStats(state.entries, m)).title.map((x) => x.t).join('') })), [months, state]);
  const badges = useMemo(() => badgesOf(state), [state]);
  const wroteToday = useMemo(() => state.entries.some((e) => e.date === todayISO()), [state.entries]);
  // Details open and waiting to be found, counted beside Play (rechecked when you come back from a game).
  const [foundTick, setFoundTick] = useState(0);
  useEffect(() => { const f = () => setFoundTick((t) => t + 1); window.addEventListener('cg-found', f); return () => window.removeEventListener('cg-found', f); }, []);
  const toFind = useMemo(() => readyToFind(state), [state.entries, state.house, state.quiet, foundTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthCount = useMemo(() => state.entries.filter((e) => monthOf(e.date) === state.month).length, [state.entries, state.month]);
  const wall = !state.settings.wallpaper || state.settings.wallpaper === 'season' ? seasonalWallpaper() : state.settings.wallpaper;

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
  const commit = useCallback((entries: Entry[], opts: { error?: string; art?: string; hung?: boolean; line?: string; where?: 'device' | 'cloud' | 'rules' } = {}) => {
    const m0 = monthOf(entries[0].date);
    const next = [...state.entries, ...entries];
    const gained = restorationOf(next, m0).restored - restorationOf(state.entries, m0).restored;
    const painting = paintingOf(computeStats(next, m0));
    const gilded = entries.some(isGilded);
    if (!state.profile.onboarded) dispatch({ type: 'onboard', name: state.profile.name || '', currency: cur });
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
        {gained > 0 && <>. {gilded ? 'Gilded, so it painted' : 'Painted'} {gained === 1 ? 'a stroke' : `${gained} strokes`} of <i>{painting.title}</i></>}
        {opts.error && <span style={{ color: 'var(--rust)' }}>. Florin unavailable, read on this device</span>}
      </>,
      undo: () => { ids.forEach((id) => dispatch({ type: 'remove', id })); setNotice(null); },
    });
    // The month's sitter answers what you wrote, beside the miniature on Today.
    if (opts.line) {
      const said = sitterLine(painting.id, entries, next, entries[0].id.charCodeAt(0) + entries.length);
      const where = opts.where === 'cloud' ? 'Read with Gemini, in the cloud' : opts.where === 'device' ? 'Read by Gemini Nano, on this device' : 'Read on this device';
      const key = Date.now();
      setVoice({ who: said.who.name, role: said.who.role, text: said.text, where, key });
      if (brainConfigured) {
        const p = PAINTINGS[painting.id];
        const kinds = Array.from(new Set(entries.map((e) => cat(e.category).name.toLowerCase())));
        Promise.race([sitterSays({ name: said.who.name, role: said.who.role, painting: p.title, artist: p.artist, year: p.year }, opts.line, kinds, 'steady'), new Promise<null>((r) => setTimeout(() => r(null), 4500))])
          .then((v) => { if (v) setVoice((x) => (x && x.key === key ? { ...x, text: v.text } : x)); }).catch(() => {});
      }
    }
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

  /** Phone: what the chips showed is saved the moment you send. Florin only improves the wording afterwards. */
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
    if (entries.length) { commit(entries, { line: text }); offerRoutine(entries[0]); }
    else if (pockets.length) {
      haptic();
      setNotice({ text: <>Noted <b className="num">{money(pockets.reduce((a, x) => a + x.amount, 0), cur)}</b> in cash. I’ll ask what’s left in a day or two.</>, undo: () => { pockets.forEach((x) => dispatch({ type: 'removeCash', id: x.id })); setNotice(null); } });
    }
  }, [cur, state.settings, commit, dispatch, offerRoutine]);

  const submit = useCallback(async (text: string, overrides: Record<number, Partial<Parsed>>) => {
    // A savings circle in one sentence: "Ajo of 10 people, 20k monthly, my turn is 4th".
    if (mentionsCircle(text) && /\b(people|members|of us|hands|turn|of \d+)\b/i.test(text)) {
      const c = readCircle(text, todayISO());
      if (c) {
        dispatch({ type: 'circle', circle: c });
        setNotice({ text: <>Kept your <b>{c.name}</b>: {c.members} people, {money(c.contribution, cur)} a {c.every}. <button className="notice-undo" style={{ display: 'inline' }} onClick={() => { setView('people'); setNotice(null); }}>See it</button></>, undo: () => { dispatch({ type: 'removeCircle', id: c.id }); setNotice(null); } });
        return;
      }
    }
    // Lines in other scripts, or ones the rules can't read, go to Gemini: on this device when it can, else the cloud.
    if (brainConfigured && Object.keys(overrides).length === 0 && (OTHER_SCRIPT.test(text) || !parseStory(text, { home: cur }).length)) {
      setBusy(true);
      const r = await readLine(text, cur).catch(() => null).finally(() => setBusy(false));
      if (r?.read.length) { commit(r.read.map(toEntry), { line: text, where: r.where }); return; }
    }
    if (phone) { submitNow(text, overrides); return; }
    setBusy(true);
    try {
      const res = await readMoney(state.settings, text, cur);
      // Your own corrections win: first what you changed just now, then what you taught it before.
      const items = res.items.map((p, i) => ({ ...recall(p), ...(res.engine === 'oracle' ? overrides[i] : overrides[i]?.dir || overrides[i]?.category ? overrides[i] : {}) }));
      items.forEach((p, i) => { if (overrides[i]?.category) learn(p.label, p.category); });
      if (!items.length) { setNotice({ text: 'No amount in that. Try “Lunch 14” or “Got paid 3,200”.' }); return; }
      commit(items.map(toEntry), { error: res.error, line: text });
    } finally { setBusy(false); }
  }, [state.settings, cur, commit, phone, submitNow, dispatch, setView]);

  // The first line from onboarding is written once the book has its name and currency.
  // Taken from a ref, exactly once: clearing state alone isn't seen before this effect runs again.
  const firstLineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!firstLine || !state.profile.onboarded || firstLineRef.current === firstLine) return;
    firstLineRef.current = firstLine;
    setFirstLine(null);
    submit(firstLine, {});
  }, [firstLine, state.profile.onboarded, submit]);
  const welcomedOnce = useRef(false);
  const welcomed = useCallback(({ name, currency, line, sample, house, statement: fromBank }: { name: string; currency: string; line?: string; sample?: boolean; house?: Calling; statement?: boolean }) => {
    if (welcomedOnce.current) return;
    welcomedOnce.current = true;
    dispatch({ type: 'onboard', name, currency, example: sample });
    if (house) dispatch({ type: 'house', calling: house });
    if (sample) { dispatch({ type: 'addEntries', entries: demoEntries(currency) }); setTour(0); }
    if (line) setFirstLine(line);
    if (fromBank) setStatement({ file: null });
    setView('today');
    setWelcoming(false);
    settleOverture();
  }, [dispatch, setView]);

  // ——— Shared from another app (Android share menu): a bank receipt or alert lands in the box, read and ready ———
  useEffect(() => {
    if (!state.profile.onboarded) return;
    const q = new URLSearchParams(location.search);
    const shared = [q.get('text'), q.get('title')].filter(Boolean).join('\n').trim();
    if (!shared) return;
    history.replaceState(null, '', location.pathname);
    setViewRaw('today');
    setTimeout(() => composer.current?.fill(shared.slice(0, 2000)), 300);
  }, [state.profile.onboarded]);

  // ——— Home-screen shortcuts (long-press the installed icon): Write, Ask, Ledger ———
  useEffect(() => {
    if (!state.profile.onboarded) return;
    const open = new URLSearchParams(location.search).get('open');
    if (!open) return;
    history.replaceState(null, '', location.pathname);
    if (open === 'ask') setViewRaw('ask');
    else if (open === 'ledger') setViewRaw('ledger');
    else if (open === 'write') { setViewRaw('today'); setTimeout(() => composer.current?.focus(), 350); }
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
    const drop = (e: DragEvent) => {
      // A bank statement (PDF or CSV) dropped anywhere opens the statement sheet; a photo, the camera sheet.
      const doc = [...(e.dataTransfer?.files ?? [])].find(isStatementFile);
      if (doc) { e.preventDefault(); if (!statement) setStatement({ file: doc }); return; }
      const f = img(e.dataTransfer?.files); if (f && !capture) { e.preventDefault(); setCapture({ file: f }); }
    };
    const paste = (e: ClipboardEvent) => { if ((e.target as HTMLElement)?.closest?.('textarea, input')) return; const f = img(e.clipboardData?.files); if (f && !capture) setCapture({ file: f }); };
    window.addEventListener('dragover', over); window.addEventListener('drop', drop); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); window.removeEventListener('paste', paste); };
  }, [capture, statement]);

  /** Lines brought in from a statement: written at once, with one Undo and a way to ask Florin about them. */
  const importStatement = useCallback((entries: Entry[], st: Statement, currency?: string) => {
    if (!entries.length) return;
    const c = currency ?? cur;
    if (!state.profile.onboarded) dispatch({ type: 'onboard', name: state.profile.name || '', currency: c });
    if (currency) dispatch({ type: 'profile', patch: { currency } });
    dispatch({ type: 'addEntries', entries });
    setMonth(monthOf(st.to));
    if (phone) { sfx.brush(true); haptic('lift'); } else sfx.restore();
    const inSum = entries.filter((e) => e.dir === 'in').reduce((a, e) => a + e.amount, 0);
    const outSum = entries.filter((e) => e.dir === 'out').reduce((a, e) => a + e.amount, 0);
    const ids = entries.map((e) => e.id);
    setNotice({
      text: <>Added {entries.length} {entries.length === 1 ? 'entry' : 'entries'} from {entries[0].statement ?? 'your statement'}<span className="num" style={{ color: 'var(--ink-3)' }}> {[inSum ? `+${money(inSum, c)}` : '', outSum ? `−${money(outSum, c)}` : ''].filter(Boolean).join(' ')}</span></>,
      action: { label: 'Ask Florin', run: () => { setNotice(null); askAbout(STATEMENT_QUESTION); } },
      undo: () => { ids.forEach((id) => dispatch({ type: 'remove', id })); setNotice(null); },
    });
  }, [cur, dispatch, phone, setMonth, state.profile.onboarded, state.profile.name, askAbout]);

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
      const map: Record<string, View> = { '1': 'today', '2': 'ledger', '3': 'ask', '4': 'people', '5': 'chapter' };
      if (map[e.key]) { e.preventDefault(); setView(map[e.key]); }
      else if (e.key === 'n') { e.preventDefault(); composer.current?.focus(); }
      else if (e.key === 'k') { e.preventDefault(); askAbout(); }
      else if (e.key === ',') { e.preventDefault(); openSettings(); }
      else if (e.key === 'e') { e.preventDefault(); setEdition(true); }
      else if (e.key === '[') { e.preventDefault(); setMonth(shiftMonth(state.month, -1)); }
      else if (e.key === ']' && state.month < monthOf(todayISO())) { e.preventDefault(); setMonth(shiftMonth(state.month, 1)); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [edition, state.month, setMonth, setView, openSettings, askAbout]);


  const numeral = chapterOf(state, computeStats(state.entries, state.month)).numeral;
  const isNow = state.month === monthOf(todayISO());
  const subtitle = view === 'chapter' || view === 'ledger' ? monthLabel(state.month) : view === 'shelf' ? `${months.length} months` : '';
  const goView = (v: View) => () => setView(v);

  // Every page, written once. The computer's window and the phone's both show them from here.
  const fill = (t: string) => composer.current?.fill(t);
  const page: Record<Exclude<View, 'accounts'>, ReactNode> = {
    today: <Today state={state} dispatch={dispatch} voice={voice} onVoiceDone={clearVoice} onFill={fill} onLedger={goView('ledger')} onPeople={goView('people')} onAsk={askAbout} onPainting={goView('chapter')} onEdit={() => setView('ledger')} onPlay={goView('play')} />,
    chapter: <Chapter state={state} dispatch={dispatch} onOpenCategory={(id) => { setFilter(id); setView('ledger'); }} onEdition={() => setEdition(true)} onWrite={(h) => fill(h ?? '')} onPlans={goView('plans')} onGallery={goView('collection')} onSay={() => composer.current?.speak()} onSnap={() => setCapture({ file: null })} onShare={() => setSharing(true)} />,
    shelf: <Shelf state={state} months={months} onOpen={(m) => { setMonth(m); setView('chapter'); }} />,
    ledger: <><Ledger state={state} dispatch={dispatch} filter={filter} setFilter={setFilter} query={query} onAttach={(e) => setCapture({ file: null, attach: e })} onImport={openStatement} /><LedgerReports state={state} /></>,
    ask: <AskRoom state={state} turns={askTurns} setTurns={setAskTurns} first={askFirst} onFirstDone={() => setAskFirst(null)} />,
    plans: <Plans state={state} dispatch={dispatch} />,
    people: <PeoplePage state={state} dispatch={dispatch} onFill={fill} />,
    memory: <MemoryView state={state} dispatch={dispatch} notify={(text, undo) => setNotice({ text, undo: undo ? () => { undo(); setNotice(null); } : undefined })} />,
    play: <Play state={state} />,
    collection: <Collection state={state} onOpen={(m) => { setMonth(m); setView('chapter'); }} onCamera={() => setCapture({ file: null })} onPlay={goView('play')} />,
  };
  // While example entries are in the book, every page says so, with the way out in words.
  const TOUR_QUESTION = 'Where did my money go this month?';
  const leaveExample = () => {
    setTour(null);
    if (!state.profile.example) { dispatch({ type: 'dropSamples' }); return; }
    // Opened as the example: start again as someone who has never been here.
    try { localStorage.removeItem('cg-ask-room'); } catch { /* nothing kept */ }
    setAskTurns([]); setAskFirst(null);
    dispatch({ type: 'reset' });
    welcomedOnce.current = false;
    setViewRaw('today');
    setWelcoming(true);
  };
  const guide = !welcoming && state.entries.some((e) => e.sample) ? (
    <ExampleGuide example={!!state.profile.example} step={tour} line={examplesFor(cur)[0]}
      onWrite={() => { setView('today'); void submit(examplesFor(cur)[0], {}); setTour(1); }}
      onSee={() => { setView('chapter'); setTour(2); }}
      onAsk={() => { askAbout(TOUR_QUESTION); setTour(3); }}
      onEndTour={() => setTour(null)} onTour={() => { setView('today'); setTour(0); }} onLeave={leaveExample} />
  ) : null;
  const composerProps = { currency: cur, aiOn: brainConfigured, busy, notice, onSubmit: submit, onCamera: (file?: Blob) => setCapture({ file: file ?? null }), onAsk: askAbout, onRemember: remember };

  const appWindow = (
    <div className="app">
      <Sidebar
        view={view} setView={setView} month={state.month} setMonth={setMonth} chapters={chapters}
        counts={{ ledger: monthCount, play: toFind }}
        name={state.profile.name}
        onEdition={() => setEdition(true)} onBook={() => openSettings()} onRoutines={() => openSettings('routines')} onMusic={() => setMusic((x) => !x)} musicOn={!!state.settings.music?.on} musicName={state.settings.music?.on ? state.settings.music.name : undefined} wall={wall}
      />

      {guide}
      <main className="main" ref={main}>
        {/* The new page is on screen in the same frame as the tap; it only settles in, like iOS. No waiting for the old one to leave. */}
        <motion.div key={`${view}:${state.month}`} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
            {(view === 'chapter' || view === 'shelf') && <ChapterTabs view={view} setView={setView} onEdition={() => setEdition(true)} />}
            {page[view === 'accounts' ? 'people' : view]}
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
      </TitleBar>

      <MusicDock state={state} dispatch={dispatch} open={music} onClose={closeMusic} />
      {view !== 'ask' && <Composer ref={composer} {...composerProps} usuals={usual} onRepeat={repeat}
        idle={state.entries.length === 0 ? <FirstLines cur={cur} onFill={fill} lead={<ImportChip onClick={openStatement} />} /> : undefined /* once the book has lines, statements come in from the Ledger, the File menu or a dropped file: a chip here floated over every page */}
        above={<CheckIns list={checkins} cur={cur} onYes={(c, a) => answerCheckIn(c, true, a)} onNo={(c) => answerCheckIn(c, false)} onAllYes={allYes} />} />}
      <TabBar view={view} setView={setView} />
    </div>
  );

  const phoneWindow = phone && (
    <PhoneApp
      state={state} dispatch={dispatch} view={view} setView={setView} setMonth={setMonth} online={online}
      onBook={() => openSettings()} onMusic={() => setMusic((x) => !x)} musicOn={!!state.settings.music?.on} musicName={state.settings.music?.on ? state.settings.music.name : undefined}
      onStopMusic={() => state.settings.music && dispatch({ type: 'settings', patch: { music: { ...state.settings.music, on: false } } })}
      musicDock={<MusicDock phone state={state} dispatch={dispatch} open={music} onClose={closeMusic} />}
      onEdition={() => setEdition(true)} onShare={() => setSharing(true)} onLiving={goView('collection')}
      ribbon={guide}
      composer={
        <Composer ref={composer} {...composerProps}
          idle={state.entries.length === 0 ? <FirstLines cur={cur} onFill={fill} lead={<ImportChip onClick={openStatement} />} /> : <Chips state={state} onRepeat={repeat} onFill={fill} after={<ImportChip onClick={openStatement} />} />}
          above={<>
            <AnimatePresence>{cashDue && <CashCard key={cashDue.id} pocket={cashDue} cur={cur} onAnswer={answerCash} onLater={() => dispatch({ type: 'cash', pocket: { ...cashDue, askedOn: todayISO() } })} />}</AnimatePresence>
            {!cashDue && <CheckIns list={checkins} cur={cur} onYes={(c, a) => answerCheckIn(c, true, a)} onNo={(c) => answerCheckIn(c, false)} onAllYes={allYes} />}
          </>} />
      }
      pages={{ ...page, read: page.chapter }}
    />
  );

  const menus: Menu[] = [
    { title: '', items: [
      { label: 'About CashGlome', action: () => openSettings('about') },
      'sep',
      { label: 'Change wallpaper…', action: () => openSettings('appearance') },
      { label: 'Music…', action: () => setMusic(true) },
      { label: 'Reduce motion', checked: state.settings.calm, action: () => dispatch({ type: 'settings', patch: { calm: !state.settings.calm } }) },
    ] },
    { title: 'CashGlome', items: [
      { label: 'About CashGlome', action: () => openSettings('about') },
      'sep',
      { label: 'Settings…', kbd: kbd(','), action: () => openSettings() },
      { label: 'The AI (Florin)…', action: () => openSettings('florin') },
      'sep',
      { label: 'Sounds', checked: state.settings.sound, action: () => dispatch({ type: 'settings', patch: { sound: !state.settings.sound } }) },
    ] },
    { title: 'File', items: [
      { label: 'New entry', kbd: kbd('N'), action: () => setTimeout(() => composer.current?.focus(), 50) },
      { label: 'Ask about your money…', kbd: kbd('K'), action: () => askAbout() },
      { label: 'Import a statement…', action: openStatement },
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
      { label: 'Today', kbd: kbd('1'), checked: view === 'today', action: goView('today') },
      { label: 'Ledger', kbd: kbd('2'), checked: view === 'ledger', action: goView('ledger') },
      { label: 'Ask', kbd: kbd('3'), checked: view === 'ask', action: goView('ask') },
      { label: 'People', kbd: kbd('4'), checked: view === 'people', action: goView('people') },
      { label: 'Chapter', kbd: kbd('5'), checked: view === 'chapter', action: goView('chapter') },
      { label: 'Gallery', checked: view === 'collection', action: goView('collection') },
      'sep',
      ...(['auto', 'light', 'dark'] as const).map((t) => ({ label: t === 'auto' ? 'By the hour' : t === 'light' ? 'Parchment' : 'Candlelight', checked: (state.settings.theme ?? 'auto') === t, action: () => dispatch({ type: 'settings', patch: { theme: t } }) })),
    ] },
    { title: 'Chapter', items: [
      { label: 'Previous month', kbd: kbd('['), action: () => setMonth(shiftMonth(state.month, -1)) },
      { label: 'Next month', kbd: kbd(']'), disabled: isNow, action: () => setMonth(shiftMonth(state.month, 1)) },
      { label: 'Back to this month', disabled: isNow, action: () => setMonth(monthOf(todayISO())) },
      'sep',
      { label: 'Open the Edition', kbd: kbd('E'), action: () => setEdition(true) },
    ] },
    { title: 'Help', items: [
      { label: 'How the painting works', action: goView('chapter') },
      { label: 'About the paintings', action: () => openSettings('about') },
    ] },
  ];

  const onDock = (t: DockTarget) => {
    if (t === 'app') setView('today');
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
      {phoneWindow || (desk ? (deskOS() ? <Desktop state={state} menus={menus} aiOn={false} onDock={onDock} active={active}>{appWindow}</Desktop> : <GalleryWall state={state} onOpen={onDock}>{appWindow}</GalleryWall>) : appWindow)}

      <AnimatePresence>
        {settings && <SettingsSheet key="settings" state={state} dispatch={dispatch} initial={settings === 'list' ? undefined : settings} onOpenMusic={() => setMusic(true)} close={() => setSettingsPane(null)} />}
        {statement && <StatementSheet key="statement" file={statement.file} book={state.entries} currency={cur} empty={state.entries.length === 0}
          onAdd={importStatement} onClose={() => setStatement(null)}
          onAsk={() => { setStatement(null); setNotice(null); askAbout(STATEMENT_QUESTION); }}
          onLedger={() => { setStatement(null); setView('ledger'); }} />}
        {capture && <CaptureSheet key="capture" file={capture.file} attachTo={capture.attach?.label} settings={state.settings} currency={cur} onDone={captured} onClose={() => setCapture(null)} />}
        {edition && <Edition key="edition" state={state} close={() => setEdition(false)} onShare={() => setSharing(true)} />}
        {sharing && <ShareSheet key="share" state={state} onClose={() => setSharing(false)} />}
        {welcoming && <Onboarding key="welcome" initialCurrency={cur} calm={state.settings.calm} onDone={welcomed} />}
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

/** The first three lines, in the person's own money, offered as chips until something is written. */
function FirstLines({ cur, onFill, lead }: { cur: string; onFill: (t: string) => void; lead?: ReactNode }) {
  return (
    <div className="ph-chips first-lines" role="group" aria-label="Try a line">
      {lead}
      {examplesFor(cur).map((x) => <button key={x} className="ph-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => onFill(x)}>{x}</button>)}
    </div>
  );
}

/** Where a bank statement comes in, by the writing box: said in words, not a mystery icon. */
function ImportChip({ onClick }: { onClick: () => void }) {
  return <button className="ph-chip stm-chip" onMouseDown={(e) => e.preventDefault()} onClick={onClick}><Icon.upload size={14} /> Import a statement</button>;
}
