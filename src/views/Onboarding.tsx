// First run, in one moment. This month's painting, under old varnish, fills the top of the screen; an unseen hand
// swabs across it in the first second, and the colour shows through. Rub it and it lifts, then clouds back:
// only writing takes it off for good. One line, written or tapped, lifts it in broad strokes, and you're in
// your book. No sign-up, no form, no tour, no name to give (the house and the name wait inside, for later).
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { paintingOf } from '../lib/art';
import { cat } from '../lib/categories';
import { money, monthOf, todayISO } from '../lib/format';
import { parseStory } from '../lib/parser';
import { cloudConfigured } from '../lib/cloud';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import { sfx } from '../lib/sound';
import { examplesFor } from '../stage/words';
import { Account } from '../components/Account';
import { Medallion } from '../components/Mark';
import { CurrencyList } from '../components/CurrencyPicker';
import { Varnish, type VarnishHandle } from '../components/Varnish';
import { Icon } from '../components/Icons';
import type { Calling as Call } from '../lib/houses';
import './onboarding.css';

type Act = 'cover' | 'return';

interface Props {
  initialCurrency: string;
  calm?: boolean;
  /** Finished: start the book with this name and currency, the first line, and the house it called. */
  onDone: (p: { name: string; currency: string; line?: string; sample?: boolean; house?: Call; statement?: boolean }) => void;
}

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not on this device */ } };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WORDS = ['', 'One patch', 'Two patches', 'Three patches'];

export function Onboarding({ initialCurrency, calm, onDone }: Props) {
  const [act, setAct] = useState<Act>('cover');
  const [currency, setCurrency] = useState(initialCurrency);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [voice, setVoice] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState(false);
  const [rubbed, setRubbed] = useState(false);
  const [cleaned, setCleaned] = useState(0);
  const session = useRef<Listening | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const varnish = useRef<VarnishHandle>(null);
  const tapped = useRef<string | null>(null);
  const painting = useMemo(() => paintingOf({ month: monthOf(todayISO()) }), []);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
  const read = useMemo(() => parseStory(text, { home: currency }), [text, currency]);
  const examples = useMemo(() => examplesFor(currency), [currency]);

  // On a computer the caret is already waiting in the slip; on a phone the keyboard would hide the painting.
  useEffect(() => { if (matchMedia('(pointer: fine)').matches) input.current?.focus({ preventScroll: true }); }, []);

  // A line that names its money ("$20", "4,000 naira") says which currency they count in.
  useEffect(() => {
    const named = read.find((p) => p.currency && p.currency !== currency)?.currency;
    if (named && read.every((p) => !p.currency || p.currency === named)) setCurrency(named);
  }, [read, currency]);

  const send = async (line = text) => {
    if (sent) return;
    const items = parseStory(line, { home: currency });
    if (!items.length) { setNote(line.trim() ? 'Add an amount, like “lunch 2,500” or “got paid 350k”.' : 'Write one thing you paid for today, with what it cost.'); buzz(30); input.current?.focus(); return; }
    session.current?.stop();
    setSent(true); setPicking(false); setNote(''); input.current?.blur();
    sfx.restore(); buzz([10, 60, 14]);
    // Up to three patches on a day, as in the book. Each one is a broad stroke across the painting.
    const n = Math.min(3, items.length);
    await wait(calm ? 0 : 180);
    for (let i = 0; i < n; i++) { sfx.brush(i === n - 1); buzz(8); await varnish.current?.stroke(i, calm ? 0 : 480); }
    setCleaned(n);
    await wait(calm ? 250 : 850);
    onDone({ name: '', currency, line: line.trim() });
  };
  /** An example line: written on the slip, read at once, and kept a moment later. */
  const tryLine = (x: string) => {
    if (sent) return;
    setText(x); setNote(''); tapped.current = x;
    setTimeout(() => { if (tapped.current === x) void send(x); }, calm ? 0 : 650);
  };
  const speak = () => {
    if (voice) { session.current?.stop(); return; }
    setNote(''); setVoice(true);
    session.current = listen({ onText: (t) => setText(t), onError: (m) => setNote(m), onEnd: () => { setVoice(false); session.current = null; } });
  };

  return (
    <motion.div className={'ob2' + (sent ? ' sent' : '')} role="dialog" aria-label="Welcome to CashGlome" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <figure className="ob2-art">
        <Varnish ref={varnish} src={`./art/md/${painting.id}.jpg`} low={`./art/sm/${painting.id}.jpg`} focus={painting.focus} calm={calm} demo onRub={() => setRubbed(true)} />
        <span className="ob2-brand">CashGlome</span>
        <AnimatePresence mode="wait">
          {cleaned > 0 ? (
            <motion.p key="done" className="ob2-say done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <b>{WORDS[cleaned]} cleaned.</b> Your first chapter has begun.
            </motion.p>
          ) : !sent && (
            <motion.p key={rubbed ? 'rubbed' : 'rub'} className="ob2-say" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: rubbed ? 0.2 : 1.1 } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              {rubbed ? <>It clouds back over. <b>Only writing lifts it for good.</b></> : <><span className="ob2-swipe" aria-hidden /> Rub the old varnish</>}
            </motion.p>
          )}
        </AnimatePresence>
        <figcaption className="ob2-label"><i>{painting.title}</i><span>{painting.artist}, {painting.year}</span></figcaption>
      </figure>

      <section className="ob2-page">
        {act === 'cover' ? (
          <>
            <h1>Your money, <em>painted</em>.</h1>
            <p className="ob2-lede">Write what you spend, the way you’d say it. Every line lifts the varnish off a masterpiece.</p>

            <div className="ob2-slip-wrap">
              <form className={'ob2-slip' + (voice ? ' rec' : '') + (read.length ? ' ready' : '')} onSubmit={(e) => { e.preventDefault(); tapped.current = null; void send(); }}>
                <button type="button" className="ob2-coin" onClick={() => setPicking((p) => !p)} aria-label={`Counting in ${currency}. Change the currency`} aria-expanded={picking} disabled={sent}>
                  <Medallion code={currency} size={28} />
                </button>
                <input ref={input} value={text} onChange={(e) => { setText(e.target.value); setNote(''); tapped.current = null; }}
                  placeholder="What did today cost?" aria-label="What did today cost?" enterKeyHint="send" disabled={sent} autoComplete="off" />
                {canSpeak && !sent && <button type="button" className={'ob2-mic' + (voice ? ' on' : '')} onClick={speak} aria-label={voice ? 'Stop listening' : 'Say it instead'}><Icon.mic size={18} /></button>}
                <button type="submit" className="wax ob2-send" aria-label="Keep this line" disabled={sent}><Icon.up size={18} /></button>
              </form>
              <AnimatePresence>
                {picking && (
                  <motion.div className="ob-picker cpick" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <CurrencyList value={currency} onPick={(c) => { setCurrency(c); setPicking(false); input.current?.focus(); }} onClose={() => setPicking(false)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="ob2-under" aria-live="polite">
              {read.length > 0 ? (
                <p className="ob2-reads">
                  {read.slice(0, 4).map((p, i) => (
                    <motion.span key={i + p.label} className={'ob2-read' + (p.dir === 'in' ? ' in' : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <i style={{ background: cat(p.category).color }} />{p.label}<b>{p.dir === 'in' ? '+' : '−'}{money(p.amount, p.currency ?? currency)}</b>
                    </motion.span>
                  ))}
                </p>
              ) : note ? <p className="ob2-note">{note}</p> : (
                <p className="ob2-try">or tap <button type="button" onClick={() => tryLine(examples[0])}>{examples[0]}</button></p>
              )}
            </div>

            <div className="ob2-foot">
              <button type="button" className="ob2-example" onClick={() => onDone({ name: '', currency, sample: true })} disabled={sent}>See a finished month first<Icon.right size={15} /></button>
              <span className="ob2-quiet">
                <button type="button" onClick={() => onDone({ name: '', currency, statement: true })} disabled={sent}>Import a bank statement</button>
                {cloudConfigured && <><i aria-hidden>·</i><button type="button" onClick={() => setAct('return')} disabled={sent}>I already have a book</button></>}
              </span>
              <p className="ob2-promise">No sign-up · Works offline · No bank login · No ads</p>
            </div>
          </>
        ) : (
          <>
            <h1>Welcome <em>back</em>.</h1>
            <div className="ob-acct"><p>Sign in and your book comes back to this device.</p><Account compact /></div>
            <div className="ob2-foot"><span className="ob2-quiet"><button type="button" onClick={() => setAct('cover')}>Start a new book instead</button></span></div>
          </>
        )}
      </section>
    </motion.div>
  );
}
