// The README hero: the app's own shader on a real Old Master, rendered frame by frame so it can be
// encoded as a looping GIF. Open /scripts/hero/hero.html in the dev server to watch it play;
// scripts/make-hero.cjs drives window.hero to export docs/assets/hero.gif.
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/inter';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { VERT, FRAG } from '../../src/stage/shader';
import { paintMask, type Stroke } from '../../src/stage/LivingCanvas';

const W = 1200, H = 400;
const FPS = 12, SECONDS = 8;
const FRAMES = FPS * SECONDS;
const ART = '/art/teniers.jpg';
const FOCUS: [number, number] = [0.5, 0.42];

const LINE = 'lunch 6k, bus 2.5k, got paid 350k';
// Where each entry's stroke lands on the painting (image UV), and when it is kept (seconds).
const KEEPS = [
  { at: 2.2, upto: 'lunch 6k,', s: { x: 0.13, y: 0.52, angle: 1.2, len: 0.34, width: 0.085 } },
  { at: 3.2, upto: 'lunch 6k, bus 2.5k,', s: { x: 0.80, y: 0.50, angle: -0.25, len: 0.34, width: 0.085 } },
  { at: 4.3, upto: LINE, s: { x: 0.60, y: 0.28, angle: 0.12, len: 0.5, width: 0.11 } },
];

const out = document.getElementById('out') as HTMLCanvasElement;
out.width = W; out.height = H;
const ctx = out.getContext('2d', { willReadFrequently: true })!;

const gc = document.createElement('canvas');
gc.width = W; gc.height = H;
const gl = gc.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false })!;
const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)!); return s; };
const prog = gl.createProgram()!;
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
const U = (n: string) => gl.getUniformLocation(prog, n);
const tex = (unit: number) => { const t = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
const imgTex = tex(0), maskTex = tex(1);
gl.uniform1i(U('uImg'), 0); gl.uniform1i(U('uMask'), 1);

const mask = document.createElement('canvas');
const mctx = mask.getContext('2d')!;
let imgW = 1, imgH = 1;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

/** The painting at time t (seconds), with the strokes kept so far. */
function paint(t: number) {
  const strokes: Stroke[] = KEEPS.filter((k) => t >= k.at).map((k, i) => ({ id: 'k' + i, ...k.s, born: k.at * 1000 }));
  mask.width = 640; mask.height = Math.round(640 * imgH / imgW);
  paintMask(mctx, strokes, t * 1000);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
  // Chalk, then the whole canvas follows the strokes through grisaille and glaze to varnish.
  const stage = 3 * seg(t, 4.7, 6.0);
  const flash = KEEPS.reduce((f, k) => f + (t >= k.at ? Math.exp(-(t - k.at) * 2.2) : 0), 0);
  gl.viewport(0, 0, W, H);
  gl.uniform2f(U('uRes'), W, H); gl.uniform2f(U('uImgSize'), imgW, imgH); gl.uniform2f(U('uFocus'), ...FOCUS);
  gl.uniform2f(U('uPointer'), 0, 0); gl.uniform2f(U('uLight'), 0.5, 0.4);
  gl.uniform1f(U('uStage'), stage);
  gl.uniform1f(U('uTime'), 7.0); // a fixed clock: steady grain keeps the GIF small
  gl.uniform1f(U('uNight'), 0); gl.uniform1f(U('uZoom'), 1.05); gl.uniform1f(U('uFlash'), 0 * flash);
  gl.uniform4f(U('uMood'), 0.7, 0, 0, 0.35 * seg(t, 4.7, 6.0));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const SERIF = "'Newsreader Variable', Georgia, serif";
const UI = "'Inter Variable', 'Segoe UI', sans-serif";
function spaced(text: string, x: number, y: number, track: number, align: 'left' | 'center' | 'right') {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  [...text].forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + track; });
}

/** One frame: the painting, a veil for legibility, the words, and the quill. */
function frame(t: number) {
  paint(t);
  ctx.globalAlpha = 1;
  ctx.drawImage(gc, 0, 0);
  // Veil: dark at the centre band where the words sit, softer at the edges so the painting shows.
  const v = ctx.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.46, W * 0.55);
  v.addColorStop(0, 'rgba(14,10,6,0.66)'); v.addColorStop(0.55, 'rgba(14,10,6,0.42)'); v.addColorStop(1, 'rgba(14,10,6,0.18)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const lin = ctx.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, 'rgba(14,10,6,0.35)'); lin.addColorStop(0.2, 'rgba(14,10,6,0)'); lin.addColorStop(0.8, 'rgba(14,10,6,0)'); lin.addColorStop(1, 'rgba(14,10,6,0.55)');
  ctx.fillStyle = lin; ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18;
  // Kicker.
  ctx.fillStyle = 'rgba(233,204,136,0.92)'; ctx.font = `600 12.5px ${UI}`;
  spaced('WRITE  ·  SEE  ·  ASK', W / 2, 62, 4.2, 'center');
  // Wordmark.
  ctx.fillStyle = '#F6EEDC'; ctx.font = `400 104px ${SERIF}`; ctx.textAlign = 'center';
  ctx.fillText('CashGlome', W / 2, 168);
  // Subtitle with one italic phrase.
  const a = 'Write what it cost. ', b = 'Watch it painted.';
  ctx.font = `400 27px ${SERIF}`; const wa = ctx.measureText(a).width;
  ctx.font = `italic 400 27px ${SERIF}`; const wb = ctx.measureText(b).width;
  const sx = W / 2 - (wa + wb) / 2;
  ctx.textAlign = 'left';
  ctx.font = `400 27px ${SERIF}`; ctx.fillStyle = 'rgba(246,238,220,0.88)'; ctx.fillText(a, sx, 214);
  ctx.font = `italic 400 27px ${SERIF}`; ctx.fillStyle = '#E9CC88'; ctx.fillText(b, sx + wa, 214);
  ctx.shadowBlur = 0;

  // The quill: a parchment slip where the line is written, then the museum label takes its place.
  const typed = LINE.slice(0, Math.max(0, Math.min(LINE.length, Math.floor((t - 0.9) * 10.5))));
  const quillIn = seg(t, 0.5, 0.9) * (1 - seg(t, 5.4, 5.8));
  if (quillIn > 0) {
    ctx.globalAlpha = quillIn;
    const qw = 440, qh = 46, qx = W / 2 - qw / 2, qy = 250;
    ctx.fillStyle = 'rgba(238,230,214,0.95)';
    ctx.beginPath(); ctx.roundRect(qx, qy, qw, qh, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(226,194,122,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#8A6418'; ctx.font = `400 19px ${SERIF}`; ctx.fillText('₦', qx + 16, qy + 30);
    ctx.font = `400 21px ${SERIF}`; ctx.fillStyle = typed ? '#2A2016' : 'rgba(42,32,22,0.42)';
    if (!typed) ctx.font = `italic 400 21px ${SERIF}`;
    const shown = typed || 'What did today cost?';
    ctx.fillText(shown, qx + 40, qy + 30);
    if (typed && typed.length < LINE.length && Math.floor(t * 3) % 2 === 0) {
      const cw = ctx.measureText(shown).width; ctx.fillStyle = '#2A2016'; ctx.fillRect(qx + 42 + cw, qy + 13, 1.5, 22);
    }
    // Kept entries bloom as small gold words that rise from the slip into the painting.
    KEEPS.forEach((k, i) => {
      const d = t - k.at; if (d < 0 || d > 1.2) return;
      const word = ['lunch 6k', 'bus 2.5k', 'got paid 350k'][i];
      ctx.globalAlpha = quillIn * Math.sin(Math.PI * Math.min(1, d / 1.2));
      ctx.fillStyle = '#E9CC88'; ctx.font = `italic 400 18px ${SERIF}`; ctx.textAlign = 'center';
      ctx.fillText(word, W / 2 + (i - 1) * 150, qy + qh + 24 + d * 12);
      ctx.textAlign = 'left';
    });
  }
  const labelIn = seg(t, 5.7, 6.2);
  if (labelIn > 0) {
    ctx.globalAlpha = labelIn; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(246,238,220,0.92)'; ctx.font = `italic 400 20px ${SERIF}`;
    ctx.fillText('Archduke Leopold Wilhelm in His Gallery', W / 2, 276);
    ctx.fillStyle = 'rgba(233,204,136,0.85)'; ctx.font = `500 11.5px ${UI}`;
    spaced('DAVID TENIERS THE YOUNGER  ·  C. 1651  ·  PUBLIC DOMAIN', W / 2, 300, 2.4, 'center');
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  // Footer, as on a museum wall.
  ctx.fillStyle = 'rgba(246,238,220,0.62)'; ctx.font = `500 11px ${UI}`;
  spaced('FIREBASE AI LOGIC  ·  GEMINI NANO ON DEVICE  ·  GEMINI IN THE CLOUD  ·  WEBGL2', 30, H - 26, 2.6, 'left');
  spaced('A PRIVATE MONEY DIARY, PAINTED', W - 30, H - 26, 2.6, 'right');
}

/** Frame i of the loop. The last second crossfades back to the first frame so the loop is seamless. */
function render(i: number) {
  const t = i / FPS;
  const fadeFrom = SECONDS - 0.75;
  if (t <= fadeFrom) { frame(t); return; }
  frame(0); const first = ctx.getImageData(0, 0, W, H);
  frame(t);
  ctx.globalAlpha = seg(t, fadeFrom, SECONDS);
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d')!.putImageData(first, 0, 0);
  ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
}

/** Encodes the whole loop: one shared palette, unchanged pixels left transparent so the file stays small. */
function encode(step = 1): Uint8Array {
  const samples: Uint8ClampedArray[] = [];
  for (const t of [0.2, 3.0, 4.6, 5.4, 6.2, 6.8]) { frame(t); samples.push(ctx.getImageData(0, 0, W, H).data); }
  const n = samples.reduce((a, s) => a + s.length / 4, 0);
  const pool = new Uint8ClampedArray(Math.ceil(n / 3) * 4);
  let o = 0; for (const s of samples) for (let p = 0; p < s.length; p += 12) { pool[o++] = s[p]; pool[o++] = s[p + 1]; pool[o++] = s[p + 2]; pool[o++] = 255; }
  const palette = quantize(pool.subarray(0, o), 255, { format: 'rgb565' });
  const TR = palette.length; palette.push([0, 0, 0]);
  const gif = GIFEncoder();
  let prev: Uint8Array | null = null;
  for (let i = 0; i < FRAMES; i += step) {
    render(i);
    const idx = applyPalette(ctx.getImageData(0, 0, W, H).data, palette, 'rgb565');
    if (prev) { const keep = idx.slice(); for (let p = 0; p < idx.length; p++) if (idx[p] === prev[p]) idx[p] = TR; prev = keep; } else prev = idx.slice();
    gif.writeFrame(idx, W, H, { palette: i === 0 ? palette : undefined, delay: Math.round(1000 / FPS) * step, transparent: i > 0, transparentIndex: TR, dispose: 1, repeat: 0 });
  }
  gif.finish();
  return gif.bytes();
}

const toB64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const toPngB64 = () => out.toDataURL('image/png').split(',')[1];

async function boot() {
  await Promise.all([document.fonts.load(`400 104px ${SERIF}`), document.fonts.load(`italic 400 27px ${SERIF}`), document.fonts.load(`600 12px ${UI}`)]);
  const img = new Image(); img.src = ART; await img.decode();
  imgW = img.naturalWidth; imgH = img.naturalHeight;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imgTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  (window as unknown as { hero: unknown }).hero = {
    W, H, FRAMES, FPS,
    still: (t: number) => { frame(t); return toPngB64(); },
    gif: (step = 1) => toB64(encode(step)),
  };
  // Playback for a person watching the page.
  if (!new URLSearchParams(location.search).has('export')) {
    const t0 = performance.now();
    const loop = (now: number) => { render(Math.floor(((now - t0) / 1000 * FPS)) % FRAMES); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  document.title = 'ready';
}
boot();
