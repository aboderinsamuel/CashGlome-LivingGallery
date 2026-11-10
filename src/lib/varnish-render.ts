// Draws the "under old varnish" copy of a painting: browned, softened, blotched with grime and specks.
// Shared by the worker and the main-thread fallback, so it only touches canvas APIs both have.

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export interface VarnishJob { w: number; h: number; ax: number; ay: number }

/** Deterministic, so a painting always ages the same way. */
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

export function renderVarnish(make: (w: number, h: number) => AnyCanvas, src: ImageBitmap, { w, h, ax, ay }: VarnishJob): AnyCanvas {
  // Cover-crop exactly like object-fit: cover with object-position ax/ay.
  const k = Math.max(w / src.width, h / src.height);
  const sw = w / k, sh = h / k, sx = (src.width - sw) * ax, sy = (src.height - sh) * ay;
  // A soft blur: draw at half size, then back up.
  const half = make(Math.round(w / 2), Math.round(h / 2)), hc = half.getContext('2d') as Canvas2D;
  hc.imageSmoothingQuality = 'high';
  hc.drawImage(src, sx, sy, sw, sh, 0, 0, half.width, half.height);
  const out = make(w, h), c = out.getContext('2d') as Canvas2D;
  c.imageSmoothingQuality = 'high';
  c.drawImage(half, 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h), d = img.data;

  const blotch = noise(make, w, h, [[7, 9, 0.45], [15, 19, 0.33], [31, 39, 0.22]], 7);
  const speck = noise(make, w, h, [[60, 75, 0.55], [140, 175, 0.45]], 3);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    // Yellowed varnish: the same colour matrix the old SVG filter used.
    let r = 0.34 * R + 0.55 * G + 0.13 * B - 5, g = 0.27 * R + 0.45 * G + 0.1 * B - 10, b = 0.15 * R + 0.3 * G + 0.07 * B - 15;
    // Brown grime in blotches.
    const a1 = Math.min(1, Math.max(0, (0.62 - blotch[p]) * 2.6)) * 0.75;
    r += (46 - r) * a1; g += (28 - g) * a1; b += (10 - b) * a1;
    // Dark specks and veins.
    const a2 = Math.min(1, Math.max(0, (0.4 - speck[p]) * 7)) * 0.5;
    r += (20 - r) * a2; g += (13 - g) * a2; b += (5 - b) * a2;
    // An even film over everything.
    r += (58 - r) * 0.18; g += (42 - g) * 0.18; b += (18 - b) * 0.18;
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  c.putImageData(img, 0, 0);
  return out;
}
