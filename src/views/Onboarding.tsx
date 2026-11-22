// First run, in two moments. One screen: Teniers's gallery as a red-chalk underdrawing and a line to write
// on it. Your line lands as strokes of colour; then the gallery calls you to your house for the year, and
// you sign the house book with your first name on the way in. No account, no form, no tour.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAINTINGS } from '../lib/art';
import { cat } from '../lib/categories';
import { money } from '../lib/format';
import { parseStory } from '../lib/parser';
import { cloudConfigured } from '../lib/cloud';
import { callHouse, type Calling as Call } from '../lib/houses';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import { prepareOverture } from '../lib/overture';
import { sfx } from '../lib/sound';
import { examplesFor } from '../stage/words';
import { LivingCanvas, strokeFor, type Stroke } from '../stage/LivingCanvas';
import { NEUTRAL } from '../stage/mood';
import { Account } from '../components/Account';
import { Medallion } from '../components/Mark';
import { CurrencyList } from '../components/CurrencyPicker';
import { Calling } from '../components/Calling';
import { Icon } from '../components/Icons';
import './onboarding.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
const ART = 'teniers';
type Act = 'cover' | 'calling' | 'return';

interface Props {
  initialCurrency: string;
  calm?: boolean;
  /** Finished: start the book with this name and currency, the first line, and the house it called. */
  onDone: (p: { name: string; currency: string; line?: string; sample?: boolean; house?: Call; statement?: boolean }) => void;
}

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not on this device */ } };

export function Onboarding({ initialCurrency, calm, onDone }: Props) {
  const [act, setAct] = useState<Act>('cover');
  const [currency, setCurrency] = useState(initialCurrency);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [voice, setVoice] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState(false);
  const [calling, setCalling] = useState<Call | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [stage, setStage] = useState(0);
  const [flash, setFlash] = useState(0);
  const [glReady, setGlReady] = useState<boolean | null>(null);
  const session = useRef<Listening | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
  const read = useMemo(() => parseStory(text, { home: currency }), [text, currency]);
  const examples = useMemo(() => examplesFor(currency), [currency]);
  // Someone who hasn't typed after a few seconds may not know they can: the first example glows, once.
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    if (text || sent || act !== 'cover') { setNudge(false); return; }
    const t = setTimeout(() => setNudge(true), 8000);
    return () => clearTimeout(t);
  }, [text, sent, act]);
  /** An example line goes on the slip, read at once; the arrow keeps it. */
  const tryLine = (x: string) => { setText(x); setNote(''); setNudge(false); };
  useEffect(() => { prepareOverture(); }, []);

  // A line that names its money ("$20", "4,000 naira") says which currency they count in.
  useEffect(() => {
    const named = read.find((p) => p.currency && p.currency !== currency)?.currency;
    if (named && read.every((p) => !p.currency || p.currency === named)) setCurrency(named);
  }, [read, currency]);

  const send = () => {
    if (sent) return;
    if (!read.length) { setNote(text.trim() ? 'Add an amount, like “lunch 2,500” or “got paid 350k”.' : 'Write one thing you paid for today, with what it cost.'); buzz(30); input.current?.focus(); return; }
    session.current?.stop();
    setSent(true); setPicking(false); input.current?.blur();
    sfx.restore(); buzz([10, 60, 14]);
    // Each thing in the line lands as a stroke of colour; the drawing warms toward paint.
    read.forEach((p, i) => setTimeout(() => { setStrokes((s) => [...s, strokeFor('you' + i, p.amount, performance.now())]); setFlash((f) => f + 1); }, calm ? 0 : 200 + i * 380));
    setTimeout(() => setStage(2.6), calm ? 0 : 300 + read.length * 380);
    setTimeout(() => { setCalling(callHouse(read)); setAct('calling'); }, calm ? 300 : 1900 + read.length * 380);
  };
  const speak = () => {
    if (voice) { session.current?.stop(); return; }
    setNote(''); setVoice(true);
    session.current = listen({ onText: (t) => setText(t), onError: (m) => setNote(m), onEnd: () => { setVoice(false); session.current = null; } });
  };

  return (
    <motion.div className={'ob ob-at-' + act + (sent ? ' ob-sent' : '')} role="dialog" aria-label="Welcome to CashGlome" exit={{ opacity: 0, transition: { duration: 0.7 } }}>
      <div className="ob-art">
        <LivingCanvas id={ART} stage={stage} mood={NEUTRAL} night={0} strokes={strokes} flash={flash} focus={[0.5, 0.42]} onReady={setGlReady} />
        {glReady !== true && <img src={`./art/${ART}.jpg`} alt="" className={'ob-still' + (glReady === null ? ' wait' : '')} />}
        <div className="ob-veil" aria-hidden />
      </div>

      <header className="ob-top">
        <span className="ob-brand">CashGlome</span>
        <span className="ob-label"><i>{PAINTINGS[ART].title}</i><span>{PAINTINGS[ART].artist}, {PAINTINGS[ART].year}</span></span>
      </header>

      <AnimatePresence mode="wait">
        {act === 'cover' && (
          <motion.section key="cover" className="ob-act ob-cover" exit={{ opacity: 0, y: -20, transition: { duration: 0.45, ease } }}>
            <motion.h1 initial={calm ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease, delay: 0.1 }}>
              Your money, <em>painted</em>.
            </motion.h1>
            <motion.p className="ob-lede" initial={calm ? false : { opacity: 0 }} animate={{ opacity: sent ? 0 : 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
              A private diary for your money. Write what you spend and earn, see where it goes, and watch a painting come back to life as you do.
            </motion.p>
            <motion.p className="ob-step" initial={calm ? false : { opacity: 0 }} animate={{ opacity: sent ? 0 : 1 }} transition={{ delay: 0.6, duration: 0.6 }}>
              <b>I</b><span>Write what something cost</span>
            </motion.p>
            <motion.div className="ob-slip-wrap" initial={calm ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.6 }}>
              <form className={'ob-slip' + (sent ? ' sent' : '') + (voice ? ' rec' : '')} onSubmit={(e) => { e.preventDefault(); send(); }}>
                <button type="button" className="ob-coin" onClick={() => setPicking((p) => !p)} aria-label={`Counting in ${currency}. Change the currency`} aria-expanded={picking} disabled={sent}>
                  <Medallion code={currency} size={30} />
                </button>
                <input ref={input} value={text} onChange={(e) => { setText(e.target.value); setNote(''); }}
                  placeholder="What did today cost?" aria-label="What did today cost?" enterKeyHint="send" disabled={sent} />
                {canSpeak && !sent && <button type="button" className={'ob-mic' + (voice ? ' on' : '')} onClick={speak} aria-label={voice ? 'Stop listening' : 'Say it instead'}><Icon.mic size={18} /></button>}
                <button type="submit" className="wax ob-send" aria-label="Keep this line" disabled={sent}><Icon.up size={18} /></button>
              </form>
              <AnimatePresence>
                {picking && (
                  <motion.div className="ob-picker cpick" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <CurrencyList value={currency} onPick={(c) => { setCurrency(c); setPicking(false); input.current?.focus(); }} onClose={() => setPicking(false)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <div className="ob-reads" aria-live="polite">
              {read.length > 0 ? read.slice(0, 5).map((p, i) => (
                <motion.span key={i + p.label} className={'ob-read' + (p.dir === 'in' ? ' in' : '')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <i style={{ background: cat(p.category).color }} />{p.label}<b className="num">{p.dir === 'in' ? '+' : '−'}{money(p.amount, p.currency ?? currency)}</b>
                </motion.span>
              )) : note ? <span className="ob-note">{note}</span> : !sent && (
                <p className="ob-try" role="group" aria-label="Example lines">
                  <span className="ob-try-hint">or try</span>
                  {examples.slice(0, 2).map((x, i) => <span key={x} className="ob-try-item">{i > 0 && <i aria-hidden>·</i>}<button type="button" className={'ob-try-line' + (i === 0 && nudge ? ' nudge' : '')} onClick={() => tryLine(x)}>{x}</button></span>)}
                </p>
              )}
              {!sent && read.length > 0 && <span className="ob-again">Read like that? Press the arrow to keep it.</span>}
            </div>
            {!sent && (
              <motion.div className="ob-cover-foot" initial={calm ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.6 }}>
                <span className="ob-rule" aria-hidden />
                <button type="button" className="ob-example" onClick={() => onDone({ name: '', currency, sample: true })}>
                  <span>Or see a finished month first</span><Icon.right size={16} />
                </button>
                <div className="ob-acts">
                  <button type="button" className="ob-quiet" onClick={() => onDone({ name: '', currency, statement: true })}>Import a bank statement</button>
                  {cloudConfigured && <><span aria-hidden>·</span><button type="button" className="ob-quiet" onClick={() => setAct('return')}>I already have a book</button></>}
                </div>
                <ul className="ob-promise" aria-label="Promises"><li>No sign-up</li><li>Works offline</li><li>No bank login</li><li>No ads</li></ul>
              </motion.div>
            )}
          </motion.section>
        )}
        {act === 'return' && (
          <motion.section key="return" className="ob-act ob-name-act" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16, transition: { duration: 0.35 } }} transition={{ duration: 0.7, ease }}>
            <h1 className="ob-h">Welcome <em>back</em>.</h1>
            <div className="ob-acct"><p>Sign in and your book comes back to this device.</p><Account compact /></div>
            <div className="ob-acts"><button type="button" className="ob-quiet" onClick={() => setAct('cover')}>Start a new book instead</button></div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {act === 'calling' && calling && (
          <Calling key="calling" calling={calling} askName by="line" calm={calm}
            onDone={(name) => onDone({ name, currency, line: text.trim(), house: calling })} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
