// Background music from Spotify.
// - Anyone: paste a Spotify link (playlist, album, track, artist, podcast). It plays in Spotify's own player.
// - Linked account (needs VITE_SPOTIFY_CLIENT_ID at build time): pick from your own playlists.
//   Sign-in is Spotify's PKCE flow: no password or secret ever touches CashGlome; only a revocable token,
//   kept on this device and never included in exports.

export type SpotifyKind = 'playlist' | 'album' | 'track' | 'artist' | 'show' | 'episode';
export interface SpotifyRef { kind: SpotifyKind; id: string }

const KINDS = 'playlist|album|track|artist|show|episode';
/** Reads open.spotify.com links (with or without /intl-xx/ and ?si=…) and spotify:kind:id URIs. */
export function parseSpotify(input: string): SpotifyRef | null {
  const s = input.trim();
  const web = s.match(new RegExp(`open\\.spotify\\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?(?:embed/)?(${KINDS})/([A-Za-z0-9]{10,32})`, 'i'));
  if (web) return { kind: web[1].toLowerCase() as SpotifyKind, id: web[2] };
  const uri = s.match(new RegExp(`^spotify:(${KINDS}):([A-Za-z0-9]{10,32})$`, 'i'));
  if (uri) return { kind: uri[1].toLowerCase() as SpotifyKind, id: uri[2] };
  return null;
}
export const embedURL = (r: SpotifyRef) => `https://open.spotify.com/embed/${r.kind}/${r.id}?utm_source=cashglome&theme=0`;
export const webURL = (r: SpotifyRef) => `https://open.spotify.com/${r.kind}/${r.id}`;
export const appURI = (r: SpotifyRef) => `spotify:${r.kind}:${r.id}`;

/** Calm picks for writing about money. All public Spotify playlists. */
export const MUSIC_PICKS = [
  { name: 'Classical Essentials', note: 'Strings and keys, in keeping with the paintings', url: 'https://open.spotify.com/playlist/37i9dQZF1DWWEJlAGA9gs0' },
  { name: 'Peaceful Piano', note: 'Quiet, for evenings', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO' },
  { name: 'lofi beats', note: 'Steady, for getting things done', url: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn' },
];

/* ——— Signing in to Spotify itself ———
   Spotify's player plays whole songs to anyone signed in to Spotify in this browser, and 30-second previews
   to everyone else. Signing in happens on Spotify's own page, in its own window: CashGlome never sees the
   password, needs no key, and works for every Spotify account. When the window closes, the player reloads. */
const WEB_KEY = 'cg-spotify-web';
export const spotifySignedIn = () => { try { return localStorage.getItem(WEB_KEY) === '1'; } catch { return false; } };
export const RELOAD_PLAYER = 'cg-music-reload';
export function signInToSpotify(): Promise<'done' | 'blocked'> {
  const url = 'https://accounts.spotify.com/login?continue=' + encodeURIComponent('https://open.spotify.com/');
  const w = 520, h = 720;
  const win = window.open(url, 'spotify-sign-in', `popup,width=${w},height=${h},left=${Math.max(0, (screen.width - w) / 2)},top=${Math.max(0, (screen.height - h) / 2)}`);
  if (!win) return Promise.resolve('blocked');
  return new Promise((done) => {
    const t = setInterval(() => {
      if (!win.closed) return;
      clearInterval(t);
      try { localStorage.setItem(WEB_KEY, '1'); } catch { /* private mode */ }
      window.dispatchEvent(new Event(RELOAD_PLAYER));
      done('done');
    }, 500);
  });
}
export const forgetSpotifySignIn = () => { try { localStorage.removeItem(WEB_KEY); } catch { /* fine */ } window.dispatchEvent(new Event(RELOAD_PLAYER)); };

/* ——— Linking your account (only when this build has a Spotify app registered) ——— */
const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim();
const DESKTOP_REDIRECT = 'http://127.0.0.1:43821/callback';
const SCOPES = 'playlist-read-private playlist-read-collaborative';
const TOKEN_KEY = 'cg-spotify';
const PENDING_KEY = 'cg-spotify-pkce';

/** Account linking is offered only when this build has a Spotify app (Client ID) registered. */
export const canLinkSpotify = () => !!CLIENT_ID;

interface Token { access: string; refresh?: string; exp: number }
const readToken = (): Token | null => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; } };
const writeToken = (t: Token | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };
export const spotifyLinked = () => !!readToken();
export const unlinkSpotify = () => writeToken(null);

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n = 64) => b64url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);
const redirectURI = () => (window.glome?.isDesktop ? DESKTOP_REDIRECT : location.origin + location.pathname);

async function tokenRequest(params: Record<string, string>): Promise<Token> {
  const body = new URLSearchParams({ client_id: CLIENT_ID!, ...params }).toString();
  let text: string;
  if (window.glome?.spotifyToken) text = await window.glome.spotifyToken(body); // desktop: no CORS from file://
  else { const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }); text = await r.text(); }
  const j = JSON.parse(text);
  if (!j.access_token) throw new Error(j.error_description || j.error || 'Spotify did not sign you in');
  return { access: j.access_token, refresh: j.refresh_token ?? params.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
}

/** Starts sign-in. On the web this leaves the page and comes back; on desktop it opens the browser. */
export async function linkSpotify(): Promise<boolean> {
  if (!CLIENT_ID) throw new Error('This copy of CashGlome has no Spotify app set up.');
  const verifier = randomString(64), state = randomString(16);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: redirectURI(), code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state }).toString();
  if (window.glome?.spotifyAuth) {
    const r = await window.glome.spotifyAuth(url);
    if (!r.code || r.state !== state) throw new Error(r.error || 'Sign-in was cancelled');
    writeToken(await tokenRequest({ grant_type: 'authorization_code', code: r.code, redirect_uri: DESKTOP_REDIRECT, code_verifier: verifier }));
    return true;
  }
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state })); } catch { /* fine */ }
  location.assign(url);
  return false;
}

/** On the web, finishes sign-in when Spotify sends you back with ?code=… (call once at start-up). */
export async function finishSpotifyLink(): Promise<boolean> {
  const q = new URLSearchParams(location.search);
  const code = q.get('code'), back = q.get('state');
  if (!code && !q.get('error')) return false;
  let pending: { verifier: string; state: string } | null = null;
  try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); sessionStorage.removeItem(PENDING_KEY); } catch { /* fine */ }
  history.replaceState(null, '', location.pathname);
  if (!code || !pending || pending.state !== back) return false;
  writeToken(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectURI(), code_verifier: pending.verifier }));
  return true;
}

async function accessToken() {
  const t = readToken();
  if (!t) throw new Error('Not linked');
  if (Date.now() < t.exp) return t.access;
  if (!t.refresh) { writeToken(null); throw new Error('Spotify sign-in expired'); }
  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
  writeToken(fresh);
  return fresh.access;
}

export interface MyPlaylist { id: string; name: string; image?: string; tracks: number; url: string }
export async function myPlaylists(): Promise<MyPlaylist[]> {
  const r = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers: { authorization: 'Bearer ' + (await accessToken()) } });
  if (r.status === 401) { writeToken(null); throw new Error('Spotify sign-in expired'); }
  const j = await r.json();
  return (j.items ?? []).filter(Boolean).map((p: { id: string; name: string; images?: { url: string }[]; tracks?: { total: number }; external_urls?: { spotify: string } }) => ({
    id: p.id, name: p.name, image: p.images?.[p.images.length - 1]?.url, tracks: p.tracks?.total ?? 0, url: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
  }));
}
