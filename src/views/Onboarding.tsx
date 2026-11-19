// First run, in three moments: the cover, your name, and your first line.
// No account and no form beyond a name. The first line is written here, cleans the first patch of the
// month's painting while you watch, and you arrive on Today with it already in your book.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { computeStats } from '../lib/analytics';
import { paintingOf, PAINTINGS, restorationOf } from '../lib/art';
import { cat } from '../lib/categories';
import { money, monthOf, todayISO } from '../lib/format';
import { parseStory } from '../lib/parser';
import { cloudConfigured } from '../lib/cloud';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import { onOverture, overtureState, playOverture, prepareOverture, setSound } from '../lib/overture';
import { sfx } from '../lib/sound';
import type { Entry } from '../lib/types';
import { examplesFor } from '../stage/words';
import { Account } from '../components/Account';
import { CurrencyPicker } from '../components/CurrencyPicker';
import { Icon } from '../components/Icons';
import { LivingArt } from '../components/LivingArt';
import { RestorationPlate } from '../components/Restoration';
import './onboarding.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
type Step = 'cover' | 'name' | 'line';

interface Props {
  initialCurrency: string;
  calm?: boolean;
  /** Finished: start the book with this name and currency, and write the first line if there is one. */
  onDone: (p: { name: string; currency: string; line?: string; sample?: boolean }) => void;
}

export function Onboarding({ initialCurrency, calm, onDone }: Props) {
  const [step, setStep] = useState<Step>('cover');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(initialCurrency);
  const [returning, setReturning] = useState(false);
  const sound = useSyncExternalStore(onOverture, () => JSON.stringify(overtureState()));
  const snd = JSON.parse(sound) as ReturnType<typeof overtureState>;
  useEffect(() => { prepareOverture(); }, []);

  const art = step === 'cover' ? 'moneylender' : 'goldsmith';
  const begin = () => { playOverture(); sfx.open(); setStep('name'); };
  const finish = (p: { line?: string; sample?: boolean } = {}) => onDone({ name: name.trim(), currency, ...p });

  return (
    <motion.div className={'ob ob-at-' + step} role="dialog" aria-label="Welcome to CashGlome" exit={{ opacity: 0, transition: { duration: 0.6 } }}>
      <AnimatePresence initial={false}>
        <motion.div key={art} className="ob-art" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease }}>
          <LivingArt id={art} sizes="100vw" dust={!calm} light={!calm} parallax={!calm} drift={!calm} calm={calm} style={{ position: 'absolute', inset: 0 }}
            shade={step === 'cover'
              ? 'linear-gradient(0deg, rgba(14,10,6,.94) 0%, rgba(14,10,6,.6) 36%, rgba(14,10,6,.08) 68%), linear-gradient(rgba(14,10,6,.55), transparent 22%)'
              : 'linear-gradient(rgba(14,10,6,.55), rgba(14,10,6,.72))'} />
        </motion.div>
      </AnimatePresence>

      <header className="ob-top">
        <span className="ob-brand"><span className="ob-mark" aria-hidden />CashGlome</span>
        <span className="ob-label"><i>{PAINTINGS[art].title}</i><span>{PAINTINGS[art].artist}, {PAINTINGS[art].year}</span></span>
        {snd.available && step !== 'cover' && (
          <button className="ob-sound" onClick={() => setSound(!snd.playing)} aria-pressed={snd.playing}>
            <span className={'ob-bars' + (snd.playing ? ' on' : '')} aria-hidden><i /><i /><i /></span>{snd.playing ? 'Sound on' : 'Sound off'}
          </button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {step === 'cover' && (
          <motion.section key="cover" className="ob-cover" exit={{ opacity: 0, y: -24, transition: { duration: 0.5, ease } }}>
            <motion.h1 initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.15 }}>
              Your money<br />has a <em>story</em>.
            </motion.h1>
            <motion.div className="ob-cover-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }}>
              <p>Type it, say it, or snap the receipt. CashGlome keeps the sums on your phone, and every line cleans a patch of a masterpiece.</p>
              <div className="ob-cover-acts">
                <button className="ob-begin" onClick={begin} autoFocus>Begin <Icon.right size={15} /></button>
                {cloudConfigured && <button className="ob-quiet" onClick={() => { setReturning(true); setStep('name'); }}>I already have a book</button>}
              </div>
            </motion.div>
          </motion.section>
        )}

        {step === 'name' && (
          <Card key="name" n={1}>
            <h1 className="ob-h">What should we <em>call you</em>?</h1>
            <form onSubmit={(e) => { e.preventDefault(); setStep('line'); }}>
              <label className="ob-field">
                <span className="sr">Your first name</span>
                <input ref={(el) => { if (el && !el.dataset.f) { el.dataset.f = '1'; setTimeout(() => el.focus(), 450); } }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" maxLength={40} enterKeyHint="next" />
                <span className="ob-line" aria-hidden />
              </label>
              <div className="ob-row">
                <div className="ob-count"><span>You count in</span><CurrencyPicker value={currency} onChange={setCurrency} dark /></div>
              </div>
              <div className="ob-acts">
                <button type="button" className="ob-quiet" onClick={() => setStep('cover')}>Back</button>
                <button type="submit" className="ob-go">{name.trim() ? `Continue as ${name.trim().split(' ')[0]}` : 'Continue'} <Icon.right size={14} /></button>
              </div>
            </form>
            {returning && cloudConfigured && <div className="ob-acct"><p>Sign in and your book comes back to this device.</p><Account compact /></div>}
          </Card>
        )}

        {step === 'line' && <FirstLine key="line" name={name.trim()} currency={currency} calm={calm} onBack={() => setStep('name')} onDone={finish} />}
      </AnimatePresence>
    </motion.div>
  );
}

function Card({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <motion.section className="ob-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <motion.div className="ob-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.55, ease }}>
        <div className="ob-steps" aria-label={`Step ${n} of 2`}>{[1, 2].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</div>
        {children}
      </motion.div>
    </motion.section>
  );
}

/** The first line: written here, read as you type, and it lifts the first patch before you leave. */
function FirstLine({ name, currency, calm, onBack, onDone }: { name: string; currency: string; calm?: boolean; onBack: () => void; onDone: (p: { line?: string; sample?: boolean }) => void }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [lifting, setLifting] = useState(false);
  const [voice, setVoice] = useState(false);
  const session = useRef<Listening | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
  const month = monthOf(todayISO());
  const painting = useMemo(() => paintingOf(computeStats([], month)), [month]);
  const read = useMemo(() => parseStory(text, { home: currency }), [text, currency]);
  // What the painting would look like with this line in it, so the patch lifts here, on this screen.
  const asEntries = useMemo(() => read.map((p, i) => ({ ...p, id: 'ob' + i, date: p.date || todayISO(), createdAt: Date.now(), currency } as unknown as Entry)), [read, currency]);
  const base = useMemo(() => restorationOf([], month).restored, [month]);
  const r = useMemo(() => restorationOf(lifting ? asEntries : [], month), [lifting, asEntries, month]);
  const examples = useMemo(() => examplesFor(currency), [currency]);

  const send = () => {
    if (lifting) return;
    if (!read.length) { setNote(text.trim() ? 'Add an amount, like “lunch 2,500” or “got paid 350k”.' : 'Write one thing, or tap an example.'); input.current?.focus(); return; }
    session.current?.stop();
    setLifting(true);
    sfx.restore();
    setTimeout(() => onDone({ line: text.trim() }), calm ? 600 : 2600);
  };
  const speak = () => {
    if (voice) { session.current?.stop(); return; }
    setNote(''); setVoice(true);
    session.current = listen({ onText: (t) => setText(t), onError: (m) => setNote(m), onEnd: () => { setVoice(false); session.current = null; } });
  };

  return (
    <Card n={2}>
      <div className="ob-first">
        <div className="ob-first-main">
          <h1 className="ob-h">{name ? <>{name}, what did today <em>cost</em>?</> : <>What did today <em>cost</em>?</>}</h1>
          <p className="ob-lede">Write it the way you’d say it. One line can hold a few things.</p>
          <form className={'ob-write' + (lifting ? ' sent' : '')} onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input ref={(el) => { input.current = el; if (el && !el.dataset.f) { el.dataset.f = '1'; setTimeout(() => el.focus(), 450); } }} value={text} onChange={(e) => { setText(e.target.value); setNote(''); }} placeholder={examples[0].split(", ").slice(0, 2).join(", ")} aria-label="What did today cost?" enterKeyHint="send" disabled={lifting} />
            {canSpeak && <button type="button" className={'ob-mic' + (voice ? ' on' : '')} onClick={speak} aria-label={voice ? 'Stop listening' : 'Say it instead'}><Icon.mic size={17} /></button>}
            <button type="submit" className="ob-send" aria-label="Write it" disabled={lifting}><Icon.up size={17} /></button>
          </form>
          <div className="ob-read" aria-live="polite">
            {read.length > 0 ? read.slice(0, 4).map((p, i) => (
              <motion.span key={i + p.label} className={'ob-chip-read' + (p.dir === 'in' ? ' in' : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <i style={{ background: cat(p.category).color }} />{p.label}<b className="num">{p.dir === 'in' ? '+' : '−'}{money(p.amount, currency)}</b>
              </motion.span>
            )) : note ? <span className="ob-note">{note}</span> : (
              <div className="ob-examples" role="group" aria-label="Try one">
                {examples.map((x) => <button key={x} type="button" onClick={() => { setText(x); input.current?.focus(); }}>{x}</button>)}
              </div>
            )}
          </div>
          <div className="ob-acts">
            <button type="button" className="ob-quiet" onClick={onBack}>Back</button>
            <span className="ob-or">
              <button type="button" className="ob-quiet" onClick={() => onDone({})}>Skip for now</button>
              <span aria-hidden>·</span>
              <button type="button" className="ob-quiet" onClick={() => onDone({ sample: true })}>Look around an example month</button>
            </span>
          </div>
        </div>
        <figure className={'ob-plate' + (lifting ? ' lifting' : '')}>
          <RestorationPlate painting={painting} r={r} seen={base} ratio={4 / 5} drift={false} calm={calm} lead={0.1} />
          <figcaption>
            <i>{painting.title}</i>
            <span>{lifting ? (name ? `The varnish lifts. Welcome, ${name}.` : 'The varnish lifts. Welcome.') : 'Under old varnish. Your line cleans the first patch.'}</span>
          </figcaption>
        </figure>
      </div>
    </Card>
  );
}
