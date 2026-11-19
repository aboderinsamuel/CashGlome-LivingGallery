// Play: the games made from the paintings you restore. Find it (the details a curator would point out,
// unlocked as you write) and Put it back together (a tile puzzle). No clock, no score to lose.
import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { artSrc, paintingOf, PAINTINGS, PATCHES, restorationOf, type Painting } from '../lib/art';
import { computeStats } from '../lib/analytics';
import { aim, AT, discoveriesOf, type Discovery } from '../lib/discoveries';
import { monthLabel, monthOf, todayISO } from '../lib/format';
import { HOUSES, houseName } from '../lib/houses';
import type { State } from '../lib/types';
import { Hunt, huntedOf, Lens, saveHunted } from '../components/Discoveries';
import { Puzzle } from '../components/Puzzle';
import { Icon } from '../components/Icons';

/** One painting's three details, and where each stands. */
interface Board { key: string; painting: Painting; where: string; restored: number; always?: boolean }
type Spot = { b: Board; d: Discovery; i: number; state: 'found' | 'ready' | 'locked' };

/** Every painting with details to find: your house's first, then each month's, newest first. */
export function boardsOf(state: State): Board[] {
  const set = new Set(state.entries.map((e) => monthOf(e.date)));
  set.add(monthOf(todayISO()));
  const months = [...set].sort().reverse().map((m) => ({ key: m, painting: paintingOf(computeStats(state.entries, m)), where: monthLabel(m), restored: restorationOf(state.entries, m, state.quiet).restored }));
  // Your house's painting keeps no secrets from you: its three details are always open.
  const h = state.house ? HOUSES[state.house.id] : null;
  const house = h && PAINTINGS[h.painting] ? [{ key: 'house-' + h.id, painting: PAINTINGS[h.painting], where: houseName(h), restored: PATCHES, always: true }] : [];
  return [...house, ...months].filter((b) => discoveriesOf(b.painting.id).length);
}

/** How many details are open and not yet found: the count beside Play. */
export const readyToFind = (state: State) => boardsOf(state).reduce((n, b) => {
  const got = huntedOf(b.key);
  return n + discoveriesOf(b.painting.id).filter((_, i) => !got.includes(i) && (b.always || b.restored >= AT[i])).length;
}, 0);

export function Play({ state }: { state: State }) {
  const calm = state.settings.calm;
  const [hunt, setHunt] = useState<Spot | null>(null);
  const [lens, setLens] = useState<Spot | null>(null);
  const [puzzle, setPuzzle] = useState<Painting | null>(null);
  const [tick, setTick] = useState(0);

  const boards = useMemo(() => boardsOf(state), [state.entries, state.quiet, state.house]); // eslint-disable-line react-hooks/exhaustive-deps

  const spots = useMemo(() => boards.flatMap((b) => {
    const got = huntedOf(b.key);
    return discoveriesOf(b.painting.id).map((d, i): Spot => ({ b, d, i, state: got.includes(i) ? 'found' : b.always || b.restored >= AT[i] ? 'ready' : 'locked' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [boards, tick]);
  const ready = spots.filter((s) => s.state === 'ready');
  const found = spots.filter((s) => s.state === 'found').length;

  const puzzles = useMemo(() => [...new Map(boards.map((b) => [b.painting.id, b.painting])).values()], [boards]);
  const next = ready[0];

  const won = (s: Spot) => {
    const l = [...new Set([...huntedOf(s.b.key), s.i])];
    saveHunted(s.b.key, l);
    setHunt(null); setLens(s); setTick((t) => t + 1);
  };

  return (
    <div className="page play">
      <header className="pl-head">
        <div className="kicker"><span style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold)' }}>Play</span></div>
        <h1 className="display">Look <em>closer</em>.</h1>
        <p className="lede">Two games made from the paintings you restore. Every line you write cleans a patch and opens another detail to find. No clock, nothing to lose.</p>
      </header>

      {/* The next game, ready to start */}
      <section className="pl-next">
        {next ? (
          <button className="pl-hero" onClick={() => setHunt(next)}>
            <span className="pl-hero-art" style={{ backgroundImage: `url(${artSrc(next.b.painting.id, 'md')})` }} aria-hidden><span className="pl-hero-lens" style={{ left: "50%", top: "50%" }} /></span>
            <span className="pl-hero-t">
              <span className="pl-k">Find it · {ready.length === 1 ? 'one detail' : `${ready.length} details`} waiting</span>
              <b>{next.d.title}</b>
              <i>Somewhere in {next.b.painting.title}, {next.b.painting.artist}</i>
              <span className="pl-cta">Start looking<Icon.right size={15} /></span>
            </span>
          </button>
        ) : puzzles[0] ? (
          <button className="pl-hero" onClick={() => setPuzzle(puzzles[0])}>
            <span className="pl-hero-art pz-thumb" style={{ backgroundImage: `url(${artSrc(puzzles[0].id, 'md')})` }} aria-hidden><i /><i /><i /><i /></span>
            <span className="pl-hero-t">
              <span className="pl-k">Put it back together</span>
              <b>{puzzles[0].title}</b>
              <i>Every detail found for now. Write a few lines and more open. Meanwhile, a puzzle.</i>
              <span className="pl-cta">Shuffle the pieces<Icon.right size={15} /></span>
            </span>
          </button>
        ) : null}
      </section>

      {/* Find it */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Find <em>it</em></h2>
          <p className="body-serif">A curator names a detail; you find it in the whole painting. Warmer, colder, and a little light if you need it. {found} of {spots.length} found.</p>
        </div>
        <div className="pl-boards">
          {boards.map((b) => (
            <div key={b.key} className="pl-board">
              <div className="pl-board-head"><i>{b.painting.title}</i><span>{b.where}</span></div>
              <div className="pl-spots">
                {spots.filter((s) => s.b === b).map((s) => (
                  <button key={s.i} className={'pl-spot ' + s.state} disabled={s.state === 'locked'} onClick={() => (s.state === 'found' ? setLens(s) : setHunt(s))}
                    aria-label={s.state === 'found' ? `Found: ${s.d.title}` : s.state === 'ready' ? `Find ${s.d.title}` : `Opens at ${AT[s.i]} cleaned patches`}>
                    <span className="pl-glass" style={s.state === 'found' ? { backgroundImage: `url(${artSrc(b.painting.id, 'md')})`, backgroundSize: `${s.d.zoom * 100}% auto`, backgroundPosition: `${aim(s.d.x, s.d.zoom)}% ${aim(s.d.y, s.d.zoom)}%` } : s.state === 'ready' ? { backgroundImage: `url(${artSrc(b.painting.id, 'sm')})` } : undefined}>
                      {s.state === 'ready' && <span className="disc-q">Find</span>}
                      {s.state === 'locked' && <span className="disc-lock">{AT[s.i]}</span>}
                    </span>
                    <span className="pl-spot-t">{s.state === 'locked' ? `Opens at ${AT[s.i]} of ${PATCHES} patches` : s.d.title}</span>
                    <span className="pl-spot-s">{s.state === 'found' ? 'Found' : s.state === 'ready' ? 'Ready to find' : `${Math.max(0, AT[s.i] - b.restored)} more to go`}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Put it back together */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Put it back <em>together</em></h2>
          <p className="body-serif">Your paintings, cut into 9, 16 or 25 pieces and shuffled. Pick a piece, then the place it belongs.</p>
        </div>
        <div className="pz-shelf">
          {puzzles.map((p) => (
            <button key={p.id} className="pz-pick" onClick={() => setPuzzle(p)} aria-label={`Puzzle: ${p.title}`}>
              <span className="pz-thumb" style={{ backgroundImage: `url(${artSrc(p.id, 'md')})` }} aria-hidden><i /><i /><i /><i /></span>
              <span className="pz-name"><i>{p.title}</i><span>{p.artist}</span></span>
              <span className="pz-play">Play<Icon.right size={13} /></span>
            </button>
          ))}
        </div>
      </section>

      {createPortal(<AnimatePresence>{hunt && <Hunt key={hunt.b.key + hunt.i} painting={hunt.b.painting} d={hunt.d} calm={calm} onFound={() => won(hunt)} onClose={() => setHunt(null)} />}</AnimatePresence>, document.body)}
      {createPortal(<AnimatePresence>{lens && <Lens key={'l' + lens.b.key + lens.i} painting={lens.b.painting} d={lens.d} fresh calm={calm} onClose={() => setLens(null)} />}</AnimatePresence>, document.body)}
      <AnimatePresence>{puzzle && <Puzzle key={puzzle.id} painting={puzzle} calm={calm} onClose={() => setPuzzle(null)} />}</AnimatePresence>
    </div>
  );
}
