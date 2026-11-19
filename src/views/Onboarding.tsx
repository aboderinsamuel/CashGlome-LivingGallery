// First run, on one living painting. The cover is Teniers's gallery as a red chalk underdrawing.
// A line writes itself and each amount brushes colour into the drawing; then it's your turn, on the same
// sheet: your first line lands as your own strokes. Your name comes last, after you've seen it work.
// No account and no form: a line, then a name, and you're in.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PAINTINGS } from '../lib/art';
import { cat } from '../lib/categories';
import { money } from '../lib/format';
import { parseStory } from '../lib/parser';
import { cloudConfigured } from '../lib/cloud';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import { onOverture, overtureState, playOverture, prepareOverture, setSound } from '../lib/overture';
import { sfx } from '../lib/sound';
import { examplesFor } from '../stage/words';
import { LivingCanvas, strokeFor, type Stroke } from '../stage/LivingCanvas';
import { NEUTRAL } from '../stage/mood';
import { Account } from '../components/Account';
import { Medallion } from '../components/Mark';
import { CurrencyList } from '../components/CurrencyPicker';
import { Chalk } from '../components/Chalk';
import { Icon } from '../components/Icons';
import './onboarding.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
const ART = 'teniers';
type Act = 'cover' | 'line' | 'name' | 'seal';

interface Props {
  initialCurrency: string;
  calm?: boolean;
  /** Finished: start the book with this name and currency, and write the first line if there is one. */
  onDone: (p: { name: string; currency: string; line?: string; sample?: boolean }) => void;
}

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not on this device */ } };
// Where the cover's demo strokes fall on the gallery: the walls of pictures on either side, then the centre.
const DEMO_SPOTS: [number, number][] = [[0.22, 0.5], [0.78, 0.48], [0.55, 0.32]];

export function Onboarding({ initialCurrency, calm, onDone }: Props) {
  const [act, setAct] = useState<Act>('cover');
  const [currency, setCurrency] = useState(initialCurrency);
  const [line, setLine] = useState('');
  const [name, setName] = useState('');
  const [returning, setReturning] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [stage, setStage] = useState(0);
  const [flash, setFlash] = useState(0);
  const [glReady, setGlReady] = useState<boolean | null>(null);
  const sound = useSyncExternalStore(onOverture, () => JSON.stringify(overtureState()));
  const snd = JSON.parse(sound) as ReturnType<typeof overtureState>;
  useEffect(() => { prepareOverture(); }, []);

  /** A stroke of colour lands where a line's amount says. */
  const land = (id: string, amount: number, spot?: [number, number]) => {
    setStrokes((s) => [...s, strokeFor(id, amount, performance.now(), spot)]);
    setFlash((f) => f + 1);
  };

  const begin = () => {
    playOverture(); sfx.open(); buzz(12);
    // A clean sheet for their own line: the colour goes back under the chalk.
    setStrokes([]); setStage(0); setAct('line');
  };
  const kept = (text: string, amounts: number[]) => {
    setLine(text); sfx.restore(); buzz([10, 60, 14]);
    amounts.forEach((a, i) => setTimeout(() => land('you' + i, a), calm ? 0 : 260 + i * 420));
    setTimeout(() => setStage(1.2), calm ? 0 : 400 + amounts.length * 420);
    setTimeout(() => setAct('name'), calm ? 500 : 1700 + amounts.length * 420);
  };
  const seal = () => {
    buzz([8, 40, 20]); sfx.open();
    setStage(3);
    setAct('seal');
    setTimeout(() => onDone({ name: name.trim(), currency, line: line || undefined }), calm ? 500 : 2400);
  };

  return (
    <motion.div className={'ob ob-at-' + act} role="dialog" aria-label="Welcome to CashGlome" exit={{ opacity: 0, transition: { duration: 0.7 } }}>
      <div className="ob-art">
        <LivingCanvas id={ART} stage={stage} mood={NEUTRAL} night={0} strokes={strokes} flash={flash} focus={[0.5, 0.42]} onReady={setGlReady} />
        {glReady === false && <img src={`./art/${ART}.jpg`} alt="" className="ob-still" />}
        <div className="ob-veil" aria-hidden />
      </div>

      <header className="ob-top">
        <span className="ob-brand">CashGlome</span>
        <span className="ob-label"><i>{PAINTINGS[ART].title}</i><span>{PAINTINGS[ART].artist}, {PAINTINGS[ART].year}</span></span>
        {snd.available && act !== 'cover' && (
          <button className="ob-sound" onClick={() => setSound(!snd.playing)} aria-pressed={snd.playing} title="Vivaldi, Winter. John Harrison and the Wichita State University Chamber Players, CC BY-SA 4.0">
            <span className={'ob-bars' + (snd.playing ? ' on' : '')} aria-hidden><i /><i /><i /></span>{snd.playing ? 'Sound on' : 'Sound off'}
          </button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {act === 'cover' && <Cover key="cover" currency={currency} calm={calm} land={land} setStage={setStage} onBegin={begin} onReturning={() => { setReturning(true); playOverture(); setAct('name'); }} />}
        {act === 'line' && <FirstLine key="line" currency={currency} setCurrency={setCurrency} onKept={kept}
          onSkip={() => setAct('name')} onSample={() => onDone({ name: '', currency, sample: true })} />}
        {act === 'name' && (
          <motion.section key="name" className="ob-act ob-name-act" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16, transition: { duration: 0.35 } }} transition={{ duration: 0.7, ease }}>
            {line && <p className="ob-kept"><Chalk kind="tick" calm={calm} style={{ position: 'relative', display: 'inline-block', width: 22, height: 18, marginRight: 8, verticalAlign: '-3px' }} />Kept. Your first line is in the book.</p>}
            <h1 className="ob-h">Who keeps <em>this book</em>?</h1>
            <form className="ob-slip" onSubmit={(e) => { e.preventDefault(); seal(); }}>
              <input ref={(el) => { if (el && !el.dataset.f) { el.dataset.f = '1'; setTimeout(() => el.focus(), 500); } }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" aria-label="Your first name" autoComplete="given-name" maxLength={40} enterKeyHint="go" />
              <button type="submit" className="stamp sm ob-slip-go">{name.trim() ? 'Open my book' : 'Skip'}<Icon.right size={14} /></button>
            </form>
            <p className="ob-fine">Only for the greeting. It stays on this device, like every line you write.</p>
            {returning && cloudConfigured && <div className="ob-acct"><p>Sign in and your book comes back to this device.</p><Account compact /></div>}
          </motion.section>
        )}
        {act === 'seal' && (
          <motion.section key="seal" className="ob-act ob-seal-act" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="ob-seal" initial={calm ? false : { scale: 2.6, opacity: 0, rotate: -24 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.1 }}>
              <span>I</span>
            </motion.div>
            <motion.h1 className="ob-h" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }}>
              Chapter <em>one</em> begins{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}.
            </motion.h1>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The cover: the headline, and a line that writes itself into the painting. */
function Cover({ currency, calm, land, setStage, onBegin, onReturning }: { currency: string; calm?: boolean; land: (id: string, amount: number, spot?: [number, number]) => void; setStage: (n: number) => void; onBegin: () => void; onReturning: () => void }) {
  const demo = useMemo(() => examplesFor(currency)[0], [currency]);
  const parts = useMemo(() => parseStory(demo, { home: currency }), [demo, currency]);
  const [typed, setTyped] = useState(calm ? demo.length : 0);
  const landed = useRef(0);
  useEffect(() => {
    if (calm) { parts.forEach((p, i) => land('demo' + i, p.amount, DEMO_SPOTS[i % 3])); setStage(3); return; }
    let i = 0, t = 0;
    // A beat on the chalk drawing before the pen moves.
    const wait = setTimeout(() => {
      t = window.setInterval(() => {
        i++; setTyped(i);
        // Each piece of the line lands as colour when it's finished: at its comma, or at the end.
        const finished = demo.slice(0, i).split(',').length - (i < demo.length ? 1 : 0);
        while (landed.current < Math.min(finished, parts.length)) { const k = landed.current++; land('demo' + k, parts[k].amount, DEMO_SPOTS[k % 3]); }
        if (i >= demo.length) { clearInterval(t); setTimeout(() => setStage(3), 600); }
      }, 72);
    }, 1300);
    return () => { clearTimeout(wait); clearInterval(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const done = typed >= demo.length;
  const shown = parts.slice(0, Math.max(0, demo.slice(0, typed).split(',').length - (done ? 0 : 1)));
  return (
    <motion.section className="ob-act ob-cover" exit={{ opacity: 0, y: -20, transition: { duration: 0.45, ease } }}>
      <motion.div className="ob-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Write <i>·</i> See <i>·</i> Ask</motion.div>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease, delay: 0.1 }}>
        Your money, <em>painted</em>.
      </motion.h1>
      <motion.div className="ob-slip demo" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }} aria-hidden>
        <Medallion code={currency} size={28} />
        <span className="ob-typed">{typed ? demo.slice(0, typed) : <span className="ph">What did today cost?</span>}<i className={done ? 'off' : ''} /></span>
      </motion.div>
      <div className="ob-reads" aria-hidden>
        {shown.map((p, i) => (
          <motion.span key={i} className={'ob-read' + (p.dir === 'in' ? ' in' : '')} initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
            <i style={{ background: cat(p.category).color }} />{p.label}<b className="num">{p.dir === 'in' ? '+' : '−'}{money(p.amount, currency)}</b>
          </motion.span>
        ))}
      </div>
      <motion.div className="ob-cover-foot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: done ? 1 : 0, y: done ? 0 : 10 }} transition={{ duration: 0.7, ease }}>
        <p className="ob-lede">Type it, say it, or snap the receipt. The sums stay on your phone, and every line brushes colour into a masterpiece.</p>
        <div className="ob-cover-acts">
          <button className="stamp ob-begin" onClick={onBegin} disabled={!done}>Write my first line <Icon.right size={16} /></button>
          {cloudConfigured && <button className="ob-quiet" onClick={onReturning} disabled={!done}>I already have a book</button>}
        </div>
      </motion.div>
      <ul className="ob-promise" aria-label="Promises">
        <li>No sign-up</li><li>Works offline</li><li>No bank login</li><li>No ads</li>
      </ul>
    </motion.section>
  );
}

/** Their own line, on the same sheet. Read as they type; it lands as strokes when kept. */
function FirstLine({ currency, setCurrency, onKept, onSkip, onSample }: { currency: string; setCurrency: (c: string) => void; onKept: (text: string, amounts: number[]) => void; onSkip: () => void; onSample: () => void }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [voice, setVoice] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState(false);
  const session = useRef<Listening | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
  const read = useMemo(() => parseStory(text, { home: currency }), [text, currency]);
  const examples = useMemo(() => examplesFor(currency), [currency]);
  // A line that names its money ("$20", "4,000 naira") says which currency they count in.
  useEffect(() => {
    const named = read.find((p) => p.currency && p.currency !== currency)?.currency;
    if (named && read.every((p) => !p.currency || p.currency === named)) setCurrency(named);
  }, [read, currency, setCurrency]);

  const send = () => {
    if (sent) return;
    if (!read.length) { setNote(text.trim() ? 'Add an amount, like “lunch 2,500” or “got paid 350k”.' : 'Write one thing, or tap a line below.'); buzz(30); input.current?.focus(); return; }
    session.current?.stop();
    setSent(true);
    onKept(text.trim(), read.map((p) => p.amount));
  };
  const speak = () => {
    if (voice) { session.current?.stop(); return; }
    setNote(''); setVoice(true);
    session.current = listen({ onText: (t) => setText(t), onError: (m) => setNote(m), onEnd: () => { setVoice(false); session.current = null; } });
  };

  return (
    <motion.section className="ob-act ob-line-act" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16, transition: { duration: 0.35 } }} transition={{ duration: 0.7, ease }}>
      <h1 className="ob-h">Now <em>you</em>. What did today cost?</h1>
      <p className="ob-lede">Write it the way you’d say it. One line can hold a few things.</p>
      <div className="ob-slip-wrap">
        <form className={'ob-slip' + (sent ? ' sent' : '') + (voice ? ' rec' : '')} onSubmit={(e) => { e.preventDefault(); send(); }}>
          <button type="button" className="ob-coin" onClick={() => setPicking((p) => !p)} aria-label={`Counting in ${currency}. Change the currency`} aria-expanded={picking}>
            <Medallion code={currency} size={30} />
          </button>
          <input ref={(el) => { input.current = el; if (el && !el.dataset.f) { el.dataset.f = '1'; setTimeout(() => el.focus(), 500); } }} value={text}
            onChange={(e) => { setText(e.target.value); setNote(''); }} placeholder={examples[0].split(', ').slice(0, 2).join(', ')} aria-label="What did today cost?" enterKeyHint="send" disabled={sent} />
          {canSpeak && <button type="button" className={'ob-mic' + (voice ? ' on' : '')} onClick={speak} aria-label={voice ? 'Stop listening' : 'Say it instead'}><Icon.mic size={18} /></button>}
          <button type="submit" className="wax ob-send" aria-label="Keep this line" disabled={sent}><Icon.up size={18} /></button>
        </form>
        <AnimatePresence>
          {picking && (
            <motion.div className="ob-picker cpick" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <CurrencyList value={currency} onPick={(c) => { setCurrency(c); setPicking(false); input.current?.focus(); }} onClose={() => setPicking(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="ob-reads" aria-live="polite">
        {read.length > 0 ? read.slice(0, 5).map((p, i) => (
          <motion.span key={i + p.label} className={'ob-read' + (p.dir === 'in' ? ' in' : '')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <i style={{ background: cat(p.category).color }} />{p.label}<b className="num">{p.dir === 'in' ? '+' : '−'}{money(p.amount, p.currency ?? currency)}</b>
          </motion.span>
        )) : note ? <span className="ob-note">{note}</span> : (
          <div className="ob-examples" role="group" aria-label="Try one">
            {examples.map((x) => <button key={x} type="button" onClick={() => { setText(x); input.current?.focus(); }}>{x}</button>)}
          </div>
        )}
      </div>
      <div className="ob-acts">
        <button type="button" className="ob-quiet" onClick={onSkip}>Skip for now</button>
        <span aria-hidden>·</span>
        <button type="button" className="ob-quiet" onClick={onSample}>Look around an example month</button>
      </div>
    </motion.section>
  );
}
