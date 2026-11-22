import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { artSet, artSrc, COLS, PATCHES, ROWS, type Painting, type Restoration } from '../lib/art';
import { cat } from '../lib/categories';
import { sketchMaskURL, strokeMaskURL, varnish, varnishNow } from '../lib/varnish';

/**
 * The month's painting, begun as its underdrawing: red chalk on bare linen. Every entry paints one broad
 * stroke of the real colour over it. A new stroke sweeps across with a wet edge in the pigment of what it
 * was for (lunch, transport, rent), and dries to the painting's own colour.
 */
/** Seconds the reveal takes, so callers know when to mark strokes as seen. */
export const revealTime = (fresh: number) => (fresh ? 0.6 + (fresh - 1) * Math.min(0.35, 6 / fresh) + 1.4 : 0);

/** Gets a plate ready before it is shown (decode + underdrawing), so changing month draws at once. */
export function warmPlate(painting: Painting, ratio = 4 / 5) {
  const W = 900, H = Math.round(W / ratio);
  const [fx, fy] = painting.focus.split(' ').map((v) => parseFloat(v));
  const ax = fx < 35 ? 0 : fx > 65 ? 1 : 0.5, ay = fy < 35 ? 0 : fy > 65 ? 1 : 0.5;
  const img = new Image(); img.src = artSrc(painting.id, 'md'); img.decode().catch(() => {});
  varnish(painting.id, W, H, ax, ay).catch(() => {});
}

export function RestorationPlate({ painting, r, seen, ratio = 4 / 5, drift = true, calm, lead = 0.6 }: { painting: Painting; r: Restoration; seen: number; ratio?: number; drift?: boolean; calm?: boolean; /** seconds before the first waiting stroke is painted */ lead?: number }) {
  const W = 900, H = Math.round(W / ratio);
  const [fx, fy] = painting.focus.split(' ').map((v) => parseFloat(v));
  const ax = fx < 35 ? 0 : fx > 65 ? 1 : 0.5, ay = fy < 35 ? 0 : fy > 65 ? 1 : 0.5;
  const [sketch, setSketch] = useState(() => varnishNow(painting.id, W, H, ax, ay));
  useEffect(() => {
    let live = true;
    setSketch(varnishNow(painting.id, W, H, ax, ay));
    varnish(painting.id, W, H, ax, ay).then((u) => live && setSketch(u), () => { /* the CSS stand-in stays */ });
    return () => { live = false; };
  }, [painting.id, W, H, ax, ay]);

  const from = Math.min(seen, r.restored);
  // Indexes (in painting order) of the strokes not yet seen: they are painted in front of you.
  const fresh = useMemo(() => Array.from({ length: r.restored - from }, (_, k) => from + k), [from, r.restored]);
  // The underdrawing shows wherever no stroke has been painted, fresh ones included (they paint over it).
  const bare = useMemo(() => sketchMaskURL(r.order.slice(0, r.restored)), [r.order, r.restored]);
  const step = Math.min(0.35, 6 / Math.max(1, fresh.length)); // a big catch-up still finishes in a few seconds
  // Strokes waiting when the plate appears go one after another; a stroke earned while you watch goes at once.
  const waiting = useRef<Set<number> | null>(null);
  if (!waiting.current) waiting.current = new Set(fresh);
  const wait = (n: number, k: number) => (waiting.current!.has(n) ? lead + k * step : 0.04);
  const pos = `${ax * 100}% ${ay * 100}%`;
  const src = artSrc(painting.id, 'md');
  const masked = (mask: string): CSSProperties => ({ objectPosition: pos, WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})` });
  const sketchImg = (style: CSSProperties, className = '') => sketch
    ? <img src={sketch} alt="" className={'plate-img ' + className} style={style} draggable={false} />
    : <img src={src} alt="" className={'plate-img plate-standin ' + className} style={style} draggable={false} />;

  return (
    <div className="plate" style={{ aspectRatio: `${ratio}` }} role="img" aria-label={`${painting.title}, ${r.restored} of ${PATCHES} strokes painted`}>
      <div className={drift && !calm ? 'plate-canvas drift-soft' : 'plate-canvas'}>
        <img src={src} srcSet={artSet(painting.id)} sizes="(max-width: 860px) 100vw, 40vw" alt="" className="plate-img" style={{ objectPosition: pos }} decoding="async" draggable={false} />
        {r.restored < PATCHES && sketchImg(masked(bare))}
        {fresh.map((n, k) => {
          const cell = r.order[n];
          const shape = strokeMaskURL(cell, r.order.slice(0, n));
          const delay = `${calm ? 0 : wait(n, k)}s`;
          const pigment = r.earned[n] ? cat(r.earned[n]!).color : '#D8B565';
          return (
            <div key={'p' + n} className={'plate-layer' + (calm ? ' calm' : '')}>
              {/* The underdrawing under this stroke, wiped away as the brush crosses. */}
              {sketchImg({ objectPosition: pos, '--shape': `url(${shape})`, animationDelay: delay } as CSSProperties, 'plate-wipe')}
              {/* The wet edge of the brush, in the pigment of what the line was for. */}
              <span className="plate-wet" style={{ '--shape': `url(${shape})`, animationDelay: delay, '--pigment': pigment } as CSSProperties} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlateLabel({ painting, r, reason }: { painting: Painting; r: Restoration; reason?: string }) {
  return (
    <div className="plate-label">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
        <span style={{ font: 'italic 400 17px/1.25 var(--serif)' }}>{painting.title}</span>
        <span className="num" style={{ font: '500 12px var(--grot)', color: r.complete ? 'var(--gold)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}>{r.complete ? 'Finished' : `${r.restored} / ${COLS * ROWS}`}</span>
      </div>
      <div style={{ font: '400 13px/1.4 var(--grot)', color: 'var(--ink-3)', marginTop: 3 }}>{painting.artist}, {painting.year}{reason ? `. ${reason}` : ''}</div>
      <div className="plate-meter" aria-hidden>
        {Array.from({ length: COLS * ROWS }, (_, i) => <span key={i} className={i < r.restored ? 'on' : ''} />)}
      </div>
    </div>
  );
}
