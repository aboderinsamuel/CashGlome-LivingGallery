// Draws the month's painting as its underdrawing: the sinopia a painter lays on the canvas before any colour.
// Bare linen, the drawing in red chalk, a light hatching in the shadows. Every entry then paints a stroke of
// the real colour over it. The same look as the living canvas's first stage (stage/shader.ts), drawn once on
// the CPU so a plate can show it as a plain image. Shared by the worker and the main-thread fallback, so it
// only touches canvas APIs both have. (The file keeps its old name; it used to draw varnish.)

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export interface VarnishJob { w: number; h: number; ax: number; ay: number }

/** Deterministic, so a painting is always drawn the same way. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Smooth value noise in [0,1]: small random grids scaled up with bilinear smoothing, summed over octaves. */
function noise(make: (w: number, h: number) => AnyCanvas, w: number, h: number, grids: [number, number, number][], seed: number) {
  const out = new Float32Array(w * h);
  const r = rng(seed);
  for (const [gw, gh, weight] of grids) {
    const small = make(gw, gh), sc = small.getContext('2d') as Canvas2D;
    const id = sc.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) { const v = r() * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    sc.putImageData(id, 0, 0);
    const big = make(w, h), bc = big.getContext('2d') as Canvas2D;
    bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
    bc.drawImage(small, 0, 0, w, h);
    const px = bc.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) out[i] += (px[i * 4] / 255) * weight;
  }
  return out;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function renderVarnish(make: (w: number, h: number) => AnyCanvas, src: ImageBitmap | HTMLImageElement, { w, h, ax, ay }: VarnishJob): AnyCanvas {
  // Cover-crop exactly like object-fit: cover with object-position ax/ay.
  const iw = 'naturalWidth' in src ? src.naturalWidth : src.width, ih = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const k = Math.max(w / iw, h / ih);
  const sw = w / k, sh = h / k, sx = (iw - sw) * ax, sy = (ih - sh) * ay;
  // Read the picture a little softened, so the chalk follows forms, not every brush hair.
  const half = make(Math.round(w / 2), Math.round(h / 2)), hc = half.getContext('2d') as Canvas2D;
  hc.imageSmoothingQuality = 'high';
  hc.drawImage(src, sx, sy, sw, sh, 0, 0, half.width, half.height);
  const out = make(w, h), c = out.getContext('2d') as Canvas2D;
  c.imageSmoothingQuality = 'high';
  c.drawImage(half, 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h), d = img.data;

  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) L[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  const grain = noise(make, w, h, [[90, 112, 0.5], [220, 275, 0.5]], 5);
  const wash = noise(make, w, h, [[6, 8, 0.6], [14, 18, 0.4]], 9);
  const s = Math.max(1, Math.round(w / 600)); // sample distance for the edges, so a big plate draws the same lines
  const period = Math.max(3, w / 120); // hatching spacing, the same on a small plate and a big one

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const xl = Math.max(0, x - s), xr = Math.min(w - 1, x + s), yt = Math.max(0, y - s), yb = Math.min(h - 1, y + s);
      const tl = L[yt * w + xl], t = L[yt * w + x], tr = L[yt * w + xr];
      const l = L[y * w + xl], r = L[y * w + xr];
      const bl = L[yb * w + xl], b = L[yb * w + x], br = L[yb * w + xr];
      const gx = -tl - 2 * l - bl + tr + 2 * r + br, gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const edge = smooth(0.14, 0.5, Math.hypot(gx, gy) + (grain[p] - 0.5) * 0.06);
      const shade = 1 - L[p];
      // Linen: a warm ground with a faint weave and the unevenness of a hand-laid priming.
      const weave = 0.965 + 0.035 * Math.sin(x * 1.7) * Math.sin(y * 1.7) - (wash[p] - 0.5) * 0.06;
      const lr = 232 * weave, lg = 219 * weave, lb = 196 * weave;
      // A light hatching in the shadows, the way a draughtsman models form.
      const hv = (x - y * 0.6) / period;
      const hatch = smooth(0.55, 0.66, hv - Math.floor(hv)) * smooth(0.7, 0.97, shade) * smooth(0.35, 0.65, wash[p]) * 0.13;
      const a = Math.min(1, edge * 0.8 + hatch + smooth(0.35, 1, shade) * 0.15);
      // Red chalk (sanguine).
      d[(p << 2)] = lr + (153 - lr) * a;
      d[(p << 2) + 1] = lg + (64 - lg) * a;
      d[(p << 2) + 2] = lb + (41 - lb) * a;
    }
  }
  c.putImageData(img, 0, 0);
  return out;
}
