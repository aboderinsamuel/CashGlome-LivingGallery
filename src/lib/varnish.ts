// The underdrawing of each painting (red chalk on linen) is drawn once, off the main thread, and then shown as a
// plain image. Entries paint over it stroke by stroke. (Names still say "varnish", which it used to draw.)
import VarnishWorker from './varnish.worker?worker&inline';
import { artSrc, COLS, ROWS } from './art';
import { renderVarnish } from './varnish-render';

const done = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, { ok: (b: Blob) => void; fail: (e: unknown) => void }>();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('no OffscreenCanvas');
    worker = new VarnishWorker();
    worker.onmessage = (e: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
      const w = waiting.get(e.data.id); waiting.delete(e.data.id);
      if (e.data.blob) w?.ok(e.data.blob); else w?.fail(e.data.error);
    };
    worker.onerror = () => { worker = null; waiting.forEach((w) => w.fail('worker')); waiting.clear(); };
  } catch { worker = null; }
  return worker;
}

async function bitmapOf(id: string) {
  const img = new Image(); img.decoding = 'async'; img.src = artSrc(id, 'md');
  await img.decode();
  return createImageBitmap(img);
}

const idle = (f: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 30));

// A drawn underdrawing is kept on the device, so each one is drawn once and shows at once after that.
const SHELF = 'cg-sketch-v1';
const shelfKey = (k: string) => `/__sketch/${encodeURIComponent(k)}.jpg`;
async function fromShelf(k: string): Promise<string | null> {
  try { const hit = await (await caches.open(SHELF)).match(shelfKey(k)); return hit ? URL.createObjectURL(await hit.blob()) : null; } catch { return null; }
}
function toShelf(k: string, blob: Blob) {
  try { void caches.open(SHELF).then((c) => c.put(shelfKey(k), new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } }))).catch(() => {}); } catch { /* no Cache Storage: drawn again next time */ }
}

async function make(id: string, w: number, h: number, ax: number, ay: number): Promise<string> {
  const k = keyOf(id, w, h, ax, ay);
  const kept = await fromShelf(k);
  if (kept) return kept;
  const blob = await draw(id, w, h, ax, ay);
  toShelf(k, blob);
  return URL.createObjectURL(blob);
}

async function draw(id: string, w: number, h: number, ax: number, ay: number): Promise<Blob> {
  const src = await bitmapOf(id);
  const wk = getWorker();
  if (wk) {
    try {
      return await new Promise<Blob>((ok, fail) => { const n = ++seq; waiting.set(n, { ok, fail }); wk.postMessage({ id: n, src, w, h, ax, ay }, [src]); });
    } catch { /* fall through to the main thread */ }
  }
  const again = src.width ? src : await bitmapOf(id); // a transferred bitmap is detached
  await new Promise<void>((r) => idle(() => r()));
  const c = renderVarnish((cw, ch) => Object.assign(document.createElement('canvas'), { width: cw, height: ch }), again, { w, h, ax, ay }) as HTMLCanvasElement;
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.86));
}

const keyOf = (id: string, w: number, h: number, ax: number, ay: number) => `${id}|${w}x${h}|${ax},${ay}`;
/** Already drawn this session? Lets a plate show its varnish on the very first frame. */
export const varnishNow = (id: string, w: number, h: number, ax: number, ay: number) => done.get(keyOf(id, w, h, ax, ay)) ?? null;
export function varnish(id: string, w: number, h: number, ax: number, ay: number): Promise<string> {
  const k = keyOf(id, w, h, ax, ay);
  const hit = done.get(k);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(k);
  if (!p) {
    p = make(id, w, h, ax, ay).then((u) => { done.set(k, u); pending.delete(k); return u; }, (e) => { pending.delete(k); throw e; });
    pending.set(k, p);
  }
  return p;
}

/* Masks: one broad brushstroke per patch. Each of the thirty strokes is laid over its own part of the canvas,
   a little longer and wider than that part, at its own slight angle, with dry bristle streaks at its edges.
   Drawn small and stretched by the browser, which softens the edges like wet paint. */
const S = 40; // mask pixels per patch
const maskCache = new Map<string, string>();

function seeded(seed: number) { let s = seed * 7919 + 17; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

/** Lays the stroke for patch i onto g, in whatever compositing mode g is in. */
export function brush(g: CanvasRenderingContext2D, i: number, unit = S) {
  const r = seeded(i + 1);
  const col = i % COLS, row = Math.floor(i / COLS);
  const cx = (col + 0.5 + (r() - 0.5) * 0.22) * unit, cy = (row + 0.5 + (r() - 0.5) * 0.22) * unit;
  const angle = -0.32 + r() * 0.64;
  const len = unit * (1.75 + r() * 0.4), wid = unit * (1.2 + r() * 0.2);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const STEPS = 30;
  g.globalAlpha = 1;
  for (let k = 0; k <= STEPS; k++) {
    const u = k / STEPS - 0.5;
    const bend = Math.sin((u + 0.5) * Math.PI) * 0.12 * unit;
    const x = cx + dx * u * len - dy * bend, y = cy + dy * u * len + dx * bend;
    const taper = 0.62 + 0.38 * Math.sin((u + 0.5) * Math.PI);
    g.beginPath(); g.ellipse(x, y, wid * 0.36 * taper, wid * 0.5 * taper, angle, 0, Math.PI * 2); g.fill();
  }
  // Bristles: thin streaks that run on past the body, unevenly loaded.
  g.lineCap = 'round';
  for (let b = 0; b < 9; b++) {
    const off = (b / 8 - 0.5) * wid * 0.98;
    const reach = 0.5 + r() * 0.12;
    g.globalAlpha = 0.45 + r() * 0.5;
    g.lineWidth = (unit / 40) * (1.5 + r() * 2.5);
    g.beginPath();
    for (let k = 0; k <= 12; k++) {
      const u = (k / 12 - 0.5) * 2 * reach;
      const bend = Math.sin((u / (2 * reach) + 0.5) * Math.PI) * 0.12 * unit;
      const x = cx + dx * u * len - dy * (bend + off), y = cy + dy * u * len + dx * (bend + off);
      if (k) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Draws a mask of thirty patches at `unit` pixels each (the app's masks, and the share card's bigger one). */
export function maskCanvas(paint: (g: CanvasRenderingContext2D) => void, unit = S): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = COLS * unit; c.height = ROWS * unit;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  paint(g);
  return c;
}

function cached(key: string, paint: (g: CanvasRenderingContext2D) => void): string {
  const hit = maskCache.get(key);
  if (hit) return hit;
  const url = maskCanvas(paint).toDataURL('image/png');
  if (maskCache.size > 200) maskCache.clear();
  maskCache.set(key, url);
  return url;
}

/** White where the underdrawing still shows: everywhere except the strokes already painted. */
export function sketchMask(painted: Iterable<number>, unit = S): HTMLCanvasElement {
  const list = [...painted];
  return maskCanvas((g) => {
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.globalCompositeOperation = 'destination-out';
    for (const i of list) brush(g, i, unit);
  }, unit);
}
export const sketchMaskURL = (painted: Iterable<number>) => {
  const list = [...painted].sort((a, b) => a - b);
  return cached('s' + list.join(','), (g) => {
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.globalCompositeOperation = 'destination-out';
    for (const i of list) brush(g, i);
  });
};

/** White in the shape of stroke i, less what earlier strokes already cover: the part this stroke paints. */
export function strokeMaskURL(i: number, before: Iterable<number> = []): string {
  const list = [...before].filter((x) => x !== i).sort((a, b) => a - b);
  return cached(`k${i}|` + list.join(','), (g) => {
    brush(g, i);
    g.globalCompositeOperation = 'destination-out';
    for (const j of list) brush(g, j);
  });
}
