// The month's painting as its underdrawing (red chalk on bare linen), drawn on a canvas over the finished picture.
// A finger or a mouse brushes the colour in for a moment and it fades back to the drawing; only a written line
// paints it for good, in broad brush strokes. (The component keeps its old name: it used to be varnish.)
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { renderVarnish } from '../lib/varnish-render';

export interface VarnishHandle {
  /** Paint one broad stroke for good (the i-th of the cover's strokes). Resolves when it's done. */
  stroke: (i: number, ms?: number) => Promise<void>;
}

interface Props {
  src: string;
  /** A tiny copy shown at once while the full picture arrives. */
  low?: string;
  /** Where the picture sits in its frame, as CSS object-position ("45% 72%"). */
  focus: string;
  calm?: boolean;
  /** A brush across the middle on its own, once, so the first second already moves. */
  demo?: boolean;
  onRub?: () => void;
  onReady?: () => void;
}

/** The permanent strokes, in the frame's own proportions: three broad sweeps a restorer might make. */
const STROKES: [number, number][][] = [
  [[0.08, 0.58], [0.32, 0.46], [0.6, 0.6], [0.94, 0.44]],
  [[0.1, 0.24], [0.4, 0.34], [0.62, 0.18], [0.92, 0.3]],
  [[0.06, 0.86], [0.36, 0.76], [0.66, 0.9], [0.95, 0.76]],
];
const DEMO: [number, number][] = [[0.18, 0.62], [0.4, 0.5], [0.6, 0.58], [0.8, 0.46]];

const bez = (p: [number, number][], t: number): [number, number] => {
  const u = 1 - t;
  const [a, b, c, d] = p;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};

/** A seeded sequence, so the cracks and bristles are the same every time. */
function seeded(seed: number) { let s = seed; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

export const Varnish = forwardRef<VarnishHandle, Props>(function Varnish({ src, low, focus, calm, demo, onRub, onReady }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    img: null as HTMLImageElement | null,
    w: 0, h: 0,
    varnish: document.createElement('canvas'),
    perm: document.createElement('canvas'),
    temp: document.createElement('canvas'),
    done: [] as number[], // permanent strokes already painted (redrawn on resize)
    lastRub: 0, raf: 0, rubbed: false,
  });
  const onRubRef = useRef(onRub); onRubRef.current = onRub;
  const [fx, fy] = focus.split(' ').map((v) => parseFloat(v) / 100);

  /** The picture as the frame shows it (object-fit: cover at the focus point). */
  const place = (iw: number, ih: number, cw: number, ch: number) => {
    const k = Math.max(cw / iw, ch / ih);
    const dw = iw * k, dh = ih * k;
    return { x: (cw - dw) * fx, y: (ch - dh) * fy, dw, dh };
  };

  const paintVarnish = () => {
    const s = st.current; const { img, w, h } = s;
    if (!img || !w || !h) return;
    const v = s.varnish; v.width = w; v.height = h;
    const c = v.getContext('2d')!;
    // Drawn at half size (one CSS pixel on most phones) and set in place: quick enough for the first second.
    const hw = Math.max(2, Math.round(w / 2)), hh = Math.max(2, Math.round(h / 2));
    const half = renderVarnish((cw, ch) => Object.assign(document.createElement('canvas'), { width: cw, height: ch }), img, { w: hw, h: hh, ax: fx, ay: fy }) as HTMLCanvasElement;
    c.imageSmoothingQuality = 'high';
    c.drawImage(half, 0, 0, w, h);
    box.current?.setAttribute('data-on', '');
  };

  const render = () => {
    const s = st.current; const el = cv.current;
    if (!el || !s.w) return;
    const c = el.getContext('2d')!;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, s.w, s.h);
    c.drawImage(s.varnish, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.drawImage(s.perm, 0, 0);
    c.drawImage(s.temp, 0, 0);
    c.globalCompositeOperation = 'source-over';
  };

  /** One dab of paint: soft at the rim, firm in the middle. */
  const dab = (c: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1, core = 0.55) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(core, `rgba(0,0,0,${a * 0.9})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  };

  /** A brush stroke along a curve, with bristle streaks at its edges. Draws up to `upto` of it (0..1). */
  const brushAlong = (c: CanvasRenderingContext2D, path: [number, number][], from: number, upto: number, seed: number) => {
    const s = st.current; const r = Math.min(s.w, s.h) * 0.13;
    const steps = Math.max(1, Math.ceil((upto - from) * 90));
    for (let i = 0; i <= steps; i++) {
      const t = from + ((upto - from) * i) / steps;
      const [nx, ny] = bez(path, t);
      const [ax, ay] = bez(path, Math.min(1, t + 0.01));
      const ang = Math.atan2(ay - ny, ax - nx) + Math.PI / 2;
      const x = nx * s.w, y = ny * s.h;
      // The stroke swells in the middle and thins at both ends, like a loaded brush.
      const swell = 0.55 + 0.45 * Math.sin(Math.PI * t);
      dab(c, x, y, r * swell, 1, 0.7);
      // Bristle streaks only at the stroke's edges, so its body comes up clean.
      const rnd = seeded(seed * 1000 + Math.round(t * 400));
      for (let k = 0; k < 4; k++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const off = side * (0.8 + rnd() * 0.35) * r * swell;
        dab(c, x + Math.cos(ang) * off, y + Math.sin(ang) * off, r * 0.2 * swell, 0.5 + rnd() * 0.5, 0.4);
      }
    }
  };

  const loop = () => {
    const s = st.current;
    const tc = s.temp.getContext('2d')!;
    const idle = performance.now() - s.lastRub;
    if (idle > 700) {
      // Brushed colour fades back to the drawing.
      tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = 'rgba(0,0,0,0.05)'; tc.fillRect(0, 0, s.w, s.h);
      tc.globalCompositeOperation = 'source-over';
    }
    render();
    if (idle > 3200) { tc.clearRect(0, 0, s.w, s.h); render(); s.raf = 0; return; }
    s.raf = requestAnimationFrame(loop);
  };
  const wake = () => { const s = st.current; if (!s.raf) s.raf = requestAnimationFrame(loop); };

  const size = () => {
    const s = st.current; const el = cv.current; const b = box.current;
    if (!el || !b) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(b.clientWidth * dpr), h = Math.round(b.clientHeight * dpr);
    if (!w || !h || (w === s.w && h === s.h)) return;
    s.w = w; s.h = h;
    el.width = w; el.height = h;
    for (const c of [s.perm, s.temp]) { c.width = w; c.height = h; }
    paintVarnish();
    const pc = s.perm.getContext('2d')!;
    for (const i of s.done) brushAlong(pc, STROKES[i % STROKES.length], 0, 1, i + 1);
    render();
  };

  // The picture: the tiny copy at once, then the full one.
  useEffect(() => {
    let live = true;
    const load = (url: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const take = (i: HTMLImageElement) => { if (!live) return; st.current.img = i; st.current.w = 0; size(); };
    if (low) load(low).then((i) => { if (!st.current.img) take(i); }).catch(() => {});
    load(src).then((i) => { take(i); onReady?.(); }).catch(() => {});
    const ro = new ResizeObserver(() => size());
    if (box.current) ro.observe(box.current);
    return () => { live = false; ro.disconnect(); cancelAnimationFrame(st.current.raf); st.current.raf = 0; };
  }, [src, low]); // eslint-disable-line react-hooks/exhaustive-deps

  // The first second moves: an unseen hand brushes across the middle, and the colour shows through.
  useEffect(() => {
    if (!demo || calm) return;
    let start = 0, prev = 0, raf = 0;
    const go = (now: number) => {
      const s = st.current;
      if (!s.w) { raf = requestAnimationFrame(go); return; }
      if (!start) start = now;
      const t = Math.min(1, (now - start) / 900);
      const e = 1 - Math.pow(1 - t, 2);
      const tc = s.temp.getContext('2d')!;
      const r = Math.min(s.w, s.h) * 0.075;
      const n = 24;
      for (let i = Math.round(prev * n); i <= Math.round(e * n); i++) { const [x, y] = bez(DEMO, i / n); dab(tc, x * s.w, y * s.h, r, 0.9); }
      prev = e;
      s.lastRub = now; wake();
      if (t < 1) raf = requestAnimationFrame(go);
    };
    const t0 = setTimeout(() => { raf = requestAnimationFrame(go); }, 350);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [demo, calm]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    stroke: (i, ms = 520) => new Promise<void>((done) => {
      const s = st.current;
      if (!s.w) { s.done.push(i); done(); return; }
      const pc = s.perm.getContext('2d')!;
      const path = STROKES[i % STROKES.length];
      s.done.push(i);
      if (calm || ms <= 0) { brushAlong(pc, path, 0, 1, i + 1); render(); done(); return; }
      let start = 0, prev = 0;
      const go = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        brushAlong(pc, path, prev, e, i + 1);
        prev = e;
        render();
        if (t < 1) requestAnimationFrame(go); else done();
      };
      requestAnimationFrame(go);
    }),
  }));

  // Brushing: colour under the finger (or, on a computer, under the pointer), for a moment.
  const last = useRef<[number, number] | null>(null);
  const at = (e: React.PointerEvent): [number, number] => {
    const b = cv.current!.getBoundingClientRect(); const k = st.current.w / b.width;
    return [(e.clientX - b.left) * k, (e.clientY - b.top) * k];
  };
  const rub = (p: [number, number]) => {
    const s = st.current; const tc = s.temp.getContext('2d')!;
    const r = Math.min(s.w, s.h) * 0.07;
    const [x0, y0] = last.current ?? p;
    const d = Math.hypot(p[0] - x0, p[1] - y0); const n = Math.max(1, Math.ceil(d / (r * 0.3)));
    for (let i = 1; i <= n; i++) dab(tc, x0 + ((p[0] - x0) * i) / n, y0 + ((p[1] - y0) * i) / n, r, 0.85);
    last.current = p;
    s.lastRub = performance.now(); wake();
    if (!s.rubbed) { s.rubbed = true; onRubRef.current?.(); }
  };

  return (
    <div ref={box} className="vn">
      <img className="vn-clean" src={src} alt="" style={{ objectPosition: focus }} draggable={false} />
      <canvas ref={cv} className="vn-varnish" aria-hidden
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); last.current = null; rub(at(e)); }}
        onPointerMove={(e) => rub(at(e))}
        onPointerUp={() => { last.current = null; }} onPointerCancel={() => { last.current = null; }} onPointerLeave={() => { last.current = null; }} />
    </div>
  );
});
