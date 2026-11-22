// The example month says what it is. A slim gilt ribbon on every page while example entries are in the book,
// with the way out in words; and, for someone who opened the example from the first page, a three-step tour
// of the three acts (Write, See, Ask), one action each, skippable at any moment.
import { AnimatePresence, motion } from 'framer-motion';
import './example-guide.css';

export type TourStep = 0 | 1 | 2 | 3;

interface Props {
  /** The book was opened as the example month (so "Start my own book" is a fresh start). */
  example: boolean;
  /** Where the tour is; null when it's over or was never offered. */
  step: TourStep | null;
  /** The line the Write step offers, in the book's own money. */
  line: string;
  onWrite: () => void;
  onSee: () => void;
  onAsk: () => void;
  onEndTour: () => void;
  onTour: () => void;
  /** Leave the example: a fresh first run, or (for examples added from Your book) just the examples removed. */
  onLeave: () => void;
}

const STEPS = [
  { act: 'Write', title: <>Say it the way you’d <em>say</em> it</>, body: 'One line can hold several things. CashGlome reads amounts, shorthand like 4k and 1.5m, and whether money came in or went out.' },
  { act: 'See', title: <>Every line cleans a <em>patch</em></>, body: 'Each month has a painting under old varnish. What you write lifts it, patch by patch; a finished month hangs in your gallery for good.' },
] as const;

function Dots({ step }: { step: number }) {
  return <span className="xg-dots" aria-label={step < 3 ? `Step ${step + 1} of 3` : 'Tour finished'}>{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</span>;
}

export function ExampleGuide({ example, step, line, onWrite, onSee, onAsk, onEndTour, onTour, onLeave }: Props) {
  const touring = step !== null;
  const s = step !== null && step < 2 ? STEPS[step as 0 | 1] : null;
  const act = step === 0 ? onWrite : onSee;
  const actLabel = step === 0 ? <>Write “{line}”</> : 'Show me the painting';
  return (
    <div className={'xg' + (touring ? ' touring' : '')} role="region" aria-label="Example month">
      <div className="xg-bar">
        <span className="xg-mark" aria-hidden />
        <span className="xg-say"><b>Example month</b><span>Not real money</span></span>
        {!touring && example && <button type="button" className="xg-link" onClick={onTour}>Tour</button>}
        <button type="button" className="xg-out" onClick={onLeave}>{example ? 'Start my own book' : 'Remove examples'}</button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {touring && (step! < 2 ? (
          <motion.div key={step} className="xg-card" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="xg-kick">
              <Dots step={step!} />
              <span>{s!.act}</span>
              <button type="button" className="xg-skip" onClick={onEndTour}>Skip the tour</button>
            </div>
            <h2>{s!.title}</h2>
            <p>{s!.body}</p>
            <button type="button" className="xg-go" onClick={act}>{actLabel}</button>
          </motion.div>
        ) : (
          // The last two steps are a slim bar, so the painting and Florin's answer stay in view.
          <motion.div key={step} className="xg-card slim" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
            <Dots step={step!} />
            {step === 2
              ? <p><b>Ask in plain words.</b> Florin works out what you mean; your device does the sums and shows its working.</p>
              : <p><b>That’s the tour.</b> Your own book starts empty, needs no sign-up, and stays on this device.</p>}
            {step === 2
              ? <button type="button" className="xg-go" onClick={onAsk}>Ask Florin</button>
              : <button type="button" className="xg-go" onClick={onEndTour}>Done</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
