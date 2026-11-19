// The house, on Today: your crest and motto under the greeting (tap to see the Calling again); an
// invitation when a book has no house yet; and, a year after the last calling, the Calling coming round.
import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { artSrc } from '../lib/art';
import { aim } from '../lib/discoveries';
import { callHouse, callingDue, HOUSES, houseName, yearOf, type Calling as Call } from '../lib/houses';
import type { Action } from '../lib/store';
import type { State } from '../lib/types';
import { Calling } from './Calling';
import { Icon } from './Icons';

export function HousePlate({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const call = state.house;
  const due = callingDue(call);
  const [open, setOpen] = useState<{ calling: Call; by: 'year' | 'book'; replay: boolean } | null>(null);
  const fresh = useMemo(() => (state.entries.length ? callHouse(yearOf(state.entries)) : null), [state.entries]);
  if (!call && !fresh) return null;

  const answer = (by: 'year' | 'book') => fresh && setOpen({ calling: fresh, by, replay: false });
  const h = call ? HOUSES[call.id] : null;
  const crest = h ? { backgroundImage: `url(${artSrc(h.painting, 'sm')})`, backgroundSize: `${h.crest[2] * 100}% auto`, backgroundPosition: `${aim(h.crest[0], h.crest[2])}% ${aim(h.crest[1], h.crest[2])}%` } : undefined;

  return (
    <>
      {h && !due ? (
        <button className="hp" style={{ ['--house' as string]: h.color }} onClick={() => setOpen({ calling: call!, by: 'book', replay: true })} aria-label={`${houseName(h)}. See your Calling again`}>
          <span className="hp-crest" style={crest} aria-hidden />
          <span className="hp-t"><b>{houseName(h)}</b><i>{h.motto}</i></span>
          <span className="hp-go">See the Calling<Icon.right size={13} /></span>
        </button>
      ) : (
        <button className="hp invite" onClick={() => answer(due ? 'year' : 'book')}>
          <span className="hp-seal" aria-hidden>{due ? 'II' : 'I'}</span>
          <span className="hp-t">
            <b>{due && h ? `A year in the ${houseName(h)}.` : 'Six houses are waiting.'}</b>
            <i>{due ? 'The Calling comes round again: stay, or answer a new house.' : 'Your book is ready to call you to yours, for a year.'}</i>
          </span>
          <span className="hp-go">Answer the Calling<Icon.right size={13} /></span>
        </button>
      )}
      <AnimatePresence>
        {open && (
          <Calling key="calling" calling={open.calling} by={open.replay ? 'book' : open.by} replay={open.replay} calm={state.settings.calm}
            onDone={() => { if (!open.replay) dispatch({ type: 'house', calling: open.calling }); setOpen(null); }} />
        )}
      </AnimatePresence>
    </>
  );
}
