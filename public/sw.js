// CashGlome's offline shell. The diary itself lives in the browser's storage and never passes through here;
// this only keeps the app's own files (code, fonts, paintings) so it opens with no signal.
const CACHE = 'cashglome-shell-v2';
const CORE = ['./', './manifest.webmanifest', './icon-192.png', './icon.png', './icon-maskable-512.png', './apple-touch-icon.png'];

// On install, keep the page and every script and stylesheet it names, so the very first offline open works,
// not only the second.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE).catch(() => {});
    try {
      const html = await (await fetch('./', { cache: 'no-store' })).text();
      const files = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|woff2?))"/g)].map((m) => m[1]);
      await Promise.all(files.map((f) => c.add(f).catch(() => {})));
      // The type the stylesheets name (Latin letters; other scripts are kept as they're first used).
      for (const f of files.filter((x) => x.endsWith('.css'))) {
        const base = new URL(f, self.location.href);
        const css = await (await c.match(base.href) ?? await fetch(base)).text();
        const fonts = [...css.matchAll(/url\(([^)]+?-latin-[^)]*?\.woff2)\)/g)].map((m) => new URL(m[1].replace(/["']/g, ''), base).href).filter((u) => !/-latin-ext-/.test(u));
        await Promise.all(fonts.map((u) => c.add(u).catch(() => {})));
      }
    } catch { /* offline at install: the files are kept as they are first used instead */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/__ai') || url.pathname.startsWith('/api/')) return;
  // Audio and video are read in ranges; let the browser handle those directly.
  if (req.headers.has('range')) return;
  // Pages: the newest when online, the kept copy when not.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; }).catch(() => caches.match('./')));
    return;
  }
  // The manifest and icons can change between releases: the newest when online, the kept copy when not.
  if (/\.webmanifest$|icon[^/]*\.png$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req)));
    return;
  }
  // Files: the kept copy first (code is named by its contents), fetched and kept the first time.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.status === 200 && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
