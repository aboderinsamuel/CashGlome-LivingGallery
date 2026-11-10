import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { artSrc, PAINTINGS } from '../lib/art';

interface Props {
  id: string;
  focus?: string;
  drift?: boolean; // slow camera move across the painting
  dust?: boolean; // motes of gold drifting through a shaft of light
  grain?: boolean;
  light?: boolean;
  parallax?: boolean;
  shade?: string; // overlay gradient for legibility
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  calm?: boolean;
}

/** A painting that breathes: drift, light, dust and grain, like a slow film of the canvas. */
export function LivingArt({ id, focus, drift = true, dust = false, grain = true, light = false, parallax = false, shade, className, style, children, calm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const p = PAINTINGS[id];
  useEffect(() => {
    if (!parallax || calm) return;
    const el = ref.current; if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--px', `${((e.clientX - r.left) / r.width - 0.5) * -14}px`);
      el.style.setProperty('--py', `${((e.clientY - r.top) / r.height - 0.5) * -10}px`);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [parallax, calm]);
  return (
    <div ref={ref} className={'living ' + (className ?? '')} style={style}>
      <div className="living-par">
        <img src={artSrc(id)} alt={p ? `${p.title}, ${p.artist}` : ''} draggable={false}
          className={drift && !calm ? 'living-img drift' : 'living-img'} style={{ objectPosition: focus ?? p?.focus ?? '50% 50%', animationDelay: `${-(id.length * 7) % 40}s` }} />
      </div>
      {light && !calm && <div className="living-light" />}
      {dust && !calm && <Dust />}
      {grain && <div className={'living-grain' + (calm ? '' : ' moving')} />}
      {shade && <div style={{ position: 'absolute', inset: 0, background: shade, pointerEvents: 'none' }} />}
      {children}
    </div>
  );
}

function Dust() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    let raf = 0, w = 0, h = 0, visible = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } }); io.observe(c);
    const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.6, v: 0.00008 + Math.random() * 0.00025, a: Math.random() * Math.PI * 2, s: 0.3 + Math.random() * 0.7 }));
    let last = performance.now();
    function tick(t: number) {
      const dt = Math.min(64, t - last); last = t;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v * dt; m.a += 0.0008 * dt; m.x += Math.sin(m.a) * 0.00006 * dt;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        // brighter inside the diagonal shaft of light
        const inShaft = Math.max(0, 1 - Math.abs((m.x - 0.25) - (1 - m.y) * 0.45) * 3.2);
        const alpha = (0.12 + inShaft * 0.75) * m.s * (0.6 + 0.4 * Math.sin(t / 900 + m.a));
        const g = ctx.createRadialGradient(m.x * w, m.y * h, 0, m.x * w, m.y * h, m.r * 3.2);
        g.addColorStop(0, `rgba(255,236,190,${alpha})`); g.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r * 3.2, 0, Math.PI * 2); ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);
  return <canvas ref={ref} className="living-dust" aria-hidden />;
}
