import { CategoriesPane } from './Categories';
import { MemoryView } from './Memory';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { askKeptLocal, setAskKeptLocal } from '../stage/muse';
import { brainStatus, cloudModelName, onBrain } from '../stage/brain';
import { CURRENCIES, currencySymbol } from '../lib/format';
import { demoEntries } from '../lib/demo';
import { exportState, importState, type Action } from '../lib/store';
import type { State } from '../lib/types';
import { MusicSearch } from '../components/MusicSearch';
import { Icon } from '../components/Icons';
import { Account } from '../components/Account';
import { AppIcon } from '../components/Logo';
import { artSrc, PAINTINGS, seasonalWallpaper, WALLPAPERS } from '../lib/art';
import { canLinkSpotify, forgetSpotifySignIn, linkSpotify, MUSIC_PICKS, myPlaylists, parseSpotify, RELOAD_PLAYER, signInToSpotify, spotifyLinked, spotifySignedIn, unlinkSpotify, type MyPlaylist } from '../lib/spotify';

export type Pane = 'general' | 'categories' | 'routines' | 'account' | 'appearance' | 'music' | 'muse' | 'data' | 'about';
// Tints are pigments from the paintings: umber, ochre, lapis, verdigris, vermilion, madder, gold.
const PANES: { id: Pane; label: string; icon: ReactNode; tint: string; group?: string }[] = [
  { id: 'general', label: 'You and your money', icon: <Icon.person size={14} />, tint: '#7A5534' },
  { id: 'categories', label: 'Categories & income', icon: <Icon.list size={14} />, tint: '#C9962E' },
  { id: 'routines', label: 'Routines & memory', icon: <Icon.repeat size={14} />, tint: '#3E8C86' },
  { id: 'account', label: 'Backup & account', icon: <Icon.cloud size={14} />, tint: '#2B3FA8', group: 'Settings' },
  { id: 'music', label: 'Music', icon: <Icon.music size={14} />, tint: '#8E2A20' },
  { id: 'appearance', label: 'Look & sound', icon: <Icon.sun size={14} />, tint: '#B08A3A' },
  { id: 'muse', label: 'The AI', icon: <Icon.bolt size={14} />, tint: '#2A2620' },
  { id: 'data', label: 'Your data', icon: <Icon.download size={14} />, tint: '#5E4A2E' },
  { id: 'about', label: 'About', icon: <Icon.book size={14} />, tint: '#7A6A52' },
];

export function SettingsSheet({ state, dispatch, close, initial = 'general' }: { state: State; dispatch: (a: Action) => void; close: () => void; initial?: Pane }) {
  const [pane, setPane] = useState<Pane>(initial);
  const P = PANES.find((p) => p.id === pane)!;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [close]);
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <motion.div className="sheet glass" role="dialog" aria-label="Your book" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <nav className="sheet-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 10px', borderRight: '1px solid var(--line)', background: 'var(--fill)' }}>
          <button className="sheet-done" onClick={close}>Done</button>
          <div className="sheet-lights" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 6px 14px' }}>
            <button onClick={close} aria-label="Close" style={{ width: 12, height: 12, borderRadius: 6, background: '#FF5F57', boxShadow: 'inset 0 0 0 .5px rgba(0,0,0,.2)' }} />
            <span style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--fill-2)' }} />
            <span style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--fill-2)' }} />
          </div>
          <div className="book-title">Your <i>book</i></div>
          <div className="sheet-panes">
          {PANES.map((p) => (<div key={p.id} style={{ display: 'contents' }}>{p.group && <div className="side-label">{p.group}</div>}
            <button className={'side-item' + (pane === p.id ? ' on' : '')} onClick={() => setPane(p.id)} style={{ whiteSpace: 'nowrap' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: p.tint, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>{p.icon}</span>{p.label}
            </button></div>
          ))}
          </div>
        </nav>
        <div style={{ overflowY: 'auto', padding: '22px 28px 30px', minWidth: 0 }}>
          <div style={{ font: '600 20px var(--ui)', letterSpacing: '-0.02em', marginBottom: 18 }}>{P.label}</div>
          {pane === 'general' && <General state={state} dispatch={dispatch} />}
          {pane === 'categories' && <CategoriesPane state={state} dispatch={dispatch} />}
          {pane === 'routines' && <div className="in-sheet"><MemoryView state={state} dispatch={dispatch} notify={() => {}} /></div>}
          {pane === 'account' && <Group><div style={{ padding: 16 }}><Account /></div></Group>}
          {pane === 'appearance' && <Appearance state={state} dispatch={dispatch} />}
          {pane === 'music' && <Music state={state} dispatch={dispatch} />}
          {pane === 'muse' && <Florin />}
          {pane === 'data' && <Data state={state} dispatch={dispatch} close={close} />}
          {pane === 'about' && <About />}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Group({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="set-group" style={{ marginBottom: 20 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>{children}</div>
      {note && <div className="small" style={{ padding: '7px 4px 0', lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}
function Row({ label, children, sub }: { label: ReactNode; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="set-row" style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 44, padding: '8px 14px', borderTop: '1px solid var(--line)', marginTop: -1 }}>
      <div className="set-row-text" style={{ flex: 1, minWidth: 0 }}>
        <div className="set-row-label" style={{ fontSize: 13 }}>{label}</div>
        {sub && <div className="small" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button className="set-toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 38, height: 22, borderRadius: 11, background: on ? '#34C759' : 'var(--fill-2)', position: 'relative', transition: 'background .2s', flex: 'none' }}>
      <motion.span animate={{ x: on ? 16 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} style={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

function General({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  return (
    <>
      <Group note="Your name appears on your chapters and cards. Your entries live on this device.">
        <Row label="Name"><input className="field" style={{ width: 220 }} value={state.profile.name} onChange={(e) => dispatch({ type: 'profile', patch: { name: e.target.value } })} /></Row>
        <Row label="Currency" sub="Changing it doesn't convert amounts you've already written.">
          <select className="field" style={{ width: 220 }} value={state.profile.currency} onChange={(e) => dispatch({ type: 'profile', patch: { currency: e.target.value } })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{currencySymbol(c.code)}  {c.name}</option>)}
          </select>
        </Row>
      </Group>
      <Reminder state={state} dispatch={dispatch} />
    </>
  );
}

function Reminder({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const r = state.settings.reminder;
  const [denied, setDenied] = useState(typeof Notification !== 'undefined' && Notification.permission === 'denied');
  const set = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const p = await Notification.requestPermission();
      if (p === 'denied') { setDenied(true); return; }
    }
    dispatch({ type: 'settings', patch: { reminder: { ...r, on } } });
  };
  return (
    <Group note={denied ? 'Notifications are blocked for CashGlome. Allow them in your browser or system settings to get the reminder.' : 'One quiet note in the evening, only on days you haven’t written. Missing a day costs nothing.'}>
      <Row label="Evening reminder" sub="One quiet question in the evening: what did today cost?"><Toggle label="Evening reminder" on={r.on && !denied} set={set} /></Row>
      {r.on && !denied && (
        <Row label="Remind me at">
          <input className="field" type="time" style={{ width: 120 }} value={r.time} onChange={(e) => dispatch({ type: 'settings', patch: { reminder: { ...r, time: e.target.value || '21:00' } } })} />
        </Row>
      )}
    </Group>
  );
}

function Appearance({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const t = state.settings.theme ?? 'auto';
  const Swatch = ({ id, label, bg, fg }: { id: 'auto' | 'light' | 'dark'; label: string; bg: string; fg: string }) => (
    <button onClick={() => dispatch({ type: 'settings', patch: { theme: id } })} style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      <span style={{ width: 92, height: 60, borderRadius: 10, background: bg, border: t === id ? '2.5px solid var(--accent)' : '1px solid var(--line)', padding: 8, display: 'grid', gap: 4, alignContent: 'start', boxShadow: 'var(--shadow-1)' }}>
        <span style={{ height: 5, width: '60%', borderRadius: 3, background: fg, opacity: 0.8 }} />
        <span style={{ height: 4, width: '80%', borderRadius: 2, background: fg, opacity: 0.3 }} />
        <span style={{ height: 14, width: '40%', borderRadius: 4, background: '#B5412B', marginTop: 4 }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: t === id ? 600 : 400 }}>{label}</span>
    </button>
  );
  return (
    <>
      <Group>
        <Row label="Appearance">
          <div style={{ display: 'flex', gap: 14 }}>
            <Swatch id="auto" label="By the hour" bg="linear-gradient(135deg,#EEE6D6 50%,#17120C 50%)" fg="#888" />
            <Swatch id="light" label="Parchment" bg="#EEE6D6" fg="#2A2016" />
            <Swatch id="dark" label="Candlelight" bg="#17120C" fg="#EFE5D0" />
          </div>
        </Row>
      </Group>
      <Group>
        <Row label="Reduce motion" sub="Paintings hold still and transitions are quieter."><Toggle label="Reduce motion" on={state.settings.calm} set={(v) => dispatch({ type: 'settings', patch: { calm: v } })} /></Row>
        <Row label="Sounds" sub="Soft clicks when you add entries."><Toggle label="Sounds" on={state.settings.sound} set={(v) => dispatch({ type: 'settings', patch: { sound: v } })} /></Row>
      </Group>
      <Group note="The painting behind the app and on the desktop. By season changes with the time of year.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10, padding: 12 }}>
          {['season', ...WALLPAPERS].map((id) => {
            const on = (state.settings.wallpaper || 'season') === id;
            const src = artSrc(id === 'season' ? seasonalWallpaper() : id, 'sm');
            return (
              <button key={id} onClick={() => dispatch({ type: 'settings', patch: { wallpaper: id } })} style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                <span style={{ aspectRatio: '16 / 10', borderRadius: 8, backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: on ? '0 0 0 2px var(--paper), 0 0 0 4px var(--accent)' : 'inset 0 0 0 1px var(--line)' }} />
                <span style={{ fontSize: 11.5, fontWeight: on ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{id === 'season' ? 'By season' : PAINTINGS[id].title.replace(/^The /, '')}</span>
              </button>
            );
          })}
        </div>
      </Group>
    </>
  );
}

function Florin() {
  const [local, setLocal] = useState(askKeptLocal);
  const [b, setB] = useState(brainStatus);
  useEffect(() => onBrain(() => setB(brainStatus())), []);
  const device = b.device === 'ready' ? 'Ready on this device' : b.device === 'downloading' ? `Downloading, ${Math.round(b.progress * 100)}%` : b.device === 'none' ? 'Not in this browser; Gemini in the cloud stands in' : 'Checked the first time you write';
  return (
    <>
      <Group note="Florin is Google's Gemini, through Firebase AI Logic. Lines it can't read are read by Gemini Nano on this device first; the cloud sees one only when this browser has no Nano. Ask sends your question and a summary of your book; your entries stay here, and every figure is counted here.">
        <Row label="Florin" sub={b.configured ? `${cloudModelName} in the cloud, Gemini Nano on this device.` : 'This build has no Florin. The book reads and counts on this device.'}><span className="set-val">{b.configured ? 'On' : 'Off'}</span></Row>
        {b.configured && <Row label="Gemini Nano" sub="Chrome on desktop can run it on the device."><span className="set-val">{device}</span></Row>}
        {b.configured && (
          <Row label="Keep Ask on this device" sub={local ? 'Nothing you ask leaves this device. Gemini Nano answers if your browser has it; the book answers if not.' : 'Ask can talk about anything, with a summary of your book.'}>
            <Toggle label="Keep Ask on this device" on={local} set={(v) => { setLocal(v); setAskKeptLocal(v); }} />
          </Row>
        )}
      </Group>
    </>
  );
}

function Music({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const m = state.settings.music ?? { url: '', on: false };
  const [text, setText] = useState(m.url);
  const [err, setErr] = useState<string | null>(null);
  const [linked, setLinked] = useState(spotifyLinked);
  const [mine, setMine] = useState<MyPlaylist[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState(spotifySignedIn);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { const r = () => setSigned(spotifySignedIn()); window.addEventListener(RELOAD_PLAYER, r); return () => window.removeEventListener(RELOAD_PLAYER, r); }, []);
  const signIn = async () => {
    setErr(null); setWaiting(true);
    const r = await signInToSpotify();
    setWaiting(false);
    if (r === 'blocked') setErr('Your browser blocked the Spotify window. Allow pop-ups for this site and try again.');
  };
  const valid = !!parseSpotify(m.url);
  const set = (patch: Partial<{ url: string; on: boolean }>) => dispatch({ type: 'settings', patch: { music: { ...m, ...patch } } });
  const use = (url: string) => {
    if (!parseSpotify(url)) { setErr('That isn’t a Spotify link. In Spotify, choose Share, then Copy link.'); return; }
    setErr(null); setText(url); set({ url, on: true });
  };
  useEffect(() => {
    if (!linked) return;
    myPlaylists().then(setMine).catch((e) => { setErr((e as Error).message); setLinked(spotifyLinked()); });
  }, [linked]);
  const link = async () => {
    setBusy(true); setErr(null);
    try { if (await linkSpotify()) setLinked(true); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const Pick = ({ url, name, sub, image }: { url: string; name: string; sub: string; image?: string }) => (
    <button onClick={() => use(url)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 50, padding: '8px 14px', borderTop: '1px solid var(--line)', marginTop: -1, textAlign: 'left' }}>
      {image ? <img src={image} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flex: 'none' }} />
        : <span style={{ width: 34, height: 34, borderRadius: 6, background: 'linear-gradient(135deg, #1DB954, #127a37)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon.music size={16} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13 }}>{name}</span><span className="small">{sub}</span></span>
      {m.url === url && m.on && <Icon.check size={16} />}
    </button>
  );
  return (
    <>
      <div className="label" style={{ margin: '0 4px 8px' }}>Your Spotify account</div>
      <Group note="You sign in on Spotify's own page, in its own window. CashGlome never sees your password and keeps nothing from Spotify. Some browsers block Spotify inside other sites; if songs stay short, Open in Spotify plays everything in the Spotify app.">
        {signed ? (
          <Row label="Signed in to Spotify" sub="Whole songs play in this browser. Signed in with another account? Sign in again.">
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={signIn} disabled={waiting}>{waiting ? 'Waiting for Spotify…' : 'Sign in again'}</button>
              <button className="btn" onClick={() => forgetSpotifySignIn()}>Forget</button>
            </span>
          </Row>
        ) : (
          <Row label="Sign in to Spotify" sub={waiting ? 'Finish signing in in the Spotify window, then close it.' : 'Whole songs instead of 30-second previews. Free and Premium accounts both work.'}>
            <button className="btn primary" onClick={signIn} disabled={waiting}>{waiting ? 'Waiting for Spotify…' : 'Sign in to Spotify'}</button>
          </Row>
        )}
        {canLinkSpotify() && !linked && (
          <Row label="Choose from your playlists" sub="Lets CashGlome read your playlist names, nothing else.">
            <button className="btn" onClick={link} disabled={busy}>{busy ? 'Waiting for Spotify…' : 'Show my playlists'}</button>
          </Row>
        )}
      </Group>
      <div className="label" style={{ margin: '0 4px 8px' }}>What plays</div>
      <Group note="Music plays in Spotify's own player, from Music in the sidebar. Search for anything on Spotify, or paste a link from the Spotify app.">
        <Row label="Play music while you write" sub={valid ? 'Turn it off any time.' : 'Search for something below, or pick a quiet one.'}>
          <Toggle label="Play music" on={!!m.on && valid} set={(v) => (valid ? set({ on: v }) : setErr('Paste a Spotify link or pick one below first.'))} />
        </Row>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', marginTop: -1 }}>
          <MusicSearch current={m.on ? m.url : undefined} onPick={(url) => use(url)} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); use(text); }} style={{ display: 'flex', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--line)', marginTop: -1 }}>
          <input className="field" style={{ flex: 1, minWidth: 0 }} placeholder="Or paste a Spotify link" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <button className="btn" disabled={!text.trim()}>Use</button>
        </form>
        {err && <div className="small" style={{ color: 'var(--rust)', padding: '0 14px 10px' }}>{err}</div>}
      </Group>
      <div className="label" style={{ margin: '0 4px 8px' }}>Quiet picks</div>
      <Group>{MUSIC_PICKS.map((p) => <Pick key={p.url} url={p.url} name={p.name} sub={p.note} />)}</Group>
      {canLinkSpotify() && linked && (
        <>
          <div className="label" style={{ margin: '0 4px 8px' }}>Your playlists</div>
          <Group note="CashGlome only reads your playlist names. It can't play, change or post anything, and the link stays on this device.">
            {(
              <>
                {!mine && <Row label={<span className="small">Loading your playlists…</span>} />}
                {mine?.map((p) => <Pick key={p.id} url={p.url} name={p.name} sub={`${p.tracks} songs`} image={p.image} />)}
                <Row label="Linked on this device"><button className="btn" onClick={() => { unlinkSpotify(); setLinked(false); setMine(null); }}>Unlink</button></Row>
              </>
            )}
          </Group>
        </>
      )}
    </>
  );
}

function Data({ state, dispatch, close }: { state: State; dispatch: (a: Action) => void; close: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <>
      <Group note={`${state.entries.length} entries and ${state.goals.length} goals, stored in this ${window.glome?.isDesktop ? 'app' : 'browser'} only.`}>
        <Row label="Export" sub="A JSON file of everything except your API key."><button className="btn" onClick={() => exportState(state)}><Icon.download size={14} /> Export</button></Row>
        <Row label="Import" sub={msg || 'Replace this world with an exported file.'}>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { dispatch({ type: 'replace', state: await importState(f, state) }); setMsg('Imported.'); } catch (err) { setMsg((err as Error).message); }
            e.target.value = '';
          }} />
          <button className="btn" onClick={() => file.current?.click()}><Icon.upload size={14} /> Import</button>
        </Row>
        <Row label="Sample months" sub="Adds two months of example entries so you can look around."><button className="btn" onClick={() => { dispatch({ type: 'addEntries', entries: demoEntries(state.profile.currency) }); close(); }}>Add samples</button></Row>
      </Group>
      <Group>
        <Row label="Erase everything" sub={confirm ? 'This deletes every entry, goal and setting on this device. It cannot be undone.' : 'Start again from a blank page.'}>
          {confirm ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn" style={{ background: 'var(--rust)', color: '#fff', borderColor: 'transparent' }} onClick={() => { dispatch({ type: 'reset' }); close(); }}>Erase</button>
            </div>
          ) : <button className="btn danger" onClick={() => setConfirm(true)}>Erase…</button>}
        </Row>
      </Group>
    </>
  );
}

function About() {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', paddingTop: 10 }}>
      <AppIcon size={96} />
      <div style={{ font: '400 34px var(--serif)', letterSpacing: '-0.03em', marginTop: 14 }}>CashGlome</div>
      <div className="small">Version 4.0</div>
      <p className="body-serif" style={{ fontSize: 16, maxWidth: 380, marginTop: 14 }}>Write what came in and what went out, in your own words. CashGlome turns it into a story you can read every month.</p>
      <p className="small" style={{ maxWidth: 380, marginTop: 10, lineHeight: 1.5 }}>No bank connections. Your entries and photos live on this device. CashGlome offers general guidance, not licensed financial advice.</p>
      <div style={{ width: '100%', maxWidth: 440, marginTop: 24, textAlign: 'left' }}>
        <div className="label" style={{ marginBottom: 8 }}>The collection</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.values(PAINTINGS).map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={artSrc(p.id, 'sm')} alt="" decoding="async" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, flex: 'none' }} />
              <span className="small" style={{ lineHeight: 1.35 }}><i style={{ color: 'var(--ink)' }}>{p.title}</i>, {p.artist}, {p.year}. {p.place}.</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
          <img src="./icon-64.png" alt="" style={{ width: 34, height: 34, borderRadius: 8, flex: 'none' }} />
          <span className="small" style={{ lineHeight: 1.35 }}>The icon’s flowers: <i style={{ color: 'var(--ink)' }}>Vase of Flowers in a Window</i>, Ambrosius Bosschaert the Elder, c. 1618. Mauritshuis, The Hague.</span>
        </div>
        <p className="small" style={{ marginTop: 10, lineHeight: 1.45 }}>Public-domain reproductions from Wikimedia Commons. Text reading on this device uses Tesseract (Apache 2.0).</p>
        <p className="small" style={{ marginTop: 6, lineHeight: 1.45 }}>The music on the first screens: Antonio Vivaldi, <i style={{ color: 'var(--ink)' }}>Winter</i>, I. Allegro non molto, played by John Harrison and the Wichita State University Chamber Players. Shortened for CashGlome. <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, via Wikimedia Commons.</p>
      </div>
    </div>
  );
}
