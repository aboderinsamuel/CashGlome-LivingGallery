import { useEffect, useState } from 'react';
import { appURI, embedURL, parseSpotify, RELOAD_PLAYER, signInToSpotify, spotifySignedIn, webURL } from '../lib/spotify';
import type { Action } from '../lib/store';
import type { State } from '../lib/types';
import { MusicSearch } from './MusicSearch';
import { Icon } from './Icons';

/**
 * Spotify's own player, in a pop-over under the toolbar. It stays loaded while the pop-over is closed,
 * so the music keeps playing as you move around the app.
 */
export function MusicDock({ state, dispatch, open, onClose, onChange }: { state: State; dispatch: (a: Action) => void; open: boolean; onClose: () => void; onChange: () => void }) {
  const m = state.settings.music;
  const ref = m?.on ? parseSpotify(m.url) : null;
  const [reload, setReload] = useState(0);
  const [signed, setSigned] = useState(spotifySignedIn);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { const r = () => { setReload((n) => n + 1); setSigned(spotifySignedIn()); }; window.addEventListener(RELOAD_PLAYER, r); return () => window.removeEventListener(RELOAD_PLAYER, r); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // A click anywhere outside the panel (except the Music button itself) closes it; the music keeps playing.
    const away = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest('.music-pop, .side-music, [data-music]')) onClose(); };
    window.addEventListener('keydown', k);
    const t = setTimeout(() => window.addEventListener('pointerdown', away), 0);
    return () => { clearTimeout(t); window.removeEventListener('keydown', k); window.removeEventListener('pointerdown', away); };
  }, [open, onClose]);
  if (!ref && !open) return null;
  return (
    <div className={'music-pop' + (open ? ' open' : '')} aria-hidden={!open} role="dialog" aria-label="Music">
      <div className="music-head">
        <Icon.music size={15} /><b>Music</b>
        <span style={{ flex: 1 }} />
        {ref && <button className="link-btn" onClick={() => window.open(window.glome?.isDesktop ? appURI(ref) : webURL(ref), '_blank')}>Open in Spotify</button>}
        <button className="link-btn" onClick={onChange}>{ref ? 'Change' : 'Choose'}</button>
        <button className="music-close" onClick={onClose} aria-label="Close music"><Icon.close size={13} />Close</button>
      </div>
      <MusicSearch compact current={m?.on ? m.url : undefined} onPick={(url) => dispatch({ type: 'settings', patch: { music: { ...(m ?? { url: '', on: false }), url, on: true } } })} />
      {ref
        ? <iframe key={`${ref.id}-${reload}`} title="Spotify player" src={embedURL(ref)} width="100%" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ border: 0, borderRadius: 12, display: 'block' }} />
        : <p className="small" style={{ margin: 0 }}>Search above for anything on Spotify, and it plays here while you write.</p>}
      {signed ? (
        <div className="small music-note">Signed in to Spotify in this browser, so whole songs play. Closing this keeps the music playing.</div>
      ) : (
        <div className="music-sign">
          <span className="small">Hearing 30-second previews? Sign in to Spotify for whole songs.</span>
          <button className="btn" onClick={async () => setBlocked((await signInToSpotify()) === 'blocked')}>Sign in to Spotify</button>
          {blocked && <span className="small" style={{ color: 'var(--rust)' }}>Your browser blocked the Spotify window. Allow pop-ups for this site and try again.</span>}
        </div>
      )}
    </div>
  );
}
