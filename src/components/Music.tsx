import { useEffect } from 'react';
import { appURI, embedURL, parseSpotify, webURL } from '../lib/spotify';
import type { State } from '../lib/types';
import { Icon } from './Icons';

/**
 * Spotify's own player, in a pop-over under the toolbar. It stays loaded while the pop-over is closed,
 * so the music keeps playing as you move around the app.
 */
export function MusicDock({ state, open, onClose, onChange }: { state: State; open: boolean; onClose: () => void; onChange: () => void }) {
  const m = state.settings.music;
  const ref = m?.on ? parseSpotify(m.url) : null;
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
      {ref
        ? <iframe key={ref.id} title="Spotify player" src={embedURL(ref)} width="100%" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ border: 0, borderRadius: 12, display: 'block' }} />
        : <p className="small" style={{ margin: 0 }}>Play a Spotify playlist while you write. Choose one in Settings.</p>}
      <div className="small" style={{ marginTop: 8 }}>Spotify plays 30-second previews unless you're signed in to Spotify here. Closing this keeps the music playing.</div>
    </div>
  );
}
