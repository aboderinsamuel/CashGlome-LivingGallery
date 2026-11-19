// The Calling: once a year, the gallery calls you to a house. A black room, a frame that draws itself,
// the six house paintings flickering inside it until one holds; light blooms, the painting takes the
// whole screen, and the house's name rises out of the dark in letters a hand high. The music plays here
// and only here, very low.
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { artSrc, PAINTINGS } from '../lib/art';
import { aim } from '../lib/discoveries';
import { HOUSE_ORDER, HOUSES, houseName, type Calling as Call } from '../lib/houses';
import { endOverture, onOverture, overtureState, playOverture, setSound } from '../lib/overture';
import { sfx } from '../lib/sound';
import { Icon } from './Icons';
import './calling.css';

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* none here */ } };
const ease = [0.2, 0.9, 0.1, 1] as const;

/** The flicker: fast, then slower and slower, until the last tick lands on their house. */
function ticks(target: number, start: number) {
  const gaps = [70, 70, 75, 80, 85, 95, 105, 120, 140, 165, 195, 235, 285, 350, 430];
  // Count back from the target so the last gap lands on it.
  const seq: number[] = [];
  for (let i = gaps.length; i >= 0; i--) seq.push((target - i + HOUSE_ORDER.length * 4) % HOUSE_ORDER.length);
  seq[0] = start;
  return { seq, gaps };
}

interface Props {
  calling: Call;
  /** Ask for a name to sign the house book with (the first calling, at onboarding). */
  askName?: boolean;
  name?: string;
  /** A replay of an earlier calling, from the house plate: shorter, no flicker. */
  replay?: boolean;
  calm?: boolean;
  /** "Called by your first line" or "Called by your year". */
  by: 'line' | 'year' | 'book';
  onDone: (name: string) => void;
}

export function Calling({ calling, askName, name: given = '', replay, calm, by, onDone }: Props) {
  const reduce = useReducedMotion() || calm;
  const house = HOUSES[calling.id];
  const art = PAINTINGS[house.painting];
  const target = HOUSE_ORDER.indexOf(calling.id);
  const year = calling.calledAt.slice(0, 4);
  // beats: 0 the frame draws · 1 the flicker · 2 it holds, light blooms · 3 the name · 4 sign and enter
  const [beat, setBeat] = useState(reduce ? 4 : replay ? 2 : 0);
  const [shown, setShown] = useState(reduce || replay ? target : (target + 3) % HOUSE_ORDER.length);
  const [name, setName] = useState(given);
  const [snd, setSnd] = useState(overtureState);
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };

  // Every house painting, fetched before it's needed, so the flicker never shows a blank frame.
  useEffect(() => { HOUSE_ORDER.forEach((h) => { const i = new Image(); i.src = artSrc(HOUSES[h].painting, 'md'); }); const big = new Image(); big.src = artSrc(house.painting, 'lg'); }, [house.painting]);
  useEffect(() => onOverture(() => setSnd(overtureState())), []);
  useEffect(() => { playOverture(0.12); return () => endOverture(); }, []);

  useEffect(() => {
    if (reduce) return;
    if (replay) { later(900, () => setBeat(3)); later(2600, () => setBeat(4)); return () => timers.current.forEach(clearTimeout); }
    // The lockup holds long enough to be read: The Calling, the year.
    later(2500, () => setBeat(1));
    const { seq, gaps } = ticks(target, shown);
    let t = 2600;
    seq.forEach((h, i) => {
      t += gaps[Math.min(i, gaps.length - 1)];
      later(t, () => { setShown(h); buzz(i > seq.length - 4 ? 9 : 4); if (i > seq.length - 5) sfx.tap(); });
    });
    later(t + 420, () => { setBeat(2); buzz([12, 50, 24]); sfx.restore(); });
    later(t + 1500, () => setBeat(3));
    later(t + 3600, () => setBeat(4));
    return () => timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A tap during the flicker skips to the house. */
  const skip = () => {
    if (beat >= 3) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    setShown(target); setBeat(3); later(1400, () => setBeat(4));
  };
  // Once only: a held Enter or a double tap must not sign the book twice while the room fades out.
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    (document.activeElement as HTMLElement | null)?.blur?.();
    buzz(10); endOverture(1600); onDone(name.trim());
  };

  const letters = useMemo(() => house.word.toUpperCase().split(''), [house.word]);
  const fs = `min(calc((100vw - 40px) / ${Math.max(4, letters.length) * 0.66}), 210px)`;
  const crest = (z = house.crest[2]) => ({ backgroundImage: `url(${artSrc(house.painting, 'md')})`, backgroundSize: `${z * 100}% auto`, backgroundPosition: `${aim(house.crest[0], z)}% ${aim(house.crest[1], z)}%` });
  const ring = `${houseName(house).toUpperCase()} · CALLED ${year} · ${house.motto.toUpperCase()} · `;

  return createPortal(
    <motion.div className={'calling b' + beat} style={{ ['--house' as string]: house.color }} role="dialog" aria-label={`The Calling: ${houseName(house)}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} onClick={skip}>

      {/* The painting, full-bleed once it holds. It opens out of the frame. */}
      <motion.div className="cl-full" aria-hidden
        initial={false}
        animate={beat >= 2 ? { clipPath: 'inset(0% 0% 0% 0% round 0px)', opacity: 1 } : { clipPath: 'inset(30% 30% 30% 30% round 2px)', opacity: 0 }}
        transition={{ duration: reduce ? 0 : 1.15, ease }}>
        <motion.div className="cl-full-img" style={{ backgroundImage: `url(${artSrc(house.painting, 'lg')})` }}
          initial={{ scale: 1.25 }} animate={{ scale: beat >= 2 ? 1.04 : 1.25 }} transition={{ duration: reduce ? 0 : 9, ease: [0.1, 0.6, 0.2, 1] }} />
        <div className="cl-shade" />
      </motion.div>

      {/* Hairlines: rules running out to the edges, and an arc swinging in from the corner. */}
      <div className="cl-lines" aria-hidden>
        <motion.i className="h" style={{ top: '18%' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduce ? 0 : 1.4, ease, delay: 0.2 }} />
        <motion.i className="h" style={{ top: '82%', transformOrigin: 'right' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduce ? 0 : 1.4, ease, delay: 0.35 }} />
        <motion.i className="v" style={{ left: '14%' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: reduce ? 0 : 1.4, ease, delay: 0.5 }} />
        <svg className="cl-arc" viewBox="0 0 100 100"><motion.path d="M100 0 A 100 100 0 0 0 0 100" initial={{ pathLength: 0 }} animate={{ pathLength: beat >= 3 ? 0 : 1, opacity: beat >= 3 ? 0 : 0.6 }} transition={{ duration: reduce ? 0 : 1.6, ease }} /></svg>
      </div>

      {/* The frame and the flicker inside it. */}
      {beat < 3 && (
        <motion.div className="cl-frame" initial={{ opacity: 1 }} animate={{ opacity: beat >= 2 ? 0 : 1, scale: beat >= 2 ? 1.6 : 1 }} transition={{ duration: 1, ease }}>
          <svg className="cl-box" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <motion.rect x="0.5" y="0.5" width="99" height="99" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.2, ease }} />
          </svg>
          {beat === 0 ? (
            <div className="cl-lockup">
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}>The</motion.span>
              <motion.i initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}>Calling</motion.i>
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.6 }}>{year}</motion.span>
            </div>
          ) : (
            <>
              <div className="cl-flick" style={{ backgroundImage: `url(${artSrc(HOUSES[HOUSE_ORDER[shown]].painting, 'md')})` }} />
              <motion.div key={shown} className="cl-orb" initial={{ opacity: 0.9, scale: 0.6 }} animate={{ opacity: 0.35, scale: 1 }} transition={{ duration: 0.3 }} />
            </>
          )}
          <div className="cl-under">{beat === 0 ? 'Six houses. One is yours.' : houseName(HOUSES[HOUSE_ORDER[shown]])}</div>
        </motion.div>
      )}

      {/* The bloom when it holds. */}
      {beat === 2 && !reduce && <motion.div className="cl-bloom" aria-hidden initial={{ opacity: 0.95, scale: 0.2 }} animate={{ opacity: 0, scale: 5 }} transition={{ duration: 1.3, ease: [0.1, 0.8, 0.2, 1] }} />}

      {/* The name, a hand high, and under it the label, why, and the signature: one stack, so they never collide. */}
      {beat >= 3 && (
      <div className="cl-stack">
        <div className="cl-title">
          <motion.div className="cl-pre" initial={reduce ? false : { opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease }}>
            <motion.span className="cl-band" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease }} />
            <span className="cl-pre-t">{by === 'line' ? 'Your first line calls you to the' : by === 'year' ? 'Your year calls you to the' : 'You belong to the'}</span>
          </motion.div>
          <h1 className="cl-word" style={{ fontSize: fs }} aria-label={houseName(house)}>
            <span className="cl-house" aria-hidden>House of{house.the ? ' the' : ''}</span>
            <span className="cl-letters" aria-hidden>
              {letters.map((l, i) => (
                <span key={i} className="cl-l"><motion.span initial={reduce ? false : { y: '108%' }} animate={{ y: '0%' }} transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.05 }}>{l}</motion.span></span>
              ))}
            </span>
          </h1>
          <motion.p className="cl-motto" initial={reduce ? false : { clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 1.1, ease, delay: 0.5 + letters.length * 0.05 }}>
            <b>{house.motto[0]}</b>{house.motto.slice(1)}
          </motion.p>
        </div>

        {/* The label: which painting, and why. Then sign and enter. Its room is kept from the start. */}
        <motion.div className="cl-foot" style={{ visibility: beat >= 4 ? 'visible' : 'hidden' }} initial={reduce ? false : { opacity: 0, y: 24 }} animate={beat >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }} transition={{ duration: 0.7, ease }} onClick={(e) => e.stopPropagation()}>
          <div className="cl-label"><i>{art.title}</i><span>{art.artist}, {art.year}</span></div>
          <p className="cl-why">
            {calling.why.length ? <>Called by {calling.why.slice(0, -1).join(', ')}{calling.why.length > 1 ? ' and ' : ''}{calling.why[calling.why.length - 1]}. </> : null}
            A house for {house.calls}, with a little of the {HOUSES[calling.runnerUp].word} in you. Yours for a year.
          </p>
          {askName ? (
            <form className="cl-sign" onSubmit={(e) => { e.preventDefault(); finish(); }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sign with your first name" aria-label="Your first name" autoComplete="given-name" maxLength={40} enterKeyHint="go" />
              <button type="submit" className="cl-go">Enter my book<Icon.right size={15} /></button>
            </form>
          ) : (
            <button className="cl-go solo" onClick={finish} autoFocus>{replay ? 'Back to my book' : 'Enter my book'}<Icon.right size={15} /></button>
          )}
          {askName && <p className="cl-fine">The name is only for the greeting, and it stays on this device.</p>}
        </motion.div>
      </div>
      )}

      {/* The crest: a roundel cut from the painting, with the house's name turning around it. */}
      {beat >= 3 && (
        <motion.div className="cl-crest" aria-hidden initial={reduce ? false : { scale: 2.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.7 }}>
          <svg viewBox="0 0 120 120" className="cl-ring">
            <defs><path id="cl-arc" d="M60 60 m-49 0 a49 49 0 1 1 98 0 a49 49 0 1 1 -98 0" /></defs>
            <circle cx="60" cy="60" r="57" className="cl-ring-o" />
            <circle cx="60" cy="60" r="41" className="cl-ring-i" />
            <text><textPath href="#cl-arc" textLength="304">{ring}</textPath></text>
          </svg>
          <span className="cl-crest-img" style={crest()} />
        </motion.div>
      )}

      {/* The top: a skip during the flicker; the music switch while it plays. */}
      <div className="cl-top" onClick={(e) => e.stopPropagation()}>
        <span className="cl-brand">CashGlome</span>
        {snd.available && (
          <button className="cl-snd" onClick={() => setSound(!snd.playing)} aria-pressed={snd.playing} title="Vivaldi, Winter. John Harrison and the Wichita State University Chamber Players, CC BY-SA 4.0">
            <span className={'cl-bars' + (snd.playing ? ' on' : '')} aria-hidden><i /><i /><i /></span>{snd.playing ? 'Sound on' : 'Sound off'}
          </button>
        )}
        {beat < 3 && <button className="cl-skip" onClick={skip}>Skip</button>}
      </div>
    </motion.div>,
    document.body,
  );
}
