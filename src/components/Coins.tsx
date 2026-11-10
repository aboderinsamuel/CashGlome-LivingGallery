import { useMemo, useState } from 'react';
import { useInView } from '../lib/inview';
import { cat } from '../lib/categories';
import { coinMonth, everydayUnit, unitsOf } from '../lib/coins';
import { money } from '../lib/format';
import type { Stats } from '../lib/analytics';
import type { Entry } from '../lib/types';

const GOLD = '#C9A253';
const colorOf = (id: string) => (cat(id).nature === 'save' ? GOLD : cat(id).color);

/** The month as 100 coins on a velvet tray: you see at a glance where each coin went. */
export function Coins({ s, entries, cur, calm, onOpen }: { s: Stats; entries: Entry[]; cur: string; calm: boolean; onOpen: (id: string) => void }) {
  const m = useMemo(() => coinMonth(s), [s]);
  const unit = useMemo(() => everydayUnit(entries, cur, s.spend), [entries, cur, s.spend]);
  const [focus, setFocus] = useState<string | null>(null);
  const [tray, shown] = useInView<HTMLDivElement>();
  if (!m) return null;

  const coins: { id: string; over?: boolean }[] = [];
  m.groups.forEach((g) => { for (let i = 0; i < g.coins; i++) coins.push({ id: g.id }); });
  for (let i = 0; i < m.left; i++) coins.push({ id: 'left' });
  if (m.over) for (let i = coins.length - m.over; i < coins.length; i++) if (coins[i]) coins[i].over = true;
  const top = m.groups.find((g) => cat(g.id).nature !== 'save') ?? m.groups[0];

  return (
    <section className="section coins-sec">
      {/* Plain buttons with a CSS drop-in: 100 JS springs here used to make the whole page stutter. */}
      <div ref={tray} className={'tray' + (shown ? ' in' : '') + (calm ? ' still' : '')}>
        <div className="coin-grid" onMouseLeave={() => setFocus(null)}>
          {coins.map((c, i) => (
            <button
              key={i} className={'coin' + (c.id === 'left' ? ' left' : '') + (c.over ? ' over' : '') + (focus && focus !== c.id ? ' dim' : '')}
              style={{ ['--c' as string]: c.id === 'left' ? 'transparent' : colorOf(c.id), ['--i' as string]: i }}
              onMouseEnter={() => setFocus(c.id)} onClick={() => c.id !== 'left' && onOpen(c.id)}
              aria-label={c.id === 'left' ? 'Still yours' : cat(c.id).name}
            />
          ))}
        </div>
      </div>
      <div className="coins-copy">
        <div className="kicker">{m.base === 'in' ? 'Every 100 coins that came in' : 'Every 100 coins you spent'}</div>
        <h2 className="h2 coins-h">
          <span className="num">{top.coins}</span> went on <em>{cat(top.id).name.toLowerCase()}</em>
          {m.left > 0 ? <>, <span className="num">{m.left}</span> are still yours.</> : '.'}
        </h2>
        {m.over > 0 && <p className="coins-over"><span className="num">{m.over}</span> of them came from before this month.</p>}
        <div className="coin-legend" onMouseLeave={() => setFocus(null)}>
          {m.groups.slice(0, 6).map((g) => (
            <button key={g.id} className={'leg' + (focus === g.id ? ' on' : '')} onMouseEnter={() => setFocus(g.id)} onFocus={() => setFocus(g.id)} onClick={() => onOpen(g.id)}>
              <span className="coin mini" style={{ ['--c' as string]: colorOf(g.id) }} />
              <span className="leg-name">{cat(g.id).name}</span>
              <span className="leg-unit">{cat(g.id).nature === 'save' ? 'kept for later' : `${unit.measured ? '' : '≈ '}${unitsOf(g.total, unit)} ${unit.measured ? `× ${unit.name}` : unit.name}`}</span>
              <span className="leg-n num">{g.coins}</span>
            </button>
          ))}
          {m.left > 0 && (
            <div className="leg" onMouseEnter={() => setFocus('left')}>
              <span className="coin mini left" />
              <span className="leg-name">Still yours</span>
              <span className="leg-unit">{money(Math.max(0, s.inflow - s.byCat.reduce((a, c) => a + c.total, 0)), cur, { compact: true })}</span>
              <span className="leg-n num">{m.left}</span>
            </div>
          )}
        </div>
        <p className="small" style={{ marginTop: 14 }}>
          {unit.measured ? <>Counted in your usual {unit.name}, about {money(unit.price, cur)} each.</> : <>≈ {unit.name} at about {money(unit.price, cur)}, a guess until you have a usual.</>}
        </p>
      </div>
    </section>
  );
}
