// Red chalk marks: the circle, underline and arrow a curator draws in the margin, drawn in as you watch.
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';

const PATHS = {
  // An ellipse drawn by hand: it starts low left, overshoots, and doesn't quite close.
  circle: 'M14 58 C 4 30, 60 6, 150 8 C 236 10, 296 26, 292 52 C 288 80, 200 96, 120 92 C 50 88, 8 74, 12 50 C 16 30, 70 14, 128 12',
  underline: 'M4 10 C 60 4, 140 3, 200 7 C 240 9, 270 6, 296 4',
  arrow: 'M6 40 C 40 34, 70 22, 92 6 M74 6 L 93 5 L 90 24',
  tick: 'M6 22 L 18 34 L 44 6',
};
const BOX = { circle: '0 0 300 100', underline: '0 0 300 14', arrow: '0 0 100 46', tick: '0 0 50 40' };

interface Props { kind: keyof typeof PATHS; delay?: number; width?: number; style?: CSSProperties; className?: string; calm?: boolean }

export function Chalk({ kind, delay = 0.2, width = 2.4, style, className, calm }: Props) {
  return (
    <svg className={'chalk ' + (className ?? '')} viewBox={BOX[kind]} preserveAspectRatio="none" style={style} aria-hidden>
      <motion.path d={PATHS[kind]} strokeWidth={width} vectorEffect="non-scaling-stroke"
        initial={calm ? false : { pathLength: 0, opacity: 0.2 }} animate={{ pathLength: 1, opacity: 0.85 }}
        transition={{ duration: kind === 'circle' ? 0.9 : 0.55, delay, ease: [0.5, 0, 0.3, 1] }} />
    </svg>
  );
}
