// The varnished copy of each painting is drawn once, off the main thread, and then shown as a plain image.
// (It used to be live SVG filters, which the browser re-rasterised on every change and froze the page.)
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

async function make(id: string, w: number, h: number, ax: number, ay: number): Promise<string> {
  const src = await bitmapOf(id);
  const wk = getWorker();
  if (wk) {
    try {
      const blob = await new Promise<Blob>((ok, fail) => { const n = ++seq; waiting.set(n, { ok, fail }); wk.postMessage({ id: n, src, w, h, ax, ay }, [src]); });
      return URL.createObjectURL(blob);
    } catch { /* fall through to the main thread */ }
  }
  const again = src.width ? src : await bitmapOf(id); // a transferred bitmap is detached
  await new Promise<void>((r) => idle(() => r()));
  const c = renderVarnish((cw, ch) => Object.assign(document.createElement('canvas'), { width: cw, height: ch }), again, { w, h, ax, ay }) as HTMLCanvasElement;
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.86));
  return URL.createObjectURL(blob);
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

/* Masks: a tiny grid, one cell per patch, scaled up by the browser; the smoothing feathers the edges. */
const PX = 4; // mask pixels per patch: fewer = softer edges (the browser smooths the stretch)
const maskCache = new Map<string, string>();
/** White where the varnish should show. */
export function cellMask(cells: Iterable<number>): string {
  const list = [...cells].sort((a, b) => a - b);
  const k = list.join(',');
  const hit = maskCache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas'); c.width = COLS * PX; c.height = ROWS * PX;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  for (const i of list) g.fillRect((i % COLS) * PX, Math.floor(i / COLS) * PX, PX, PX);
  const url = c.toDataURL('image/png');
  if (maskCache.size > 200) maskCache.clear();
  maskCache.set(k, url);
  return url;
}
