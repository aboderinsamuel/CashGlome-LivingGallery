// The evening sitting: once a day, by candlelight, the month's painting asks what the day cost.
// One line is enough; "Nothing today" is kept the same way and paints a stroke too. Missing a day costs nothing.
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { Painting } from '../lib/art';
import type { Entry } from '../lib/types';
import { LivingCanvas, strokeFor } from '../stage/LivingCanvas';
import { NEUTRAL } from '../stage/mood';
import { Chalk } from './Chalk';
import { Icon } from './Icons';

interface Props {
  painting: Painting;
  todays: Entry[];
  quiet: boolean;
  calm?: boolean;
  first?: string;
  onWrite: () => void;
  onQuiet: (on: boolean) => void;
}

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* no vibration here */ } };

export function Sitting({ painting, todays, quiet, calm, first, onWrite, onQuiet }: Props) {
  const strokes = useMemo(() => todays.map((e) => strokeFor(e.id, e.amount, e.createdAt - performance.timeOrigin)), [todays]);
  const night = new Date().getHours() >= 17 || new Date().getHours() < 5;
  return (
    <motion.section className={'sit' + (quiet ? ' kept' : '')} aria-label="The evening sitting" initial={calm ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <div className="sit-art" aria-hidden>
        <LivingCanvas id={painting.id} stage={quiet ? 2.6 : 2} mood={NEUTRAL} night={night ? 0.85 : 0.2} strokes={strokes} flash={quiet ? 1 : 0} />
      </div>
      <div className="sit-body">
        <div className="sit-kicker">{night ? 'The evening sitting' : 'Today’s sitting'}</div>
        {quiet ? (
          <>
            <h2><Chalk kind="tick" calm={calm} style={{ position: 'relative', display: 'inline-block', width: 30, height: 24, marginRight: 10, verticalAlign: '-2px' }} />A quiet day, <em>kept</em>.</h2>
            <p>Nothing spent is a line too. It painted a stroke of {painting.title}.</p>
            <div className="sit-acts"><button className="sit-undo" onClick={() => onQuiet(false)}>I did spend something</button></div>
          </>
        ) : (
          <>
            <h2>{first ? `${first}, what` : 'What'} did today <em>cost</em>?</h2>
            <p>One line is enough. A quiet day counts the same, and a missed one costs nothing.</p>
            <div className="sit-acts">
              <button className="stamp" onClick={() => { buzz(10); onWrite(); }}><Icon.quill size={16} />Write today’s line</button>
              <button className="chip sit-quiet" onClick={() => { buzz([8, 50, 12]); onQuiet(true); }}>Nothing today</button>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}
