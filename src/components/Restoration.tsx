import { motion } from 'framer-motion';
import { useId } from 'react';
import { artSrc, COLS, ROWS, type Painting, type Restoration } from '../lib/art';

/**
 * A painting under old varnish. Restored patches show the true colours;
 * the rest stays brown and grimy until more entries are written.
 */
/** Seconds the reveal takes, so callers know when to mark patches as seen. */
export const revealTime = (fresh: number) => (fresh ? 0.6 + (fresh - 1) * Math.min(0.35, 6 / fresh) + 1.4 : 0);

export function RestorationPlate({ painting, r, seen, ratio = 4 / 5, drift = true, calm }: { painting: Painting; r: Restoration; seen: number; ratio?: number; drift?: boolean; calm?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const W = 1000, H = Math.round(W / ratio);
  const cw = W / COLS, chh = H / ROWS;
  const [fx, fy] = painting.focus.split(' ').map((v) => parseFloat(v));
  const align = `x${fx < 35 ? 'Min' : fx > 65 ? 'Max' : 'Mid'}Y${fy < 35 ? 'Min' : fy > 65 ? 'Max' : 'Mid'}`;
  const restoredSet = new Set(r.order.slice(0, r.restored));
  const fresh = new Set(r.order.slice(Math.min(seen, r.restored), r.restored));
  const step = Math.min(0.35, 6 / Math.max(1, fresh.size)); // a big catch-up still finishes in a few seconds
  return (
    <div className="plate" style={{ aspectRatio: `${ratio}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={drift && !calm ? 'plate-svg drift-soft' : 'plate-svg'} aria-label={`${painting.title}, ${r.restored} of ${COLS * ROWS} patches restored`}>
        <defs>
          <filter id={`v${uid}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0.34 0.55 0.13 0 -0.02  0.27 0.45 0.10 0 -0.04  0.15 0.30 0.07 0 -0.06  0 0 0 1 0" />
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id={`g${uid}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="7" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.18  0 0 0 0 0.11  0 0 0 0 0.04  0 0 0 -2.2 1.35" />
          </filter>
          <filter id={`c${uid}`}>
            <feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="2" seed="3" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 -9 1.2" />
          </filter>
          <filter id={`f${uid}`}><feGaussianBlur stdDeviation="14" /></filter>
          <mask id={`m${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <rect width={W} height={H} fill="black" />
            <g filter={`url(#f${uid})`}>
              {Array.from({ length: COLS * ROWS }, (_, i) => {
                if (restoredSet.has(i) && !fresh.has(i)) return null;
                const x = (i % COLS) * cw - 10, y = Math.floor(i / COLS) * chh - 10;
                const k = fresh.has(i) ? [...fresh].indexOf(i) : 0;
                return fresh.has(i)
                  ? <motion.rect key={i} x={x} y={y} width={cw + 20} height={chh + 20} fill="white" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.6 + k * step, duration: 1.1, ease: 'easeInOut' }} />
                  : <rect key={i} x={x} y={y} width={cw + 20} height={chh + 20} fill="white" />;
              })}
            </g>
          </mask>
          <linearGradient id={`s${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff2c8" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff2c8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff2c8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <image href={artSrc(painting.id)} x="0" y="0" width={W} height={H} preserveAspectRatio={`${align} slice`} />
        <g mask={`url(#m${uid})`}>
          <image href={artSrc(painting.id)} x="0" y="0" width={W} height={H} preserveAspectRatio={`${align} slice`} filter={`url(#v${uid})`} />
          <rect width={W} height={H} filter={`url(#g${uid})`} opacity="0.75" />
          <rect width={W} height={H} filter={`url(#c${uid})`} opacity="0.5" />
          <rect width={W} height={H} fill="#3a2a12" opacity="0.18" />
        </g>
        {[...fresh].map((i, k) => (
          <motion.rect key={'s' + i} x={(i % COLS) * cw} y={Math.floor(i / COLS) * chh} width={cw} height={chh} fill={`url(#s${uid})`}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: 0.6 + k * step, duration: 1.4 }} />
        ))}
      </svg>
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
