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
        <span className="sp-say"><b>Whole songs, not previews</b><span>{note ?? 'Sign in on Spotify’s own page. CashGlome never sees your password.'}</span></span>
        <button type="button" className="btn primary" onClick={connect}>Connect Spotify</button>
      </div>
    );
  }
  return (
    <>
      <div className="sp-connect on">
        {status.kind === 'linked' && status.me.image ? <img className="sp-face" src={status.me.image} alt="" /> : <span className="sp-face"><Icon.music size={14} /></span>}
        <span className="sp-say">
          <b>{status.kind === 'linked' ? <>Connected as {status.me.name}</> : 'Spotify is connected'}</b>
          <span>{status.kind === 'linked' ? 'Whole songs play here, and your playlists are below.'
            : status.refused ? 'Whole songs play here. Your playlists need Spotify’s approval for CashGlome; search finds anything meanwhile.'
              : 'Whole songs play here.'}</span>
        </span>
        <button type="button" className="link-btn" onClick={() => { disconnectSpotify(); setMine(null); setNote(null); }}>Disconnect</button>
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
 * Spotify's own player, in a pop-over under the toolbar. It stays loaded while the pop-over is closed,
 * so the music keeps playing as you move around the app.
 */
export function MusicDock({ state, dispatch, open, onClose, onChange }: { state: State; dispatch: (a: Action) => void; open: boolean; onClose: () => void; onChange: () => void }) {
  const m = state.settings.music;
  const ref = m?.on ? parseSpotify(m.url) : null;
  const [reload, setReload] = useState(0);
  useEffect(() => { const r = () => setReload((n) => n + 1); window.addEventListener(RELOAD_PLAYER, r); return () => window.removeEventListener(RELOAD_PLAYER, r); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // A click anywhere outside the panel (except the Music button itself) closes it; the music keeps playing.
    const away = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest('.music-pop, .side-music, [data-music]')) onClose(); };
    window.addEventListener('keydown', k);
    const t = setTimeout(() => window.addEventListener('pointerdown', away), 0);
    return () => { clearTimeout(t); window.removeEventListener('keydown', k); window.removeEventListener('pointerdown', away); };
  }, [open, onClose]);
  const play = (url: string, name: string) => dispatch({ type: 'settings', patch: { music: { url, name, on: true } } });
  if (!ref && !open) return null;
  return (
    <div className={'music-pop' + (open ? ' open' : '')} aria-hidden={!open} role="dialog" aria-label="Music">
      <div className="music-head">
        <Icon.music size={15} /><b>Music</b>
        <span style={{ flex: 1 }} />
        {ref && <button className="link-btn" onClick={() => window.open(window.glome?.isDesktop ? appURI(ref) : webURL(ref), '_blank')}>Open in Spotify</button>}
        <button className="link-btn" onClick={onChange}>Settings</button>
        <button className="music-close" onClick={onClose} aria-label="Close music"><Icon.close size={13} />Close</button>
      </div>
      <MusicSearch compact current={m?.on ? m.url : undefined} onPick={play} />
      {ref ? (
        <>
          <iframe key={`${ref.id}-${reload}`} title="Spotify player" src={embedURL(ref)} width="100%" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ border: 0, borderRadius: 12, display: 'block' }} />
          <div className="sp-under">
            <span className="small">Keeps playing when you close this.</span>
            <button type="button" className="link-btn" onClick={() => m && dispatch({ type: 'settings', patch: { music: { ...m, on: false } } })}>Stop the music</button>
          </div>
        </>
      ) : (
        <div className="sp-mine">
          <div className="sp-label">Quiet picks</div>
          <ul className="ms-hits sp-list" aria-label="Quiet picks">
            {MUSIC_PICKS.map((p, i) => <PlayRow key={p.url} name={p.name} sub={p.note} swatch={SWATCH[i % SWATCH.length]} playing={false} onPlay={() => play(p.url, p.name)} />)}
          </ul>
        </div>
      )}
      <SpotifyConnect current={m?.on ? m.url : undefined} onPick={play} />
    </div>
  );
}
