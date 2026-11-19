// Spotify search, for the music picker. Runs on the server so the Spotify app's secret never reaches a browser.
// It signs in as the app itself (client credentials): no person's account is involved and nothing is stored.
// Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the Vercel project (Settings → Environment Variables).
// Without them it answers 501, and the app offers Spotify's own search instead.

type Kind = 'track' | 'album' | 'artist' | 'playlist';
export interface Hit { kind: Kind; id: string; name: string; by: string; image?: string; url: string }

let cached: { token: string; exp: number } | null = null;

async function appToken(id: string, secret: string) {
  if (cached && Date.now() < cached.exp) return cached.token;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + btoa(`${id}:${secret}`) },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`Spotify token ${r.status}`);
  const j = await r.json() as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

type Img = { url: string; width?: number }[] | undefined;
const small = (imgs: Img) => (imgs?.length ? [...imgs].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((i) => (i.width ?? 0) >= 60)?.url ?? imgs[0].url : undefined);
type Item = { id: string; name: string; external_urls?: { spotify?: string }; images?: Img; album?: { images?: Img }; artists?: { name: string }[]; owner?: { display_name?: string }; tracks?: { total?: number } } | null;

/** The slim list the app needs: what it is, who made it, a small picture and the link the player understands. */
export function slim(j: Record<string, { items?: Item[] } | undefined>): Hit[] {
  const out: Hit[] = [];
  const add = (kind: Kind, items: Item[] | undefined, by: (i: NonNullable<Item>) => string, image: (i: NonNullable<Item>) => string | undefined) => {
    for (const i of items ?? []) if (i?.id) out.push({ kind, id: i.id, name: i.name, by: by(i), image: image(i), url: i.external_urls?.spotify ?? `https://open.spotify.com/${kind}/${i.id}` });
  };
  add('track', j.tracks?.items, (i) => (i.artists ?? []).map((a) => a.name).join(', '), (i) => small(i.album?.images));
  add('artist', j.artists?.items, () => 'Artist', (i) => small(i.images));
  add('album', j.albums?.items, (i) => (i.artists ?? []).map((a) => a.name).join(', '), (i) => small(i.images));
  add('playlist', j.playlists?.items, (i) => `Playlist${i.owner?.display_name ? ` by ${i.owner.display_name}` : ''}`, (i) => small(i.images));
  return out;
}

export async function GET(request: Request) {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return Response.json({ error: 'not-configured' }, { status: 501 });
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return Response.json({ hits: [] });
  try {
    const url = 'https://api.spotify.com/v1/search?' + new URLSearchParams({ q, type: 'track,artist,album,playlist', limit: '5' });
    let r = await fetch(url, { headers: { authorization: 'Bearer ' + (await appToken(id, secret)) } });
    if (r.status === 401) { cached = null; r = await fetch(url, { headers: { authorization: 'Bearer ' + (await appToken(id, secret)) } }); }
    if (!r.ok) return Response.json({ error: `spotify-${r.status}` }, { status: 502 });
    return Response.json({ hits: slim(await r.json()) }, { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    return Response.json({ error: 'unreachable' }, { status: 502 });
  }
}
