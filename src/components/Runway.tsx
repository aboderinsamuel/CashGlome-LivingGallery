import type { Affordability } from '../lib/memory';
import { DAY_LETTERS, weekdayOf } from '../lib/memory';
import { money } from '../lib/format';

/** The purse until payday: each day a stack of gold coins, the size of what's left after it.
 *  Routine days take coins off in vermilion; the thing you're thinking of buying is the lapis coin on day one;
 *  days you'd be short hang below the line in outline, like debts in a ledger. Payday wears a small sun. */
export function Runway({ a, cur, compact = false }: { a: Affordability; cur: string; compact?: boolean }) {
  const days = a.days;
  const n = days.length;
  const colW = n > 20 ? 30 : n > 12 ? 38 : 50;
  const W = Math.max(compact ? 300 : 520, n * colW + 24);
  const base = compact ? 108 : 132; // the ledger line
  const H = base + (a.lowest < 0 ? 66 : 34);
  // Scaled to the money you have now, so payday's tall stack doesn't flatten the days before it (it's capped instead).
  const maxPos = Math.max(1, a.balance, ...days.filter((d) => !d.payday).map((d) => d.after));
  const maxNeg = Math.max(1, ...days.map((d) => -d.after));
  const STACK = compact ? 11 : 14, NEG = 7, rx = Math.min(13, colW * 0.36), ry = rx * 0.32, step = ry * 1.25;
  const short = (v: number) => money(Math.abs(v), cur, { compact: true });

  return (
    <figure className={'runway' + (compact ? ' compact' : '')} aria-label={`Money left each day until ${a.payday ? 'payday' : 'next week'}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <defs>
          <linearGradient id="rw-gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F2D98A" /><stop offset="1" stopColor="#B88A2E" /></linearGradient>
          <linearGradient id="rw-lapis" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5C7BD9" /><stop offset="1" stopColor="#24357F" /></linearGradient>
          <radialGradient id="rw-sun"><stop offset="0" stopColor="#F7DE8C" /><stop offset="1" stopColor="#F7DE8C" stopOpacity="0" /></radialGradient>
        </defs>
        <line x1="8" x2={W - 8} y1={base + 6} y2={base + 6} className="rw-rule" />
        {days.map((d, i) => {
          const cx = 12 + colW * (i + 0.5);
          const coins = d.after > 0 ? Math.min(STACK + 3, Math.max(1, Math.round((STACK * d.after) / maxPos))) : 0;
          const debts = d.after < 0 ? Math.max(1, Math.round((NEG * -d.after) / maxNeg)) : 0;
          const outs = d.items.filter((x) => x.dir === 'out' && !x.buy).reduce((s, x) => s + x.amount, 0);
          const buy = d.items.find((x) => x.buy);
          const top = base - coins * step;
          return (
            <g key={d.date} className="rw-day" style={{ ['--i' as string]: i }}>
              {d.payday && <circle cx={cx} cy={top - 24} r={20} fill="url(#rw-sun)" />}
              {Array.from({ length: coins }, (_, k) => (
                <ellipse key={k} className="rw-coin" cx={cx} cy={base - k * step} rx={rx} ry={ry} fill="url(#rw-gold)" stroke="#8A6420" strokeWidth={0.7} style={{ ['--k' as string]: k }} />
              ))}
              {Array.from({ length: debts }, (_, k) => (
                <ellipse key={'d' + k} cx={cx} cy={base + 16 + k * step * 1.1} rx={rx} ry={ry} fill="none" stroke="var(--vermilion)" strokeWidth={1} strokeDasharray="2 2" />
              ))}
              {buy && <ellipse cx={cx + rx * 0.9} cy={top - ry * 3.2} rx={rx} ry={ry} fill="url(#rw-lapis)" stroke="#1A2560" strokeWidth={0.7} transform={`rotate(-18 ${cx + rx * 0.9} ${top - ry * 3.2})`} />}
              {outs > 0 && !compact && <text x={cx} y={(buy ? top - ry * 7 : top - 9)} className="rw-out" textAnchor="middle">−{short(outs)}</text>}
              {d.payday && <text x={cx} y={top - 44} className="rw-pay" textAnchor="middle">Pay</text>}
              <text x={cx} y={H - 6} className={'rw-day-l' + (i === 0 ? ' today' : '')} textAnchor="middle">{i === 0 ? (colW >= 38 ? 'Today' : 'Now') : n > 14 ? DAY_LETTERS[weekdayOf(d.date)] : DAY_LETTERS[weekdayOf(d.date)] + ' ' + +d.date.slice(8)}</text>
            </g>
          );
        })}
      </svg>
      {!compact && (
        <figcaption className="rw-legend">
          <span><i className="rw-k gold" /> what's left after each day</span>
          <span><i className="rw-k red" /> your routines</span>
          {a.amount > 0 && <span><i className="rw-k lapis" /> {money(a.amount, cur)} you're thinking of</span>}
          {a.lowest < 0 && <span><i className="rw-k debt" /> short</span>}
        </figcaption>
      )}
    </figure>
  );
}
