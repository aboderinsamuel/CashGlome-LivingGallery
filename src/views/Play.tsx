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
import { clearRoom, RESERVE, RESERVE_AFTER, ROMAN_ROOM, ROOMS, roomsOf, sealCount, SEALS_IN_ALL, WINGS, type Room } from '../lib/rooms';

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
  const [room, setRoomState] = useState<Room | null>(null);
  // Each opening is a fresh board, even when the same room is reopened while the last one is still closing.
  const [visit, setVisit] = useState(0);
  const setRoom = (r: Room | null) => { if (r) setVisit((v) => v + 1); setRoomState(r); };
  const [rooms, setRooms] = useState(roomsOf);
  const current = ROOMS.find((r) => r.n === rooms.cleared + 1) ?? null;
  const reserveOpen = rooms.cleared >= RESERVE_AFTER;
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
        <ol className="pl-how" aria-label="How Play works">
          <li><b>The Rooms.</b> Twelve paintings cut into pieces. Swap pieces until the picture is whole; each room you restore opens the next, and each is harder. Restore Room X and the Reserve opens: {RESERVE.length} more paintings. Each room holds three seals: restore it, restore it without peeking, and restore it in close to the fewest moves. Seals are only ever added.</li>
          <li><b>Find it.</b> A curator names a detail and you find it in the painting. Writing in your book cleans this month's painting and opens new details.</li>
        </ol>
      </header>

      {/* Where you are: the next room, ready */}
      <section className="pl-next">
        {current ? (
          <button className="pl-hero" onClick={() => setRoom(current)}>
            <span className="pl-hero-art pz-thumb" style={{ backgroundImage: `url(${artSrc(current.painting, 'md')})` }} aria-hidden><i /><i /><i /><i /></span>
            <span className="pl-hero-t">
              <span className="pl-k">{rooms.cleared ? `Next · Room ${ROMAN_ROOM[current.n]} of ${ROOMS.length}` : `Start here · Room I of ${ROOMS.length}`}</span>
              <b>{PAINTINGS[current.painting].title}</b>
              <i>{PAINTINGS[current.painting].artist}, {PAINTINGS[current.painting].year} · {current.size * current.size} pieces{current.hints ? '' : ', no glow'}{current.peek ? '' : ', no peek'}</i>
              <span className="pl-cta">{rooms.cleared ? 'Enter the room' : 'Begin'}<Icon.right size={15} /></span>
            </span>
          </button>
        ) : next ? (
          <button className="pl-hero" onClick={() => setHunt(next)}>
            <span className="pl-hero-art" style={{ backgroundImage: `url(${artSrc(next.b.painting.id, 'md')})` }} aria-hidden><span className="pl-hero-lens" style={{ left: '50%', top: '50%' }} /></span>
            <span className="pl-hero-t">
              <span className="pl-k">Every room restored · Find it</span>
              <b>{next.d.title}</b>
              <i>Somewhere in {next.b.painting.title}, {next.b.painting.artist}</i>
              <span className="pl-cta">Start looking<Icon.right size={15} /></span>
            </span>
          </button>
        ) : null}
      </section>

      {/* The Rooms: a ladder, wing by wing */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">The <em>Rooms</em></h2>
          <p className="body-serif">{rooms.cleared} of {ROOMS.length} restored · {ROOMS.reduce((a, r) => a + sealCount(rooms, r.n), 0)} of {SEALS_IN_ALL} seals. A padlocked room opens when you restore the one before it; a restored room can be played again for the seals it lacks.</p>
        </div>
        <div className="pl-wings">
          {WINGS.map((w) => (
            <div key={w.name} className="pl-wing">
              <div className="pl-wing-head"><b>{w.name}</b><span>Rooms {ROMAN_ROOM[w.from]}–{ROMAN_ROOM[w.to]} · {w.rule}</span>
                {(() => { const got = ROOMS.filter((r) => r.n >= w.from && r.n <= w.to).reduce((a, r) => a + sealCount(rooms, r.n), 0), all = (w.to - w.from + 1) * 3;
                  return got ? <span className={'pl-wing-seals' + (got === all ? ' full' : '')}>{got === all ? 'Full set' : `${got} of ${all} seals`}</span> : null; })()}</div>
              <div className="pl-rooms">
                {ROOMS.filter((r) => r.n >= w.from && r.n <= w.to).map((r) => {
                  const done = r.n <= rooms.cleared, open = r.n === rooms.cleared + 1, locked = !done && !open;
                  const seals = sealCount(rooms, r.n);
                  const pt = PAINTINGS[r.painting];
                  return (
                    <button key={r.n} className={'pl-room' + (done ? ' done' : open ? ' open' : ' locked') + (seals === 3 ? ' sealed' : '')} disabled={locked} onClick={() => setRoom(r)}
                      aria-label={locked ? `Room ${ROMAN_ROOM[r.n]}, locked. Restore Room ${ROMAN_ROOM[r.n - 1]} first` : `Room ${ROMAN_ROOM[r.n]}: ${pt.title}${done ? ', restored' : ''}`}>
                      <span className="pl-room-art" style={locked ? undefined : { backgroundImage: `url(${artSrc(r.painting, 'sm')})` }} aria-hidden>
                        {locked && <Icon.lock size={20} />}

                      </span>
                      <span className="pl-room-n">Room {ROMAN_ROOM[r.n]}</span>
                      <span className="pl-room-t">{locked ? `Restore Room ${ROMAN_ROOM[r.n - 1]} first` : pt.title}</span>
                      <span className="pl-room-s">{done ? <><span className="pl-room-seals" aria-label={`${seals} of 3 seals`}>{[0, 1, 2].map((i) => <i key={i} className={i < seals ? 'on' : ''} />)}</span>{seals === 3 ? 'Every seal' : 'Play again for more'}</> : open ? 'Open now' : `${r.size * r.size} pieces`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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

      {/* Free play: your own paintings always, the Reserve after Room X */}
      <section className="section">
        <div className="section-head">
          <h2 className="h2">Free <em>play</em></h2>
          <p className="body-serif">Any painting, any size, as often as you like. Your own paintings are always here; the Reserve opens when you restore Room {ROMAN_ROOM[RESERVE_AFTER]}.</p>
        </div>
        <div className="pz-shelf">
          {puzzles.map((p) => (
            <button key={p.id} className="pz-pick" onClick={() => setPuzzle(p)} aria-label={`Puzzle: ${p.title}`}>
              <span className="pz-thumb" style={{ backgroundImage: `url(${artSrc(p.id, 'md')})` }} aria-hidden><i /><i /><i /><i /></span>
              <span className="pz-name"><i>{p.title}</i><span>{p.artist} · yours</span></span>
              <span className="pz-play">Play<Icon.right size={13} /></span>
            </button>
          ))}
        </div>
        <div className={'pl-reserve' + (reserveOpen ? ' open' : '')}>
          <div className="pl-wing-head"><b>The Reserve</b><span>{reserveOpen ? `${RESERVE.length} paintings, open to you.` : `${RESERVE.length} paintings, padlocked until Room ${ROMAN_ROOM[RESERVE_AFTER]} is restored. ${Math.max(0, RESERVE_AFTER - rooms.cleared)} rooms to go.`}</span></div>
          <div className="pz-shelf">
            {RESERVE.filter((id) => !puzzles.some((p) => p.id === id)).map((id) => PAINTINGS[id]).map((p) => (
              <button key={p.id} className={'pz-pick' + (reserveOpen ? '' : ' locked')} disabled={!reserveOpen} onClick={() => setPuzzle(p)} aria-label={reserveOpen ? `Puzzle: ${p.title}` : `${p.title}, locked until Room ${ROMAN_ROOM[RESERVE_AFTER]}`}>
                <span className="pz-thumb" style={{ backgroundImage: `url(${artSrc(p.id, 'sm')})` }} aria-hidden>{!reserveOpen && <span className="pz-lock"><Icon.lock size={18} /></span>}</span>
                <span className="pz-name"><i>{p.title}</i><span>{p.artist}, {p.year}</span></span>
                {reserveOpen && <span className="pz-play">Play<Icon.right size={13} /></span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {createPortal(<AnimatePresence>{hunt && <Hunt key={hunt.b.key + hunt.i} painting={hunt.b.painting} d={hunt.d} calm={calm} onFound={() => won(hunt)} onClose={() => setHunt(null)} />}</AnimatePresence>, document.body)}
      {createPortal(<AnimatePresence>{lens && <Lens key={'l' + lens.b.key + lens.i} painting={lens.b.painting} d={lens.d} fresh calm={calm} onClose={() => setLens(null)} />}</AnimatePresence>, document.body)}
      <AnimatePresence>{puzzle && <Puzzle key={puzzle.id} painting={puzzle} calm={calm} onClose={() => setPuzzle(null)} />}</AnimatePresence>
      <AnimatePresence>
        {room && (
          <Puzzle key={`room${room.n}-${visit}`} room={room} painting={PAINTINGS[room.painting]} calm={calm} onClose={() => setRoom(null)}
            onSolved={(m, e) => setRooms(clearRoom(room.n, m, e))}
            onNext={() => { const r = ROOMS.find((x) => x.n === room.n + 1); setRoom(null); if (r) setTimeout(() => setRoom(r), 350); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
