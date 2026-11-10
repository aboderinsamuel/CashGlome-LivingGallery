// Hand-drawn sticker set. Thick ink outlines, flat fills, white die-cut border, soft lift shadow.
import { motion } from 'framer-motion';
import type { ReactNode, RefObject } from 'react';

const O = '#17171C';
const S = { stroke: O, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const P = ({ d, f = 'none', w }: { d: string; f?: string; w?: number }) => <path d={d} fill={f} {...S} strokeWidth={w ?? 4} />;
const Shine = ({ d }: { d: string }) => <path d={d} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.75} />;
// Outlined stick: ink underlay + colour on top.
const Stick = ({ x1, y1, x2, y2, c, w = 6 }: { x1: number; y1: number; x2: number; y2: number; c: string; w?: number }) => (
  <g strokeLinecap="round"><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={O} strokeWidth={w + 6} /><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} /></g>
);

function starPath(cx: number, cy: number, R: number, r: number, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)} `;
  }
  return d + 'Z';
}

export const STICKERS: Record<string, ReactNode> = {
  bowl: (
    <>
      <path d="M60 46 C58 38 64 34 62 26 M48 46 C46 38 52 34 50 26 M72 46 C70 38 76 34 74 26" fill="none" stroke={O} strokeWidth={3.5} strokeLinecap="round" />
      <Stick x1={70} y1={54} x2={104} y2={14} c="#D9B98C" w={5} />
      <Stick x1={78} y1={56} x2={110} y2={24} c="#D9B98C" w={5} />
      <P d="M24 56 C30 46 36 46 42 56 C48 46 54 46 60 56 C66 46 72 46 78 56 C84 46 90 46 96 56 Z" f="#FFE29A" />
      <P d="M14 56 H106 C106 82 86 98 60 98 C34 98 14 82 14 56 Z" f="#FF7A3D" />
      <P d="M44 98 H76 L72 106 H48 Z" f="#FF7A3D" />
      <Shine d="M26 66 C30 76 38 84 48 88" />
    </>
  ),
  basket: (
    <>
      <path d="M34 52 C34 16 86 16 86 52" fill="none" stroke={O} strokeWidth={11} strokeLinecap="round" />
      <path d="M34 52 C34 16 86 16 86 52" fill="none" stroke="#D9B98C" strokeWidth={5} strokeLinecap="round" />
      <P d="M40 52 L66 14 C69 10 76 14 74 19 L54 54 Z" f="#F2C77E" />
      <P d="M56 28 L62 31 M62 20 L67 23" />
      <circle cx="80" cy="46" r="13" fill="#FF5E5E" {...S} /><P d="M80 33 C82 27 88 26 90 28" />
      <P d="M22 58 H98 L88 100 H32 Z" f="#FFC93C" />
      <P d="M44 62 L46 96 M60 62 V96 M76 62 L74 96" w={3} />
      <rect x="14" y="50" width="92" height="12" rx="6" fill="#D9B98C" {...S} />
    </>
  ),
  taxi: (
    <>
      <rect x="47" y="12" width="26" height="11" rx="3" fill="#fff" {...S} />
      <P d="M30 52 L40 26 H80 L90 52 Z" f="#FFC93C" />
      <P d="M39 49 L46 32 H74 L81 49 Z" f="#8EC5FF" />
      <rect x="22" y="84" width="18" height="16" rx="5" fill={O} />
      <rect x="80" y="84" width="18" height="16" rx="5" fill={O} />
      <rect x="12" y="48" width="96" height="40" rx="13" fill="#FFC93C" {...S} />
      <circle cx="31" cy="64" r="7" fill="#FFF6D6" {...S} strokeWidth={3} />
      <circle cx="89" cy="64" r="7" fill="#FFF6D6" {...S} strokeWidth={3} />
      <rect x="46" y="60" width="28" height="8" rx="3" fill={O} />
      {Array.from({ length: 8 }).map((_, i) => <rect key={i} x={16 + i * 11} y={76} width={5.5} height={5} fill={O} />)}
      <Shine d="M22 56 C24 53 28 52 32 52" />
    </>
  ),
  plane: (
    <g transform="rotate(-20 60 60)">
      <P d="M18 54 L10 30 H22 L36 54 Z" f="#5433EB" />
      <P d="M54 56 L42 30 H54 L74 56 Z" f="#8EC5FF" />
      <rect x="10" y="50" width="100" height="20" rx="10" fill="#fff" {...S} />
      <P d="M50 62 L34 94 H48 L74 64 Z" f="#8EC5FF" />
      {[60, 70, 80, 90].map((x) => <circle key={x} cx={x} cy={57} r={2.6} fill="#5433EB" />)}
      <P d="M100 52 C106 54 110 58 110 60" w={3} />
    </g>
  ),
  bulb: (
    <>
      <P d="M14 38 L24 42 M106 38 L96 42 M24 12 L32 20 M96 12 L88 20 M60 2 V10" />
      <P d="M60 16 C80 16 94 30 94 48 C94 62 86 68 80 76 C76 82 76 86 76 90 H44 C44 86 44 82 40 76 C34 68 26 62 26 48 C26 30 40 16 60 16 Z" f="#FFE066" />
      <P d="M50 62 L55 52 L60 62 L65 52 L70 62" w={3} />
      <rect x="44" y="90" width="32" height="9" rx="2" fill="#DCDCD0" {...S} />
      <rect x="46" y="99" width="28" height="8" rx="2" fill="#DCDCD0" {...S} />
      <P d="M52 107 H68 L64 114 H56 Z" f={O} />
      <Shine d="M38 40 C40 32 46 27 53 26" />
    </>
  ),
  house: (
    <>
      <rect x="76" y="24" width="12" height="24" fill="#C2512F" {...S} />
      <rect x="26" y="54" width="68" height="48" fill="#C9B8FF" {...S} />
      <P d="M14 60 L60 20 L106 60 Z" f="#C2512F" />
      <rect x="52" y="72" width="18" height="30" rx="2" fill="#FFC93C" {...S} />
      <circle cx="65" cy="88" r="2" fill={O} />
      <rect x="32" y="66" width="14" height="14" fill="#8EC5FF" {...S} strokeWidth={3} />
      <rect x="76" y="66" width="12" height="12" fill="#8EC5FF" {...S} strokeWidth={3} />
    </>
  ),
  tv: (
    <>
      <P d="M48 30 L36 12 M72 30 L84 12" />
      <circle cx="36" cy="11" r="4" fill="#FFC93C" {...S} strokeWidth={3} /><circle cx="84" cy="11" r="4" fill="#FFC93C" {...S} strokeWidth={3} />
      <P d="M34 94 L28 106 M86 94 L92 106" />
      <rect x="14" y="30" width="92" height="66" rx="14" fill="#FF5E8A" {...S} />
      <rect x="24" y="40" width="72" height="46" rx="7" fill={O} />
      <path d="M54 52 L72 63 L54 74 Z" fill="#fff" />
      <Shine d="M30 48 C31 45 33 44 36 44" />
    </>
  ),
  bag: (
    <>
      <path d="M44 48 C44 18 76 18 76 48" fill="none" stroke={O} strokeWidth={11} strokeLinecap="round" />
      <path d="M44 48 C44 18 76 18 76 48" fill="none" stroke="#FFC93C" strokeWidth={5} strokeLinecap="round" />
      <P d="M22 42 H98 L92 106 H28 Z" f="#C2512F" />
      <P d="M24 54 H96" w={3} />
      <circle cx="44" cy="50" r="3.5" fill="#fff" {...S} strokeWidth={2.5} /><circle cx="76" cy="50" r="3.5" fill="#fff" {...S} strokeWidth={2.5} />
      <Shine d="M32 64 L30 92" />
    </>
  ),
  phone: (
    <>
      <rect x="32" y="10" width="56" height="100" rx="14" fill="#2F3A4A" {...S} />
      <rect x="39" y="20" width="42" height="76" rx="6" fill="#8EC5FF" />
      <rect x="52" y="14" width="16" height="4" rx="2" fill={O} />
      <rect x="44" y="28" width="24" height="9" rx="4.5" fill="#fff" />
      <rect x="52" y="42" width="24" height="9" rx="4.5" fill="#FFC93C" />
      <rect x="44" y="56" width="20" height="9" rx="4.5" fill="#fff" />
      <rect x="52" y="70" width="24" height="9" rx="4.5" fill="#FF5E8A" />
      <rect x="50" y="101" width="20" height="3" rx="1.5" fill="#fff" />
    </>
  ),
  ticket: (
    <g transform="rotate(-12 60 60)">
      <P d="M12 38 H108 V52 A9 9 0 0 0 108 70 V84 H12 V70 A9 9 0 0 0 12 52 Z" f="#FF9EC7" />
      <path d="M84 42 V80" stroke={O} strokeWidth={3} strokeDasharray="4 5" strokeLinecap="round" />
      <P d={starPath(46, 61, 15, 7)} f="#FFC93C" w={3} />
      <rect x="90" y="54" width="10" height="14" rx="2" fill="#fff" {...S} strokeWidth={2.5} />
    </g>
  ),
  dice: (
    <>
      <g transform="rotate(-12 40 70)">
        <rect x="14" y="44" width="52" height="52" rx="11" fill="#fff" {...S} />
        {[[28, 58], [52, 58], [40, 70], [28, 82], [52, 82]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.5} fill={O} />)}
      </g>
      <g transform="rotate(16 82 46)">
        <rect x="60" y="24" width="44" height="44" rx="10" fill="#FF5E5E" {...S} />
        {[[72, 36], [92, 56], [82, 46]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.5} fill="#fff" />)}
      </g>
    </>
  ),
  pill: (
    <>
      <g transform="rotate(-35 60 62)">
        <P d="M40 46 H60 V78 H40 A16 16 0 0 1 40 46 Z" f="#fff" />
        <P d="M60 46 H80 A16 16 0 0 1 80 78 H60 Z" f="#9FE3C6" />
        <Shine d="M34 54 C36 51 39 50 42 50" />
      </g>
      <circle cx="88" cy="28" r="14" fill="#FF5E5E" {...S} />
      <path d="M88 20 V36 M80 28 H96" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  polish: (
    <>
      <rect x="46" y="8" width="28" height="38" rx="7" fill={O} {...S} />
      <rect x="50" y="44" width="20" height="10" fill="#F6B8A8" {...S} />
      <rect x="30" y="52" width="60" height="56" rx="16" fill="#F6B8A8" {...S} />
      <rect x="40" y="66" width="40" height="22" rx="4" fill="#fff" {...S} strokeWidth={3} />
      <Shine d="M38 60 C36 66 36 74 37 80" />
    </>
  ),
  books: (
    <>
      <rect x="18" y="80" width="86" height="20" rx="3" fill="#0E7C86" {...S} />
      <path d="M92 84 V96" stroke="#fff" strokeWidth={3} />
      <rect x="24" y="60" width="76" height="20" rx="3" fill="#FFC93C" {...S} />
      <path d="M34 64 V76" stroke={O} strokeWidth={3} />
      <g transform="rotate(-6 56 50)"><rect x="16" y="40" width="80" height="20" rx="3" fill="#C2512F" {...S} /><path d="M84 44 V56" stroke="#fff" strokeWidth={3} /></g>
      <P d="M70 30 L74 12 L80 30" f="#5433EB" w={3} />
    </>
  ),
  gift: (
    <>
      <P d="M60 40 C42 16 26 30 46 40 Z" f="#5433EB" />
      <P d="M60 40 C78 16 94 30 74 40 Z" f="#5433EB" />
      <rect x="22" y="56" width="76" height="50" fill="#FFB547" {...S} />
      <rect x="14" y="40" width="92" height="18" rx="3" fill="#FFB547" {...S} />
      <rect x="54" y="40" width="12" height="66" fill="#5433EB" {...S} strokeWidth={3} />
    </>
  ),
  piggy: (
    <>
      <circle cx="58" cy="20" r="12" fill="#FFC93C" {...S} /><path d="M58 14 V26" stroke={O} strokeWidth={3} strokeLinecap="round" />
      <rect x="34" y="86" width="12" height="18" rx="4" fill="#FF9EC7" {...S} />
      <rect x="68" y="86" width="12" height="18" rx="4" fill="#FF9EC7" {...S} />
      <P d="M16 62 C8 58 8 50 14 50" w={3.5} />
      <ellipse cx="58" cy="66" rx="42" ry="30" fill="#FF9EC7" {...S} />
      <P d="M36 42 L40 26 L54 38 Z" f="#FF9EC7" />
      <ellipse cx="98" cy="66" rx="10" ry="12" fill="#FFC2DC" {...S} />
      <circle cx="95" cy="64" r="2" fill={O} /><circle cx="101" cy="68" r="2" fill={O} />
      <circle cx="78" cy="54" r="3.5" fill={O} />
      <rect x="46" y="40" width="22" height="5" rx="2.5" fill={O} />
      <Shine d="M30 56 C33 50 38 46 44 44" />
    </>
  ),
  card: (
    <g transform="rotate(-8 60 62)">
      <rect x="12" y="32" width="96" height="62" rx="11" fill="#8B8F98" {...S} />
      <rect x="12" y="44" width="96" height="12" fill={O} />
      <rect x="24" y="64" width="20" height="15" rx="3" fill="#FFC93C" {...S} strokeWidth={3} />
      {[56, 66, 76, 86].map((x) => <circle key={x} cx={x} cy={72} r={2.6} fill="#fff" />)}
    </g>
  ),
  box: (
    <>
      <P d="M20 44 L60 28 L100 44 L60 60 Z" f="#E8D5B0" />
      <P d="M20 44 L60 60 V104 L20 88 Z" f="#D9B98C" />
      <P d="M60 60 L100 44 V88 L60 104 Z" f="#C9A574" />
      <P d="M40 36 L80 52 V64" w={3.5} />
      <P d="M28 74 L40 79" w={3} />
    </>
  ),
  star: (
    <>
      <P d={starPath(60, 62, 48, 21)} f="#FFC93C" />
      <Shine d="M44 46 C46 42 49 40 52 39" />
    </>
  ),
  briefcase: (
    <>
      <P d="M44 40 V30 C44 26 47 24 50 24 H70 C73 24 76 26 76 30 V40" w={5} />
      <rect x="12" y="40" width="96" height="62" rx="11" fill="#5433EB" {...S} />
      <P d="M12 64 H108" w={3.5} />
      <rect x="51" y="57" width="18" height="14" rx="3" fill="#FFC93C" {...S} strokeWidth={3} />
      <Shine d="M22 50 C24 47 27 46 31 46" />
    </>
  ),
  shop: (
    <>
      <rect x="20" y="50" width="80" height="54" fill="#fff" {...S} />
      <rect x="54" y="72" width="20" height="32" fill="#146B45" {...S} strokeWidth={3} />
      <rect x="28" y="64" width="20" height="18" fill="#8EC5FF" {...S} strokeWidth={3} />
      <P d="M14 32 H106 V50 C106 58 94 58 94 50 C94 58 82 58 82 50 C82 58 70 58 70 50 C70 58 58 58 58 50 C58 58 46 58 46 50 C46 58 34 58 34 50 C34 58 22 58 22 50 C22 58 14 56 14 50 Z" f="#FF5E5E" />
      <path d="M38 32 V50 M60 32 V50 M84 32 V50" stroke="#fff" strokeWidth={8} />
      <P d="M14 32 H106" />
    </>
  ),
  palette: (
    <>
      <P d="M60 14 C88 14 108 32 108 54 C108 70 96 74 86 70 C78 67 72 72 74 80 C76 92 70 104 56 104 C32 104 12 84 12 60 C12 34 32 14 60 14 Z" f="#F2E3B3" />
      <circle cx="38" cy="44" r="8" fill="#FF5E5E" {...S} strokeWidth={3} />
      <circle cx="60" cy="32" r="8" fill="#FFC93C" {...S} strokeWidth={3} />
      <circle cx="84" cy="40" r="8" fill="#5433EB" {...S} strokeWidth={3} />
      <circle cx="34" cy="70" r="8" fill="#146B45" {...S} strokeWidth={3} />
      <circle cx="58" cy="84" r="7" fill="#fff" {...S} strokeWidth={3} />
    </>
  ),
  heart: (
    <>
      <P d="M60 102 C30 82 12 64 12 44 C12 28 24 18 38 18 C48 18 56 24 60 32 C64 24 72 18 82 18 C96 18 108 28 108 44 C108 64 90 82 60 102 Z" f="#FF5E8A" />
      <Shine d="M26 40 C27 34 31 30 37 29" />
    </>
  ),
  sprout: (
    <>
      <P d="M60 70 C60 54 60 44 60 36" w={5} />
      <P d="M60 50 C44 50 30 40 28 24 C46 22 58 32 60 50 Z" f="#B9D36C" />
      <P d="M60 42 C62 24 76 14 94 16 C94 34 80 44 60 42 Z" f="#146B45" />
      <P d="M26 70 H94 L86 106 H34 Z" f="#C2512F" />
      <rect x="20" y="64" width="80" height="12" rx="4" fill="#C2512F" {...S} />
    </>
  ),
  coin: (
    <>
      <ellipse cx="66" cy="66" rx="40" ry="40" fill="#E0A82E" {...S} />
      <circle cx="58" cy="58" r="40" fill="#FFC93C" {...S} />
      <circle cx="58" cy="58" r="28" fill="none" stroke={O} strokeWidth={3} strokeDasharray="1 6" strokeLinecap="round" />
      <P d="M68 46 C64 42 58 41 53 43 C46 46 44 54 46 61 C48 69 57 73 66 69" w={5} />
      <Shine d="M30 46 C32 38 38 32 46 29" />
    </>
  ),
  clover: (
    <>
      <P d="M60 64 C64 84 70 96 80 106" w={5} />
      {[0, 90, 180, 270].map((r) => (
        <path key={r} transform={`rotate(${r} 60 58)`} d="M60 58 C48 46 40 30 52 22 C58 18 60 24 60 28 C60 24 62 18 68 22 C80 30 72 46 60 58 Z" fill="#146B45" {...S} />
      ))}
      <circle cx="60" cy="58" r="4" fill="#B9D36C" {...S} strokeWidth={3} />
    </>
  ),
};

/** Shared SVG filter: die-cut white border + lift shadow. Render once at app root. */
export function StickerDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="die" x="-25%" y="-25%" width="150%" height="150%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="grow" />
          <feFlood floodColor="#ffffff" />
          <feComposite in2="grow" operator="in" result="white" />
          <feGaussianBlur in="grow" stdDeviation="3.5" result="blur" />
          <feOffset in="blur" dy="5" result="off" />
          <feFlood floodColor="#292919" floodOpacity="0.22" />
          <feComposite in2="off" operator="in" result="shadow" />
          <feMerge><feMergeNode in="shadow" /><feMergeNode in="white" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

interface Props {
  name: string;
  size?: number;
  rotate?: number;
  peel?: boolean;
  bounds?: RefObject<HTMLElement>;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}

export function Sticker({ name, size = 96, rotate = 0, peel = false, className, style, delay = 0 }: Props) {
  const art = STICKERS[name] ?? STICKERS.star;
  return (
    <motion.div
      className={'sticker ' + (className ?? '')}
      style={{ width: size, height: size, rotate, cursor: peel ? 'grab' : undefined, ...style }}
      initial={{ scale: 0.6, opacity: 0, rotate: rotate - 14 }}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay }}
      drag={peel}
      dragSnapToOrigin
      dragElastic={0.5}
      dragTransition={{ bounceStiffness: 260, bounceDamping: 14 }}
      whileHover={peel ? { scale: 1.06, rotate: rotate + 4 } : undefined}
      whileDrag={{ scale: 1.14, rotate: rotate + 9, cursor: 'grabbing', filter: 'drop-shadow(0 18px 18px rgba(41,41,25,.25))' }}
    >
      <svg viewBox="-6 -6 132 132" width="100%" height="100%" style={{ filter: 'url(#die)', overflow: 'visible' }}>{art}</svg>
    </motion.div>
  );
}
