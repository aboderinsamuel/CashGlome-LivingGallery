import { useEffect, useState } from 'react';
import { appURI, cancelConnect, connectSpotify, disconnectSpotify, embedURL, MUSIC_PICKS, myPlaylists, parseSpotify, RELOAD_PLAYER, spotifyStatus, webURL, type MyPlaylist, type SpotifyStatus } from '../lib/spotify';
import type { Action } from '../lib/store';
import type { State } from '../lib/types';
import { MusicSearch } from './MusicSearch';
import { Icon } from './Icons';

/** The connection as it stands on this device, kept fresh when it changes anywhere in the app. */
export function useSpotifyStatus(): SpotifyStatus {
  const [s, setS] = useState(spotifyStatus);
  useEffect(() => { const r = () => setS(spotifyStatus()); window.addEventListener(RELOAD_PLAYER, r); window.addEventListener('storage', r); return () => { window.removeEventListener(RELOAD_PLAYER, r); window.removeEventListener('storage', r); }; }, []);
  return s;
}

const SWATCH = ['#B8892E', '#2F4F7F', '#A8402E']; // gold leaf, lapis, vermilion: the quiet picks' covers

/** A row the person can play: cover (or a painted swatch), name, a line under it, and a mark when it's playing. */
function PlayRow({ name, sub, image, swatch, playing, onPlay }: { name: string; sub: string; image?: string; swatch?: string; playing: boolean; onPlay: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPlay} aria-label={`Play ${name}`} aria-pressed={playing}>
        {image ? <img src={image} alt="" /> : <span className="ms-noart" style={swatch ? { background: swatch, color: '#F6EFE2' } : undefined}><Icon.music size={15} /></span>}
        <span className="ms-t"><b>{name}</b><span>{sub}</span></span>
        {playing ? <Icon.check size={15} /> : <span className="ms-play">Play</span>}
      </button>
    </li>
  );
}

/**
 * One button for Spotify. Not connected: "Connect Spotify". Waiting: what to do in Spotify's window, and a way out.
 * Connected: whole songs, the account's name, and its playlists when Spotify shares them; or, when it doesn't,
 * a kind word that whole songs work anyway. Disconnect is always one tap.
 */
export function SpotifyConnect({ current, onPick, showPlaylists = true }: { current?: string; onPick: (url: string, name: string) => void; showPlaylists?: boolean }) {
  const status = useSpotifyStatus();
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [mine, setMine] = useState<MyPlaylist[] | null>(null);
  const linked = status.kind === 'linked';
  useEffect(() => {
    if (!linked || !showPlaylists) { setMine(null); return; }
    let live = true;
    myPlaylists().then((p) => live && setMine(p)).catch((e) => live && setNote((e as Error).message));
    return () => { live = false; };
  }, [linked, showPlaylists]);

  const connect = async () => {
    setNote(null); setWaiting(true);
    const r = await connectSpotify();
    setWaiting(false);
    if (r === 'cancelled') setNote('Nothing was connected. Try again whenever you like.');
    if (r === 'blocked') setNote('Your browser stopped Spotify’s window from opening. Allow pop-ups for this site, then try again.');
  };

  if (waiting) {
    return (
      <div className="sp-connect waiting" role="status">
        <span className="sp-dot" aria-hidden />
        <span className="sp-say"><b>Finish in Spotify’s window</b><span>Sign in there. This page carries on by itself when you’re done.</span></span>
        <button type="button" className="btn" onClick={() => { cancelConnect(); setWaiting(false); }}>Cancel</button>
      </div>
    );
  }
  if (status.kind === 'off') {
    return (
      <div className="sp-connect">
        <span className="sp-say"><b>Your own playlists</b><span>{note ?? 'Optional. While CashGlome is in testing, Spotify lets only a few invited accounts connect. Search, the quiet picks and pasted links above work for everyone.'}</span></span>
        <button type="button" className="btn" onClick={connect}>Connect Spotify</button>
      </div>
    );
  }
  return (
    <>
      <div className="sp-connect on">
        {status.kind === 'linked' && status.me.image ? <img className="sp-face" src={status.me.image} alt="" /> : <span className="sp-face"><Icon.music size={14} /></span>}
        <span className="sp-say">
          <b>{status.kind === 'linked' ? <>Connected as {status.me.name}</> : status.refused ? 'Not on the invite list' : 'Spotify is connected'}</b>
          <span>{status.kind === 'linked' ? 'Your playlists are below.'
            : status.refused ? 'Spotify didn’t let this account connect: it isn’t on CashGlome’s invite list. Search and play still work without it.'
              : 'Your playlists will appear here.'}</span>
        </span>
        <button type="button" className="link-btn" onClick={() => { disconnectSpotify(); setMine(null); setNote(null); }}>{status.kind === 'songs' && status.refused ? 'Try another account' : 'Disconnect'}</button>
      </div>
      {linked && showPlaylists && (
        <div className="sp-mine">
          <div className="sp-label">Your playlists</div>
          {!mine && !note && <p className="small ms-say">Bringing your playlists…</p>}
          {note && <p className="small ms-say">{note}</p>}
          {mine && mine.length === 0 && <p className="small ms-say">No playlists on this account yet. Search finds anything on Spotify.</p>}
          {mine && mine.length > 0 && (
            <ul className="ms-hits sp-list" aria-label="Your playlists">
              {mine.map((p) => <PlayRow key={p.id} name={p.name} sub={`${p.tracks} songs`} image={p.image} playing={current === p.url} onPlay={() => onPick(p.url, p.name)} />)}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Everything Music is, in one place, the same on a phone and a computer: what's playing (Spotify's own player),
 * search, quiet picks, a pasted link, and, last and optional, your own playlists. Nothing here needs an account.
 * `player` is false where the player already lives elsewhere (Your book), so two never play at once.
 */
export function MusicPanel({ state, dispatch, player = true, onOpenPlayer }: { state: State; dispatch: (a: Action) => void; player?: boolean; onOpenPlayer?: () => void }) {
  const m = state.settings.music;
  const ref = m?.on ? parseSpotify(m.url) : null;
  const [reload, setReload] = useState(0);
  const [link, setLink] = useState('');
  const [bad, setBad] = useState(false);
  useEffect(() => { const r = () => setReload((n) => n + 1); window.addEventListener(RELOAD_PLAYER, r); return () => window.removeEventListener(RELOAD_PLAYER, r); }, []);
  const play = (url: string, name: string) => dispatch({ type: 'settings', patch: { music: { url, name, on: true } } });
  const stop = () => m && dispatch({ type: 'settings', patch: { music: { ...m, on: false } } });
  const open = () => ref && window.open(window.glome?.isDesktop ? appURI(ref) : webURL(ref), '_blank', 'noopener');
  const usePasted = () => { const r = parseSpotify(link.trim()); if (!r) { setBad(true); return; } setBad(false); play(link.trim(), 'From your link'); setLink(''); };
  const current = m?.on ? m.url : undefined;
  return (
    <div className="mu">
      {ref && (
        <section className="mu-now" aria-label="Playing now">
          {player
            ? <iframe key={`${ref.id}-${reload}`} title="Spotify player" src={embedURL(ref)} width="100%" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ border: 0, borderRadius: 12, display: 'block' }} />
            : (
              <div className="mu-now-row">
                <span className="ms-noart" style={{ background: SWATCH[0], color: '#F6EFE2' }}><Icon.music size={15} /></span>
                <span className="ms-t"><b>{m?.name ?? 'Your music'}</b><span>Playing now</span></span>
                {onOpenPlayer && <button type="button" className="btn" onClick={onOpenPlayer}>Show the player</button>}
              </div>
            )}
          <div className="mu-acts">
            <button type="button" className="btn" onClick={open}>Open in Spotify<Icon.right size={13} /></button>
            <button type="button" className="btn" onClick={stop}>Stop the music</button>
          </div>
          {player && <p className="mu-note">Whole songs play when you’re signed in to Spotify in this browser; otherwise Spotify plays a 30-second preview. Open in Spotify always plays the whole thing. Music keeps playing when you close this.</p>}
        </section>
      )}
      <section aria-label="Find music">
        <div className="sp-label">Find anything</div>
        <MusicSearch current={current} onPick={play} />
      </section>
      <section aria-label="Quiet picks">
        <div className="sp-label">Quiet picks for writing</div>
        <ul className="ms-hits sp-list">
          {MUSIC_PICKS.map((p, i) => <PlayRow key={p.url} name={p.name} sub={p.note} swatch={SWATCH[i % SWATCH.length]} playing={current === p.url} onPlay={() => play(p.url, p.name)} />)}
        </ul>
      </section>
      <section aria-label="Paste a Spotify link">
        <div className="sp-label">Or paste a link</div>
        <form className="mu-link" onSubmit={(e) => { e.preventDefault(); usePasted(); }}>
          <input className="field" value={link} onChange={(e) => { setLink(e.target.value); setBad(false); }} placeholder="In Spotify: Share › Copy link" spellCheck={false} aria-label="Spotify link" aria-invalid={bad} />
          <button className="btn" disabled={!link.trim()}>Play</button>
        </form>
        {bad && <p className="mu-note warn" role="alert">That isn’t a Spotify link. In Spotify, choose Share, then Copy link.</p>}
      </section>
      <SpotifyConnect current={current} onPick={play} />
    </div>
  );
}

/**
 * The Music panel as a pop-over (computer) or a sheet rising from the bottom (phone). It stays mounted while closed,
 * so the music keeps playing as you move around the app.
 */
export function MusicDock({ state, dispatch, open, onClose, phone }: { state: State; dispatch: (a: Action) => void; open: boolean; onClose: () => void; phone?: boolean }) {
  const m = state.settings.music;
  const ref = m?.on ? parseSpotify(m.url) : null;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // A click anywhere outside the panel (except a Music button) closes it; the music keeps playing.
    const away = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest('.music-pop, .side-music, [data-music]')) onClose(); };
    window.addEventListener('keydown', k);
    const t = setTimeout(() => window.addEventListener('pointerdown', away), 0);
    return () => { clearTimeout(t); window.removeEventListener('keydown', k); window.removeEventListener('pointerdown', away); };
  }, [open, onClose]);
  if (!ref && !open) return null;
  return (
    <>
      {phone && <div className={'music-scrim' + (open ? ' open' : '')} aria-hidden />}
      <div className={'music-pop' + (phone ? ' phone' : '') + (open ? ' open' : '')} aria-hidden={!open} role="dialog" aria-label="Music">
        {phone && <div className="ph-grab" aria-hidden />}
        <div className="music-head">
          <b className="music-title">Music</b>
          <span style={{ flex: 1 }} />
          <button className="music-close" onClick={onClose} aria-label="Close music"><Icon.close size={13} />Close</button>
        </div>
        <MusicPanel state={state} dispatch={dispatch} />
      </div>
    </>
  );
}

/** On a phone, while something plays: a slim strip above the tabs. Tap to open Music; Stop is one tap. */
export function NowPlaying({ name, onOpen, onStop }: { name?: string; onOpen: () => void; onStop: () => void }) {
  return (
    <div className="ph-playing" role="group" aria-label="Music playing">
      <button className="ph-playing-open" onClick={onOpen} data-music>
        <span className="ph-playing-bars" aria-hidden><i /><i /><i /></span>
        <span className="ph-playing-t"><b>{name ?? 'Music'}</b><small>Your music · tap to open the player</small></span>
      </button>
      <button className="ph-playing-stop" onClick={onStop}>Stop</button>
    </div>
  );
}
