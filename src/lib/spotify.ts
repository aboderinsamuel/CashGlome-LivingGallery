// Background music from Spotify.
// - Anyone: search, or paste a Spotify link (playlist, album, track, artist, podcast). It plays in Spotify's own player.
// - Connect Spotify: one button, Spotify's own sign-in in its own window. Whole songs instead of previews, and
//   (when this build has a Spotify app registered) your playlists. Sign-in is Spotify's PKCE flow: no password or
//   secret ever touches CashGlome; only a revocable token, kept on this device and never included in exports.

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

/* ——— Connecting Spotify: one button ———
   "Connect Spotify" opens Spotify's own sign-in in a small window. Signing in there does two things at once:
   Spotify's player starts playing whole songs instead of 30-second previews, and (when this build has a
   Spotify app registered) CashGlome gets a read-only, revocable token to list your playlists. If Spotify won't
   share playlists with this app (an app in development mode only shares them with accounts its owner has
   added), whole songs still work, and the panel says so kindly. All of it stays on this device. */

export const RELOAD_PLAYER = 'cg-music-reload';
const WEB_KEY = 'cg-spotify-web';          // '1' once Spotify's sign-in finished in this browser
const ME_KEY = 'cg-spotify-me';            // the connected account's public name and picture
const TOKEN_KEY = 'cg-spotify';
const PENDING_KEY = 'cg-spotify-pkce';     // verifier and state for the sign-in in progress
const CALLBACK_KEY = 'cg-spotify-cb';      // the sign-in window hands its answer back through this
const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim();
const DESKTOP_REDIRECT = 'http://127.0.0.1:43821/callback';
const SCOPES = 'playlist-read-private playlist-read-collaborative';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };
const reload = () => window.dispatchEvent(new Event(RELOAD_PLAYER));

/** Playlists can be offered only when this build has a Spotify app (Client ID) registered. */
export const canLinkSpotify = () => !!CLIENT_ID;

export interface SpotifyMe { name: string; image?: string; playlists: 'yes' | 'refused' }
/** What the panel shows: not connected, whole songs only, or connected with playlists. */
export type SpotifyStatus = { kind: 'off' } | { kind: 'songs'; refused: boolean } | { kind: 'linked'; me: SpotifyMe };
export function spotifyStatus(): SpotifyStatus {
  let me: SpotifyMe | null = null;
  try { me = JSON.parse(get(ME_KEY) || 'null'); } catch { /* fine */ }
  if (me && me.playlists === 'yes' && readToken()) return { kind: 'linked', me };
  if (get(WEB_KEY) === '1') return { kind: 'songs', refused: me?.playlists === 'refused' };
  return { kind: 'off' };
}
export const spotifySignedIn = () => spotifyStatus().kind !== 'off';
export const spotifyLinked = () => spotifyStatus().kind === 'linked';

/** Forget the connection on this device. Spotify itself stays signed in; that's spotify.com's to change. */
export function disconnectSpotify() { put(TOKEN_KEY, null); put(ME_KEY, null); put(WEB_KEY, null); reload(); }

interface Token { access: string; refresh?: string; exp: number }
const readToken = (): Token | null => { try { return JSON.parse(get(TOKEN_KEY) || 'null'); } catch { return null; } };
const writeToken = (t: Token | null) => put(TOKEN_KEY, t ? JSON.stringify(t) : null);

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n = 64) => b64url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);
const redirectURI = () => (window.glome?.isDesktop ? DESKTOP_REDIRECT : location.origin + '/');

async function tokenRequest(params: Record<string, string>): Promise<Token> {
  const body = new URLSearchParams({ client_id: CLIENT_ID!, ...params }).toString();
  let text: string;
  if (window.glome?.spotifyToken) text = await window.glome.spotifyToken(body); // desktop: no CORS from file://
  else { const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }); text = await r.text(); }
  const j = JSON.parse(text);
  if (!j.access_token) throw new Error(j.error_description || j.error || 'Spotify did not sign you in');
  return { access: j.access_token, refresh: j.refresh_token ?? params.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
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

const refused = () => { writeToken(null); put(ME_KEY, JSON.stringify({ name: '', playlists: 'refused' } satisfies SpotifyMe)); };

/** After Spotify hands back a code: keep the token, learn the account's name, and see if playlists are shared. */
async function completeSignIn(code: string, verifier: string, redirect: string) {
  put(WEB_KEY, '1'); // the person signed in on Spotify's page, so the player can play whole songs now
  try {
    writeToken(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier }));
    const r = await fetch('https://api.spotify.com/v1/me', { headers: { authorization: 'Bearer ' + (await accessToken()) } });
    if (!r.ok) refused(); // 403: Spotify isn't sharing this account with the app yet. Whole songs still work.
    else {
      const j = await r.json() as { display_name?: string; id?: string; images?: { url: string; width?: number }[] };
      const pic = [...(j.images ?? [])].sort((a, b) => (a.width ?? 999) - (b.width ?? 999))[0]?.url;
      put(ME_KEY, JSON.stringify({ name: j.display_name || j.id || 'your account', image: pic, playlists: 'yes' } satisfies SpotifyMe));
    }
  } catch { refused(); }
  reload();
}

function popup(url: string) {
  const w = 480, h = 720;
  return window.open(url, 'spotify-sign-in', `popup,width=${w},height=${h},left=${Math.max(0, (screen.width - w) / 2)},top=${Math.max(0, (screen.height - h) / 2)}`);
}

let cancelWaiting: (() => void) | null = null;
/** Stops waiting for the Spotify window (the person closed it or changed their mind). */
export const cancelConnect = () => cancelWaiting?.();

/**
 * One button: sign in on Spotify's own page, in its own window, without leaving CashGlome.
 * Resolves 'done' when connected (whole songs, and playlists when Spotify shares them), 'cancelled' if the
 * person backs out, or 'blocked' if the browser stopped the window (then this tab goes to Spotify and back).
 */
export async function connectSpotify(): Promise<'done' | 'cancelled' | 'blocked'> {
  cancelWaiting?.();
  // Without a registered Spotify app, signing in to Spotify itself is enough for whole songs.
  if (!CLIENT_ID) {
    const win = popup('https://accounts.spotify.com/login?continue=' + encodeURIComponent('https://open.spotify.com/'));
    if (!win) return 'blocked';
    return new Promise((done) => {
      const t = setInterval(() => { if (!win.closed) return; clearInterval(t); cancelWaiting = null; put(WEB_KEY, '1'); reload(); done('done'); }, 500);
      cancelWaiting = () => { clearInterval(t); cancelWaiting = null; done('cancelled'); };
    });
  }
  const verifier = randomString(64), state = randomString(16);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: redirectURI(), code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state }).toString();
  if (window.glome?.spotifyAuth) { // desktop: the system browser, with a local callback
    const r = await window.glome.spotifyAuth(url);
    if (!r.code || r.state !== state) return 'cancelled';
    await completeSignIn(r.code, verifier, DESKTOP_REDIRECT);
    return 'done';
  }
  put(CALLBACK_KEY, null);
  put(PENDING_KEY, JSON.stringify({ verifier, state, popup: true }));
  const win = popup(url);
  if (!win) { // pop-ups blocked: go to Spotify in this tab and come back (finishSpotifyLink picks it up)
    put(PENDING_KEY, JSON.stringify({ verifier, state, popup: false }));
    location.assign(url);
    return 'blocked';
  }
  return new Promise((done) => {
    let finished = false;
    const read = () => { try { return JSON.parse(get(CALLBACK_KEY) || 'null') as { code?: string; state?: string; error?: string } | null; } catch { return null; } };
    const finish = async (cb: { code?: string; state?: string; error?: string }) => {
      if (finished) return;
      finished = true; cleanup();
      put(CALLBACK_KEY, null); put(PENDING_KEY, null);
      try { win.close(); } catch { /* fine */ }
      if (!cb.code || cb.state !== state) { done('cancelled'); return; }
      await completeSignIn(cb.code, verifier, redirectURI());
      done('done');
    };
    // The window hands its answer back through storage: it may lose its link to this page on Spotify's side.
    const onStorage = (e: StorageEvent) => { if (e.key === CALLBACK_KEY && e.newValue) { const cb = read(); if (cb) void finish(cb); } };
    const poll = setInterval(() => { const cb = read(); if (cb) void finish(cb); }, 600);
    const cleanup = () => { window.removeEventListener('storage', onStorage); clearInterval(poll); cancelWaiting = null; };
    window.addEventListener('storage', onStorage);
    cancelWaiting = () => { if (finished) return; finished = true; cleanup(); put(PENDING_KEY, null); done('cancelled'); };
  });
}

/**
 * Runs first, before the app draws. If this page is the Spotify sign-in window coming back, it hands the answer
 * to the CashGlome tab that opened it and says so on a quiet page; returns true so the app isn't drawn here.
 */
export function spotifyCallbackWindow(): boolean {
  const q = new URLSearchParams(location.search);
  const code = q.get('code'), error = q.get('error'), state = q.get('state');
  if (!code && !error) return false;
  let pending: { popup?: boolean } | null = null;
  try { pending = JSON.parse(get(PENDING_KEY) || 'null'); } catch { /* fine */ }
  if (!pending?.popup) return false; // a whole-tab sign-in: finishSpotifyLink handles it inside the app
  put(CALLBACK_KEY, JSON.stringify({ code, state, error, at: Date.now() }));
  history.replaceState(null, '', location.pathname);
  const root = document.getElementById('root');
  const page = document.createElement('div');
  page.setAttribute('style', 'position:fixed;inset:0;display:grid;place-items:center;background:#EEE6D6;color:#2B2118;font:18px/1.5 Georgia,serif;text-align:center;padding:24px');
  const title = document.createElement('div');
  title.setAttribute('style', 'font-size:30px;margin-bottom:8px');
  title.textContent = error ? 'Nothing was connected.' : 'Spotify is connected.';
  const sub = document.createElement('div');
  sub.setAttribute('style', 'opacity:.7');
  sub.textContent = 'You can close this window and go back to CashGlome.';
  const box = document.createElement('div');
  box.append(title, sub); page.append(box);
  (root ?? document.body).replaceChildren(page);
  setTimeout(() => { try { window.close(); } catch { /* fine */ } }, 500);
  return true;
}

/** On the web, finishes a whole-tab sign-in when Spotify sends you back with ?code=… (call once at start-up). */
export async function finishSpotifyLink(): Promise<boolean> {
  const q = new URLSearchParams(location.search);
  const code = q.get('code'), back = q.get('state');
  if (!code && !q.get('error')) return false;
  let pending: { verifier: string; state: string } | null = null;
  try { pending = JSON.parse(get(PENDING_KEY) || 'null'); } catch { /* fine */ }
  put(PENDING_KEY, null);
  history.replaceState(null, '', location.pathname);
  if (!code || !pending || pending.state !== back) return false;
  await completeSignIn(code, pending.verifier, redirectURI());
  return true;
}

export interface MyPlaylist { id: string; name: string; image?: string; tracks: number; url: string }
export async function myPlaylists(): Promise<MyPlaylist[]> {
  const r = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers: { authorization: 'Bearer ' + (await accessToken()) } });
  if (r.status === 401) { writeToken(null); put(ME_KEY, null); reload(); throw new Error('Spotify sign-in expired. Connect again to see your playlists.'); }
  if (r.status === 403) { refused(); reload(); throw new Error('Spotify isn’t sharing playlists with CashGlome yet.'); }
  if (!r.ok) throw new Error('Spotify didn’t answer just now.');
  const j = await r.json();
  return (j.items ?? []).filter(Boolean).map((p: { id: string; name: string; images?: { url: string; width?: number }[]; tracks?: { total: number }; external_urls?: { spotify: string } }) => ({
    id: p.id, name: p.name, image: [...(p.images ?? [])].sort((a, b) => (a.width ?? 999) - (b.width ?? 999))[0]?.url, tracks: p.tracks?.total ?? 0, url: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
  }));
}
