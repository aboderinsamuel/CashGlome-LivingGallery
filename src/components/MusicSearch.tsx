// Find a song, album, artist or playlist on Spotify and play it here. The search runs through our own
// server function (api/spotify-search), which holds the Spotify app's secret. When this copy has none,
// it says so and opens Spotify's own search, with the way back: copy the link, paste it here.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

type Kind = 'track' | 'album' | 'artist' | 'playlist';
interface Hit { kind: Kind; id: string; name: string; by: string; image?: string; url: string }
const KIND: Record<Kind, string> = { track: 'Song', album: 'Album', artist: 'Artist', playlist: 'Playlist' };
const base = () => (window.glome?.isDesktop ? 'https://cashglome-gallery.vercel.app' : '');

export function MusicSearch({ current, onPick, compact }: { current?: string; onPick: (url: string, name: string) => void; compact?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [mode, setMode] = useState<'idle' | 'busy' | 'none' | 'off' | 'error'>('idle');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setHits(null); setMode('idle'); return; }
    setMode('busy');
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${base()}/api/spotify-search?q=${encodeURIComponent(s)}`, { signal: ctl.signal });
        // No server function here (local preview) or no Spotify key set: say so, and offer Spotify's own search.
        if (r.status === 501 || r.status === 404 || !(r.headers.get('content-type') ?? '').includes('json')) { setHits(null); setMode('off'); return; }
        const j = await r.json() as { hits?: Hit[] };
        if (!r.ok || !j.hits) { setMode('error'); return; }
        setHits(j.hits); setMode(j.hits.length ? 'idle' : 'none');
      } catch (e) { if ((e as Error).name !== 'AbortError') setMode('error'); }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const onSpotify = () => window.open(`https://open.spotify.com/search/${encodeURIComponent(q.trim())}`, '_blank', 'noopener');

  return (
    <div className={'ms' + (compact ? ' compact' : '')}>
      <label className="ms-field">
        <Icon.search size={15} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs, artists, playlists" aria-label="Search Spotify" spellCheck={false}
          onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); } }} />
        {mode === 'busy' && <span className="ms-busy" aria-label="Searching" />}
        {q && mode !== 'busy' && <button type="button" className="ms-clear" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Clear the search"><Icon.close size={12} /></button>}
      </label>
      {hits && hits.length > 0 && (
        <ul className="ms-hits" aria-label="Results">
          {hits.map((h) => (
            <li key={h.kind + h.id}>
              <button type="button" onClick={() => { onPick(h.url, h.name); setQ(''); }} aria-label={`Play ${KIND[h.kind].toLowerCase()} ${h.name}`}>
                {h.image ? <img src={h.image} alt="" className={h.kind === 'artist' ? 'round' : ''} /> : <span className="ms-noart"><Icon.music size={15} /></span>}
                <span className="ms-t"><b>{h.name}</b><span>{KIND[h.kind]}{h.kind === 'artist' ? '' : ` · ${h.by}`}</span></span>
                {current === h.url ? <Icon.check size={15} /> : <span className="ms-play">Play</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode === 'none' && <p className="small ms-say">Nothing on Spotify for “{q.trim()}”. Try fewer words, or the artist’s name.</p>}
      {(mode === 'off' || mode === 'error') && (
        <div className="ms-say ms-off">
          <span className="small">{mode === 'off' ? 'Search inside CashGlome isn’t switched on in this copy yet.' : 'Spotify didn’t answer just now.'} Find it on Spotify, choose Share › Copy link, then paste the link here.</span>
          <button type="button" className="btn" onClick={onSpotify}>Search on Spotify<Icon.right size={13} /></button>
        </div>
      )}
    </div>
  );
}
