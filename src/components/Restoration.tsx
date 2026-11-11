import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { artSet, artSrc, COLS, PATCHES, ROWS, type Painting, type Restoration } from '../lib/art';
import { cellMask, varnish, varnishNow } from '../lib/varnish';

/**
 * A painting under old varnish. Restored patches show the true colours;
 * the rest stays brown and grimy until more entries are written.
 */
/** Seconds the reveal takes, so callers know when to mark patches as seen. */
export const revealTime = (fresh: number) => (fresh ? 0.6 + (fresh - 1) * Math.min(0.35, 6 / fresh) + 1.4 : 0);

/** Gets a plate ready before it is shown (decode + varnish), so changing month draws at once. */
export function warmPlate(painting: Painting, ratio = 4 / 5) {
  const W = 900, H = Math.round(W / ratio);
  const [fx, fy] = painting.focus.split(' ').map((v) => parseFloat(v));
  const ax = fx < 35 ? 0 : fx > 65 ? 1 : 0.5, ay = fy < 35 ? 0 : fy > 65 ? 1 : 0.5;
  const img = new Image(); img.src = artSrc(painting.id, 'md'); img.decode().catch(() => {});
  varnish(painting.id, W, H, ax, ay).catch(() => {});
}

export function RestorationPlate({ painting, r, seen, ratio = 4 / 5, drift = true, calm, lead = 0.6 }: { painting: Painting; r: Restoration; seen: number; ratio?: number; drift?: boolean; calm?: boolean; /** seconds before the first waiting patch lifts */ lead?: number }) {
  const W = 900, H = Math.round(W / ratio);
  const [fx, fy] = painting.focus.split(' ').map((v) => parseFloat(v));
  const ax = fx < 35 ? 0 : fx > 65 ? 1 : 0.5, ay = fy < 35 ? 0 : fy > 65 ? 1 : 0.5;
  const [grime, setGrime] = useState(() => varnishNow(painting.id, W, H, ax, ay));
  useEffect(() => {
    let live = true;
    setGrime(varnishNow(painting.id, W, H, ax, ay));
    varnish(painting.id, W, H, ax, ay).then((u) => live && setGrime(u), () => { /* the CSS stand-in stays */ });
    return () => { live = false; };
  }, [painting.id, W, H, ax, ay]);

  const fresh = useMemo(() => r.order.slice(Math.min(seen, r.restored), r.restored), [r.order, r.restored, seen]);
  // The base layer already has the fresh patches cleaned; each fresh patch gets its own varnish layer that fades away.
  const dirty = useMemo(() => cellMask(r.order.slice(r.restored)), [r.order, r.restored]);
  const step = Math.min(0.35, 6 / Math.max(1, fresh.length)); // a big catch-up still finishes in a few seconds
  // Patches waiting when the plate appears lift one after another; a patch earned while you watch lifts at once.
  const waiting = useRef<Set<number> | null>(null);
  if (!waiting.current) waiting.current = new Set(fresh);
  const wait = (i: number, k: number) => (waiting.current!.has(i) ? lead + k * step : 0.04);
  const pos = `${ax * 100}% ${ay * 100}%`;
  const src = artSrc(painting.id, 'md');
  const layer = (mask: string): CSSProperties => ({ objectPosition: pos, WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})` });
  const varnishImg = (mask: string) => grime
    ? <img src={grime} alt="" className="plate-img" style={layer(mask)} draggable={false} />
    : <img src={src} alt="" className="plate-img plate-standin" style={layer(mask)} draggable={false} />;

  return (
    <div className="plate" style={{ aspectRatio: `${ratio}` }} role="img" aria-label={`${painting.title}, ${r.restored} of ${PATCHES} patches restored`}>
      <div className={drift && !calm ? 'plate-canvas drift-soft' : 'plate-canvas'}>
        <img src={src} srcSet={artSet(painting.id)} sizes="(max-width: 860px) 100vw, 40vw" alt="" className="plate-img" style={{ objectPosition: pos }} decoding="async" draggable={false} />
        {r.restored < PATCHES && varnishImg(dirty)}
        {fresh.map((i, k) => (
          <motion.div key={'v' + i} className="plate-layer" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: wait(i, k), duration: 1.1, ease: 'easeInOut' }}>
            {varnishImg(cellMask([i]))}
          </motion.div>
        ))}
        {fresh.map((i, k) => (
          <motion.div key={'s' + i} className="plate-shine" style={{ left: `${(i % COLS) * (100 / COLS)}%`, top: `${Math.floor(i / COLS) * (100 / ROWS)}%`, width: `${100 / COLS}%`, height: `${100 / ROWS}%` }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: wait(i, k), duration: 1.4 }} />
        ))}
      </div>
    </div>
  );
}

export function PlateLabel({ painting, r, reason }: { painting: Painting; r: Restoration; reason?: string }) {
  return (
    <div className="plate-label">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
        <span style={{ font: 'italic 400 17px/1.25 var(--serif)' }}>{painting.title}</span>
        <span className="num" style={{ font: '500 12px var(--grot)', color: r.complete ? 'var(--gold)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}>{r.complete ? 'Restored' : `${r.restored} / ${COLS * ROWS}`}</span>
      </div>
      <div style={{ font: '400 13px/1.4 var(--grot)', color: 'var(--ink-3)', marginTop: 3 }}>{painting.artist}, {painting.year}{reason ? `. ${reason}` : ''}</div>
      <div className="plate-meter" aria-hidden>
        {Array.from({ length: COLS * ROWS }, (_, i) => <span key={i} className={i < r.restored ? 'on' : ''} />)}
      </div>
    </div>
  );
}
