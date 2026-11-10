// Turns a phone photo into an old oil painting, entirely on the device:
// 1. a Kuwahara filter flattens detail into brush-like patches of colour;
// 2. the colours are graded towards umber shadows, warm flesh mid-tones and ivory lights;
// 3. light falls from the upper left and the corners sink into shadow (chiaroscuro);
// 4. canvas weave, yellowed varnish and fine craquelure finish the surface.

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function paintRenaissance(src: ImageBitmap, seed = 1, max = 820): Promise<Blob> {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const W = Math.max(2, Math.round(src.width * k)), H = Math.max(2, Math.round(src.height * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  await nextFrame();
  kuwahara(img, Math.max(3, Math.round(Math.max(W, H) / 170)));
  await nextFrame();
  grade(img, seed);
  g.putImageData(img, 0, 0);
  await nextFrame();
  brushwork(g, img, seed);
  await nextFrame();
  craquelure(g, W, H, seed);
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.86));
}

/** Kuwahara with summed-area tables: each pixel takes the mean of its calmest quadrant. */
function kuwahara(img: ImageData, r: number) {
  const { width: W, height: H, data } = img;
  const S = (W + 1) * (H + 1);
  const sr = new Float64Array(S), sg = new Float64Array(S), sb = new Float64Array(S), sl = new Float64Array(S), sq = new Float64Array(S);
  for (let y = 0; y < H; y++) {
    let ar = 0, ag = 0, ab = 0, al = 0, aq = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B;
      ar += R; ag += G; ab += B; al += L; aq += L * L;
      const o = (y + 1) * (W + 1) + x + 1, u = y * (W + 1) + x + 1;
      sr[o] = sr[u] + ar; sg[o] = sg[u] + ag; sb[o] = sb[u] + ab; sl[o] = sl[u] + al; sq[o] = sq[u] + aq;
    }
  }
  const out = new Uint8ClampedArray(data.length);
  const box = (t: Float64Array, x0: number, y0: number, x1: number, y1: number) => t[y1 * (W + 1) + x1] - t[y0 * (W + 1) + x1] - t[y1 * (W + 1) + x0] + t[y0 * (W + 1) + x0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity, br = 0, bg = 0, bb = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(W, (q & 1 ? x + r : x) + 1);
        const y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(H, (q & 2 ? y + r : y) + 1);
        const n = (x1 - x0) * (y1 - y0);
        const m = box(sl, x0, y0, x1, y1) / n;
        const v = box(sq, x0, y0, x1, y1) / n - m * m;
        if (v < best) { best = v; br = box(sr, x0, y0, x1, y1) / n; bg = box(sg, x0, y0, x1, y1) / n; bb = box(sb, x0, y0, x1, y1) / n; }
      }
      const i = (y * W + x) * 4;
      out[i] = br; out[i + 1] = bg; out[i + 2] = bb; out[i + 3] = 255;
    }
  }
  data.set(out);
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rand(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

function grade(img: ImageData, seed: number) {
  const { width: W, height: H, data } = img;
  const rnd = rand(seed);
  const lx = W * (0.22 + rnd() * 0.16), ly = H * (0.12 + rnd() * 0.12);
  const diag = Math.hypot(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      // gentle S-curve on luminance
      const lc = l < 0.5 ? 0.5 * Math.pow(2 * l, 1.28) : 1 - 2 * (1 - l) * (1 - l) * 0.9 - (1 - l) * 0.1;
      const s = lc / Math.max(0.001, l);
      r *= s; g *= s; b *= s;
      // ease saturation back, keep reds rich
      const m = (r + g + b) / 3;
      r = m + (r - m) * 1.0; g = m + (g - m) * 0.9; b = m + (b - m) * 0.8;
      // umber shadows, ivory lights
      const tone = lc;
      const tr = 0.16 + tone * 0.8, tg = 0.1 + tone * 0.78, tb = 0.05 + tone * 0.66;
      r = r * 0.76 + tr * 0.24; g = g * 0.76 + tg * 0.24; b = b * 0.76 + tb * 0.24;
      // light from the upper left, shadow in the far corners
      const d = Math.hypot(x - lx, y - ly) / diag;
      const light = 1.1 - 0.42 * smooth(0.25, 1.0, d);
      // yellowed varnish and canvas weave
      const weave = (Math.sin(x * 2.1) * Math.sin(y * 2.1)) * 0.012 + (rnd() - 0.5) * 0.02;
      data[i] = Math.min(255, (r * light * 1.0 + weave) * 255);
      data[i + 1] = Math.min(255, (g * light * 0.96 + weave) * 255);
      data[i + 2] = Math.min(255, (b * light * 0.82 + weave) * 255);
    }
  }
}

/** Short strokes laid along the forms (perpendicular to the light gradient), each in the colour beneath it. */
function brushwork(g: CanvasRenderingContext2D, img: ImageData, seed: number) {
  const { width: W, height: H, data } = img;
  const rnd = rand(seed * 13 + 5);
  const lum = (x: number, y: number) => { const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114; };
  const n = Math.round((W * H) / 26);
  const size = Math.max(W, H) / 820;
  g.save();
  g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const gx = lum(x + 1, y) - lum(x - 1, y), gy = lum(x, y + 1) - lum(x, y - 1);
    const mag = Math.hypot(gx, gy);
    const a = mag > 4 ? Math.atan2(gy, gx) + Math.PI / 2 : (rnd() - 0.5) * 0.6 + 0.6; // flat areas: loose diagonal hatching
    const len = (mag > 24 ? 3 + rnd() * 4 : 6 + rnd() * 9) * size;
    const i = (y * W + x) * 4;
    const j = 1 + (rnd() - 0.5) * 0.09;
    g.strokeStyle = `rgba(${Math.min(255, data[i] * j) | 0}, ${Math.min(255, data[i + 1] * j) | 0}, ${Math.min(255, data[i + 2] * j) | 0}, ${0.55 + rnd() * 0.35})`;
    g.lineWidth = (1.4 + rnd() * 2.2) * size;
    const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
    g.beginPath(); g.moveTo(x - dx, y - dy); g.quadraticCurveTo(x + dy * 0.15, y - dx * 0.15, x + dx, y + dy); g.stroke();
  }
  g.restore();
}

/** Fine cracks in the paint layer, darker in the shadows, barely there in the lights. */
function craquelure(g: CanvasRenderingContext2D, W: number, H: number, seed: number) {
  const rnd = rand(seed * 7 + 3);
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.lineCap = 'round';
  const n = Math.round((W * H) / 1900);
  for (let k = 0; k < n; k++) {
    let x = rnd() * W, y = rnd() * H;
    let a = rnd() * Math.PI * 2;
    g.beginPath(); g.moveTo(x, y);
    const steps = 3 + Math.floor(rnd() * 5);
    for (let s = 0; s < steps; s++) { a += (rnd() - 0.5) * 1.3; x += Math.cos(a) * (4 + rnd() * 9); y += Math.sin(a) * (4 + rnd() * 9); g.lineTo(x, y); }
    g.strokeStyle = `rgba(52, 34, 16, ${0.1 + rnd() * 0.16})`;
    g.lineWidth = 0.5 + rnd() * 0.5;
    g.stroke();
  }
  g.globalCompositeOperation = 'soft-light';
  const v = g.createRadialGradient(W * 0.3, H * 0.22, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.7);
  v.addColorStop(0, 'rgba(255, 236, 190, 0.35)');
  v.addColorStop(1, 'rgba(20, 10, 0, 0.35)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.restore();
}

/** Receipts become a page of an old ledger: iron-gall ink on vellum, with fibres and a darker edge. */
export async function paintParchment(src: ImageBitmap, seed = 1, max = 900): Promise<Blob> {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const W = Math.max(2, Math.round(src.width * k)), H = Math.max(2, Math.round(src.height * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H); const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
  const n = W * H; let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.03) { lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.12) { hi = i; break; } }
  const rnd = rand(seed);
  const ink = [46, 30, 16], vellum = [240, 226, 194];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const t = smooth(0.15, 0.85, (l - lo) / Math.max(20, hi - lo));
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y) / Math.min(W, H);
      const age = 1 - 0.16 * (1 - smooth(0, 0.18, edge)) + (rnd() - 0.5) * 0.04;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = (ink[ch] + (vellum[ch] - ink[ch]) * t) * (ch === 2 ? age * 0.97 : age);
    }
  }
  g.putImageData(img, 0, 0);
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (let k2 = 0; k2 < (W * H) / 900; k2++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, len = 3 + rnd() * 10;
    g.strokeStyle = `rgba(150, 120, 80, ${0.05 + rnd() * 0.08})`; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  g.restore();
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.84));
}
