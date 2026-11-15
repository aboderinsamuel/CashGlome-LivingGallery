import { useEffect, useRef, type CSSProperties } from 'react';
import { artSrc, PAINTINGS } from '../lib/art';
import { FRAG, VERT } from './shader';
import type { Mood } from './mood';

/** A brushstroke of colour an entry leaves on the canvas, in the painting's own coordinates (0..1). */
export interface Stroke { id: string; x: number; y: number; angle: number; len: number; width: number; born: number }

interface Props {
  id: string;
  stage: number;
  mood: Mood;
  night: number;
  strokes: Stroke[];
  /** Changes each time a line is kept: a brief warmth passes over the painting. */
  flash?: number;
  focus?: [number, number];
  style?: CSSProperties;
  className?: string;
  onReady?: (ok: boolean) => void;
}

const STROKE_MS = 1100;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

/** Paints each stroke as a run of soft dabs along a gentle curve, the way a loaded brush lays glaze. */
export function paintMask(ctx: CanvasRenderingContext2D, strokes: Stroke[], now: number) {
  const { width: W, height: H } = ctx.canvas;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  let moving = false;
  for (const s of strokes) {
    const t = Math.min(1, (now - s.born) / STROKE_MS);
    if (t < 1) moving = true;
    const e = 1 - Math.pow(1 - t, 3);
    const steps = Math.max(2, Math.round(46 * e));
    const dx = Math.cos(s.angle), dy = Math.sin(s.angle);
    // A loaded brush: a soft body of glaze, plus bristles that leave streaks along the stroke.
    for (let i = 0; i < steps; i++) {
      const u = (i / 46) - 0.5;
      const bend = Math.sin((u + 0.5) * Math.PI) * 0.18 * s.len;
      const cx = s.x + dx * u * s.len - dy * bend, cy = s.y + dy * u * s.len + dx * bend;
      const taper = Math.sin((i / 46) * Math.PI) * 0.7 + 0.3;
      const r = s.width * W * taper;
      const body = ctx.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, r);
      body.addColorStop(0, 'rgba(255,255,255,0.09)'); body.addColorStop(0.55, 'rgba(255,255,255,0.05)'); body.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx * W, cy * H, r, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 9; k++) {
        const off = (k / 8 - 0.5) * 1.7 * r;
        const dry = Math.abs(Math.sin(k * 91.7 + s.x * 300)); // each bristle carries its own amount of paint
        if (i / 46 > 0.35 + dry * 0.65) continue; // dry bristles run out first
        const bx = cx * W - dy * off, by = cy * H + dx * off;
        const br = r * (0.22 + 0.12 * dry);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `rgba(255,255,255,${0.06 + 0.1 * (1 - dry)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  return moving;
}

/** The month's painting, alive: drawn every frame by one shader on the device. */
export function LivingCanvas({ id, stage, mood, night, strokes, flash = 0, focus, style, className, onReady }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stage, mood, night, strokes, flash, focus });
  live.current = { stage, mood, night, strokes, flash, focus };

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) { canvas.dataset.fallback = '1'; onReady?.(false); return; }
    let disposed = false, raf = 0;
    const prog = gl.createProgram()!;
    try {
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
    } catch (e) { console.warn('[canvas]', e); canvas.dataset.fallback = '1'; onReady?.(false); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = { img: U('uImg'), mask: U('uMask'), res: U('uRes'), size: U('uImgSize'), focus: U('uFocus'), pointer: U('uPointer'), light: U('uLight'), stage: U('uStage'), time: U('uTime'), night: U('uNight'), zoom: U('uZoom'), flash: U('uFlash'), mood: U('uMood') };

    const tex = (unit: number) => { const t = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const imgTex = tex(0), maskTex = tex(1);
    gl.uniform1i(u.img, 0); gl.uniform1i(u.mask, 1);

    const maskCanvas = document.createElement('canvas');
    const mctx = maskCanvas.getContext('2d')!;
    let imgW = 1, imgH = 1, ready = false, maskDirty = true, lastStrokes: Stroke[] = [];

    // The small copy first, so the painting is there at once; the large one replaces it when it arrives.
    const load = (size: 'md' | 'lg') => {
      const img = new Image();
      img.decoding = 'async';
      img.src = artSrc(id, size);
      img.onload = () => {
        if (disposed) return;
        const first = !ready;
        imgW = img.naturalWidth; imgH = img.naturalHeight;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imgTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (first) { maskCanvas.width = 512; maskCanvas.height = Math.round(512 * imgH / imgW); ready = true; maskDirty = true; requestAnimationFrame(() => onReady?.(true)); }
        if (size === 'md' && window.innerWidth * devicePixelRatio > 1100) load('lg');
      };
    };
    load('md');

    // The pointer moves the light and, very slightly, the scene. Phones use the tilt of the device instead.
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, lx: 0.55, ly: 0.45, tlx: 0.55, tly: 0.45 };
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; ptr.tx = (x - 0.5) * -2; ptr.ty = (y - 0.5) * -2; ptr.tlx = x; ptr.tly = y; };
    const tilt = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; ptr.tx = Math.max(-1, Math.min(1, e.gamma / 25)); ptr.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25)); ptr.tlx = 0.5 - ptr.tx * 0.3; ptr.tly = 0.45 - ptr.ty * 0.3; };
    window.addEventListener('pointermove', move);
    window.addEventListener('deviceorientation', tilt);

    const still = reduced();
    const cur = { ...live.current.mood, stage: live.current.stage, night: live.current.night, flash: 0 };
    let lastFlash = live.current.flash;
    const t0 = performance.now();
    let prev = t0;

    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const L = live.current;
      // Size to the element, capped so a big screen doesn't cook a laptop.
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      if (!ready) return;
      // Everything eases: the week's light changes over about a second, like a cloud passing.
      const k = 1 - Math.exp(-dt * 1.6);
      cur.calm += (L.mood.calm - cur.calm) * k; cur.rush += (L.mood.rush - cur.rush) * k;
      cur.weight += (L.mood.weight - cur.weight) * k; cur.plenty += (L.mood.plenty - cur.plenty) * k;
      cur.stage += (L.stage - cur.stage) * (1 - Math.exp(-dt * 0.8));
      cur.night += (L.night - cur.night) * k;
      if (L.flash !== lastFlash) { lastFlash = L.flash; cur.flash = 1; }
      cur.flash *= Math.exp(-dt * 1.4);
      const kp = 1 - Math.exp(-dt * 3);
      ptr.x += (ptr.tx - ptr.x) * kp; ptr.y += (ptr.ty - ptr.y) * kp;
      ptr.lx += (ptr.tlx - ptr.lx) * kp; ptr.ly += (ptr.tly - ptr.ly) * kp;

      if (L.strokes !== lastStrokes) { lastStrokes = L.strokes; maskDirty = true; }
      if (maskDirty) {
        maskDirty = paintMask(mctx, L.strokes, now);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
      }
      const p = PAINTINGS[id];
      const f = L.focus ?? (p ? p.focus.split(' ').map((s) => parseFloat(s) / 100) as [number, number] : [0.5, 0.5]);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h); gl.uniform2f(u.size, imgW, imgH); gl.uniform2f(u.focus, f[0], f[1]);
      gl.uniform2f(u.pointer, still ? 0 : ptr.x, still ? 0 : ptr.y); gl.uniform2f(u.light, ptr.lx, ptr.ly);
      gl.uniform1f(u.stage, cur.stage); gl.uniform1f(u.time, still ? 0 : (now - t0) / 1000);
      gl.uniform1f(u.night, cur.night); gl.uniform1f(u.zoom, 1.06); gl.uniform1f(u.flash, cur.flash);
      gl.uniform4f(u.mood, cur.calm, cur.rush, cur.weight, cur.plenty);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('deviceorientation', tilt);
      gl.deleteTexture(imgTex); gl.deleteTexture(maskTex); gl.deleteBuffer(buf); gl.deleteProgram(prog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return <canvas ref={ref} className={className} style={{ display: 'block', width: '100%', height: '100%', ...style }} aria-label={PAINTINGS[id]?.title} role="img" />;
}

/** Where an entry's stroke lands: settled by its id, larger for larger sums, kept off the very edges. */
export function strokeFor(entryId: string, amount: number, born: number, bias: [number, number] = [0.5, 0.55]): Stroke {
  let h = 2166136261;
  for (let i = 0; i < entryId.length; i++) { h ^= entryId.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = (n: number) => (((h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0) % 10000) / 10000) * n;
  const size = Math.min(1, Math.max(0.25, Math.log10(Math.max(10, amount)) / 6));
  return {
    id: entryId,
    x: Math.min(0.84, Math.max(0.16, bias[0] + (r(1) - 0.5) * 0.7)),
    y: Math.min(0.64, Math.max(0.16, bias[1] + (r(1) - 0.5) * 0.46)),
    angle: -0.6 + r(1.2),
    len: 0.14 + 0.2 * size,
    width: 0.035 + 0.05 * size,
    born,
  };
}
