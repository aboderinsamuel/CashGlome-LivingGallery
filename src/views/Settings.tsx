import { motion } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';
import { DEFAULT_BASE, MUSE_MODELS, testConnection } from '../lib/ai';
import { CURRENCIES, currencySymbol } from '../lib/format';
import { demoEntries } from '../lib/demo';
import { exportState, importState, type Action } from '../lib/store';
import type { State } from '../lib/types';
import { Icon } from '../components/Icons';
import { AppIcon } from '../components/Logo';
import { artSrc, PAINTINGS, seasonalWallpaper, WALLPAPERS } from '../lib/art';

type Pane = 'general' | 'appearance' | 'muse' | 'data' | 'about';
const PANES: { id: Pane; label: string; icon: ReactNode; tint: string }[] = [
  { id: 'general', label: 'General', icon: <Icon.person size={14} />, tint: '#7A6A52' },
  { id: 'appearance', label: 'Appearance', icon: <Icon.sun size={14} />, tint: '#2B3FA8' },
  { id: 'muse', label: 'Meta Muse', icon: <Icon.bolt size={14} />, tint: '#6A3FA0' },
  { id: 'data', label: 'Your data', icon: <Icon.download size={14} />, tint: '#2F6B4A' },
  { id: 'about', label: 'About', icon: <Icon.book size={14} />, tint: '#B08A3A' },
];

export function SettingsSheet({ state, dispatch, close, initial = 'general' }: { state: State; dispatch: (a: Action) => void; close: () => void; initial?: Pane }) {
  const [pane, setPane] = useState<Pane>(initial);
  const P = PANES.find((p) => p.id === pane)!;
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <motion.div className="sheet glass" role="dialog" aria-label="Settings" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <nav className="sheet-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 10px', borderRight: '1px solid var(--line)', background: 'var(--fill)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 6px 14px' }}>
            <button onClick={close} aria-label="Close" style={{ width: 12, height: 12, borderRadius: 6, background: '#FF5F57', boxShadow: 'inset 0 0 0 .5px rgba(0,0,0,.2)' }} />
            <span style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--fill-2)' }} />
            <span style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--fill-2)' }} />
          </div>
          {PANES.map((p) => (
            <button key={p.id} className={'side-item' + (pane === p.id ? ' on' : '')} onClick={() => setPane(p.id)} style={{ whiteSpace: 'nowrap' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: p.tint, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>{p.icon}</span>{p.label}
            </button>
          ))}
        </nav>
        <div style={{ overflowY: 'auto', padding: '22px 28px 30px', minWidth: 0 }}>
          <div style={{ font: '600 20px var(--ui)', letterSpacing: '-0.02em', marginBottom: 18 }}>{P.label}</div>
          {pane === 'general' && <General state={state} dispatch={dispatch} />}
          {pane === 'appearance' && <Appearance state={state} dispatch={dispatch} />}
          {pane === 'muse' && <Muse state={state} dispatch={dispatch} />}
          {pane === 'data' && <Data state={state} dispatch={dispatch} close={close} />}
          {pane === 'about' && <About />}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Group({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>{children}</div>
      {note && <div className="small" style={{ padding: '7px 4px 0', lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}
function Row({ label, children, sub }: { label: ReactNode; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 44, padding: '8px 14px', borderTop: '1px solid var(--line)', marginTop: -1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{label}</div>
        {sub && <div className="small" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 38, height: 22, borderRadius: 11, background: on ? '#34C759' : 'var(--fill-2)', position: 'relative', transition: 'background .2s', flex: 'none' }}>
      <motion.span animate={{ x: on ? 16 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} style={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

function General({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  return (
    <>
      <Group note="Your name appears on your chapters and cards. Nothing leaves this device unless you connect Meta Muse.">
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
    <Group note={denied ? 'Notifications are blocked for CashGlome. Allow them in your browser or system settings to get the reminder.' : 'One quiet note a day, only if your candle is still unlit. Nothing on days you have already written.'}>
      <Row label="Evening reminder" sub="Keeps your candle from going out."><Toggle label="Evening reminder" on={r.on && !denied} set={set} /></Row>
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
        <span style={{ height: 14, width: '40%', borderRadius: 4, background: '#2B3FA8', marginTop: 4 }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: t === id ? 600 : 400 }}>{label}</span>
    </button>
  );
  return (
    <>
      <Group>
        <Row label="Appearance">
          <div style={{ display: 'flex', gap: 14 }}>
            <Swatch id="auto" label="Auto" bg="linear-gradient(135deg,#F6F2E8 50%,#14110D 50%)" fg="#888" />
            <Swatch id="light" label="Light" bg="#F6F2E8" fg="#241F17" />
            <Swatch id="dark" label="Dark" bg="#14110D" fg="#F2EBDD" />
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
            const src = artSrc(id === 'season' ? seasonalWallpaper() : id);
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

function Muse({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const ai = state.settings.ai;
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const on = ai.provider === 'meta';
  const test = async () => {
    setTesting(true); setStatus(null);
    try { const r = await testConnection(state.settings); setStatus({ ok: true, text: `Connected. Muse replied “${r.slice(0, 40)}”.` }); }
    catch (e) { setStatus({ ok: false, text: (e as Error).message }); }
    finally { setTesting(false); }
  };
  return (
    <>
      <Group note={<>Without Muse, entries are read on this device by CashGlome's own parser. With Muse, Meta's models read your entries and write your chapters. Your key is stored only on this device and never included in exports.</>}>
        <Row label="Use Meta Muse" sub={on ? 'Entries and chapters are written by Muse.' : 'Everything stays on this device.'}><Toggle label="Use Meta Muse" on={on} set={(v) => dispatch({ type: 'ai', patch: { provider: v ? 'meta' : 'local' } })} /></Row>
        {on && (
          <>
            <Row label="API key"><input className="field" type="password" autoComplete="off" spellCheck={false} style={{ width: 260 }} placeholder="Paste your Meta Model API key" value={ai.key} onChange={(e) => dispatch({ type: 'ai', patch: { key: e.target.value } })} /></Row>
            <Row label="Reads entries with">
              <select className="field" style={{ width: 200 }} value={ai.parseModel} onChange={(e) => dispatch({ type: 'ai', patch: { parseModel: e.target.value } })}>{MUSE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </Row>
            <Row label="Writes chapters with">
              <select className="field" style={{ width: 200 }} value={ai.storyModel} onChange={(e) => dispatch({ type: 'ai', patch: { storyModel: e.target.value } })}>{MUSE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </Row>
            <Row label="Endpoint" sub="OpenAI-compatible Chat Completions base URL.">
              <input className="field" style={{ width: 260 }} value={ai.base} placeholder={DEFAULT_BASE} onChange={(e) => dispatch({ type: 'ai', patch: { base: e.target.value } })} />
            </Row>
            <Row label={status ? <span style={{ color: status.ok ? 'var(--green)' : 'var(--rust)' }}>{status.text}</span> : 'Check the connection'}>
              <button className="btn" onClick={test} disabled={testing || ai.key.length < 8}>{testing ? 'Checking…' : 'Test'}</button>
            </Row>
          </>
        )}
      </Group>
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
              <img src={artSrc(p.id)} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, flex: 'none' }} />
              <span className="small" style={{ lineHeight: 1.35 }}><i style={{ color: 'var(--ink)' }}>{p.title}</i>, {p.artist}, {p.year}. {p.place}.</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
          <img src="./icon-64.png" alt="" style={{ width: 34, height: 34, borderRadius: 8, flex: 'none' }} />
          <span className="small" style={{ lineHeight: 1.35 }}>The icon’s flowers: <i style={{ color: 'var(--ink)' }}>Vase of Flowers in a Window</i>, Ambrosius Bosschaert the Elder, c. 1618. Mauritshuis, The Hague.</span>
        </div>
        <p className="small" style={{ marginTop: 10, lineHeight: 1.45 }}>Public-domain reproductions from Wikimedia Commons. Text reading on this device uses Tesseract (Apache 2.0).</p>
      </div>
    </div>
  );
}
