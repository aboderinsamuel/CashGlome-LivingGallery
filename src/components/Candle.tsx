import { motion } from 'framer-motion';

/** A beeswax candle. Taller with every day written; the flame dims when today is still empty. */
export function Candle({ streak, lit, size = 64, calm }: { streak: number; lit: boolean; size?: number; calm?: boolean }) {
  const h = 0.35 + Math.min(1, streak / 30) * 0.5; // share of the holder the wax fills
  const waxTop = 92 - h * 60;
  const on = streak > 0;
  return (
    <svg width={size * 0.62} height={size} viewBox="0 0 62 100" aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="wax" x1="0" x2="1"><stop offset="0" stopColor="#E9DDBE" /><stop offset="0.55" stopColor="#FBF4E2" /><stop offset="1" stopColor="#D8C9A4" /></linearGradient>
        <radialGradient id="glow"><stop offset="0" stopColor="#FFD98A" stopOpacity="0.75" /><stop offset="1" stopColor="#FFB547" stopOpacity="0" /></radialGradient>
        <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#3B6BFF" /><stop offset="0.18" stopColor="#FFF4C9" /><stop offset="0.6" stopColor="#FFC44D" /><stop offset="1" stopColor="#FF7A2B" /></linearGradient>
      </defs>
      {on && <motion.circle cx="31" cy={waxTop - 14} r="26" fill="url(#glow)" animate={calm ? undefined : { opacity: lit ? [0.85, 1, 0.8, 0.95] : [0.25, 0.4, 0.2] }} transition={{ duration: 2.4, repeat: Infinity }} />}
      <rect x="20" y={waxTop} width="22" height={92 - waxTop} rx="3" fill="url(#wax)" stroke="#8A6A3A" strokeOpacity="0.35" />
      <path d={`M20 ${waxTop + 3} q4 6 2 12 q-1 4 1 7`} stroke="#E2D2AC" strokeWidth="3" fill="none" strokeLinecap="round" />
      <line x1="31" y1={waxTop} x2="31" y2={waxTop - 5} stroke="#2A2118" strokeWidth="1.6" />
      {on && (
        <motion.path d={`M31 ${waxTop - 24} C 37 ${waxTop - 15}, 36 ${waxTop - 6}, 31 ${waxTop - 4} C 26 ${waxTop - 6}, 25 ${waxTop - 15}, 31 ${waxTop - 24} Z`} fill="url(#flame)"
          style={{ transformOrigin: `31px ${waxTop - 4}px` }}
          animate={calm ? undefined : { scaleY: lit ? [1, 1.08, 0.94, 1.04, 1] : [0.55, 0.62, 0.5], skewX: [0, 3, -2, 1, 0], opacity: lit ? 1 : 0.7 }}
          transition={{ duration: lit ? 1.8 : 1.2, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <path d="M8 92 h46 q4 0 3 4 l-1 2 h-50 l-1 -2 q-1 -4 3 -4z" fill="#B08A3A" />
      <ellipse cx="31" cy="92" rx="23" ry="3" fill="#E2C27A" />
    </svg>
  );
}

/** A red wax seal: protects the candle through one missed day. */
export function Seal({ size = 22, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 2c3 0 4 2.5 6.5 3.2s5-0.6 6.7 1.6 0.4 4.7 1.6 6.9 3.6 3.1 3.2 6-3.1 3.6-3.6 6.3 1 5.2-1.1 7-4.8 0.5-7.3 1.6S23 40 20 40s-4-2.5-6.5-3.2-5 .6-6.8-1.6-.4-4.6-1.6-6.8S1.5 25.3 2 22.4s3.1-3.6 3.6-6.3-1-5.2 1.1-7 4.8-.5 7.3-1.6S17 2 20 2z"
        fill={filled ? '#A3272A' : 'none'} stroke={filled ? '#7A1B1F' : 'var(--ink-4)'} strokeWidth="1.5" strokeDasharray={filled ? undefined : '3 3'} />
      {filled && <><circle cx="20" cy="21" r="10.5" fill="none" stroke="#C9454A" strokeWidth="1.6" /><path d="M20 13.5c1.6 2.3 1.8 4.6.9 6.6l2.8-1.3c.9 1.6.5 3.3-1 4.3h-5.4c-1.5-1-1.9-2.7-1-4.3l2.8 1.3c-.9-2-.7-4.3.9-6.6zm-3.2 11.3h6.4v1.6h-6.4z" fill="#E8767A" /></>}
    </svg>
  );
}
