// First run on a phone: no name, no form. A painting under varnish and one line to write.
// The first thing written starts the diary and cleans the first patch.
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { computeStats } from '../lib/analytics';
import { paintingOf, restorationOf } from '../lib/art';
import { cat } from '../lib/categories';
import { CURRENCIES, currencySymbol, money, monthOf, todayISO } from '../lib/format';
import { parseStory } from '../lib/parser';
import { cloudConfigured } from '../lib/cloud';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import type { Parsed } from '../lib/types';
import { Account } from '../components/Account';
import { Icon } from '../components/Icons';
import { RestorationPlate } from '../components/Restoration';
import { haptic } from './device';

const EXAMPLES: Record<string, string[]> = {
  NGN: ['Lunch 2,500', 'Bolt 3k', 'Data 1k', 'Got paid 350k'],
  KES: ['Lunch 450', 'Matatu 100', 'Airtime 200', 'Got paid 80k'],
  GHS: ['Lunch 45', 'Trotro 8', 'Data 20', 'Got paid 4k'],
  ZAR: ['Lunch 95', 'Taxi 22', 'Airtime 50', 'Got paid 18k'],
  INR: ['Lunch 220', 'Auto 80', 'Recharge 299', 'Got paid 60k'],
};
const DEFAULT_EXAMPLES = ['Lunch 14', 'Coffee 4.50', 'Bus 2.80', 'Got paid 3,200'];
const NAMES: Record<string, string> = { NGN: 'naira', USD: 'dollars', EUR: 'euros', GBP: 'pounds', CAD: 'Canadian dollars', AUD: 'Australian dollars', KES: 'Kenyan shillings', GHS: 'cedis', ZAR: 'rand', INR: 'rupees', JPY: 'yen', BRL: 'reais', MXN: 'pesos', AED: 'dirhams', EGP: 'Egyptian pounds', CNY: 'yuan', KRW: 'won', XOF: 'CFA francs', TZS: 'Tanzanian shillings', SAR: 'riyals' };

export function PhoneWelcome({ initialCurrency, onStart, onSample }: {
  initialCurrency: string;
  /** The first line was written: start the diary with it. */
  onStart: (currency: string, first: Parsed[]) => void;
  onSample: (currency: string) => void;
}) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const [returning, setReturning] = useState(false);
  const [voice, setVoice] = useState(false);
  const [note, setNote] = useState('');
  const session = useRef<Listening | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
  // The same painting the first chapter opens on, still fully under varnish.
  const month = monthOf(todayISO());
  const painting = useMemo(() => paintingOf(computeStats([], month)), [month]);
  const r = useMemo(() => ({ ...restorationOf([], month), restored: 0 }), [month]);
  const items = useMemo(() => parseStory(text, { home: currency }), [text, currency]);
  const examples = EXAMPLES[currency] ?? DEFAULT_EXAMPLES;

  const send = (t = text) => {
    const first = parseStory(t, { home: currency });
    if (!first.length) { setNote(t.trim() ? 'Add an amount, like “Lunch 2,500”.' : ''); input.current?.focus(); return; }
    session.current?.stop();
    haptic('lift');
    onStart(currency, first);
  };
  const speak = () => {
    if (voice) { session.current?.stop(); return; }
    setNote(''); setVoice(true);
    session.current = listen({ onText: (t) => setText(t), onError: (m) => setNote(m), onEnd: () => { setVoice(false); session.current = null; } });
  };

  return (
    <div className="ph-app ph-welcome">
      <div className="ph-welcome-art">
        <RestorationPlate painting={painting} r={r} seen={0} ratio={1} drift={false} />
        <span className="ph-welcome-caption"><i>{painting.title}</i>{painting.artist}, {painting.year}. Under old varnish</span>
      </div>

      <div className="ph-welcome-body">
        <h1 className="ph-title">Your money, <em>painted</em>.</h1>
        <p className="ph-welcome-lede">Write one thing you spent today. It cleans the first patch of this painting.</p>

        <div className="ph-chips" role="group" aria-label="Examples">
          {examples.map((x) => <button key={x} className="ph-chip" onClick={() => { haptic(); setText(x); setNote(''); input.current?.focus(); }}>{x}</button>)}
        </div>

        <div className="ph-chips parsed" aria-live="polite">
          {items.slice(0, 3).map((p, i) => (
            <motion.span key={i} className={'ph-read' + (p.dir === 'in' ? ' in' : '')} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}><i style={{ background: cat(p.category).color }} />{p.dir === 'in' ? '+' : '−'}{money(p.amount, currency)} <small>{cat(p.category).short}</small></motion.span>
          ))}
        </div>

        <form className={'ph-first' + (voice ? ' listening' : '')} onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input ref={input} value={text} onChange={(e) => { setText(e.target.value); setNote(''); }} placeholder={voice ? 'Listening…' : `What did today cost? ${examples[0]}`} aria-label="What did today cost?" enterKeyHint="send" autoComplete="off" autoCapitalize="sentences" />
          {canSpeak && <button type="button" className={'ph-icon' + (voice ? ' rec' : '')} onClick={speak} aria-label={voice ? 'Stop listening' : 'Say it'}>{voice ? <Icon.stop size={16} /> : <Icon.mic size={19} />}</button>}
          <button className="ph-send" disabled={!items.length} aria-label="Write it"><Icon.up size={18} /></button>
        </form>
        <p className="ph-welcome-note" role="status">{note || <>Counting in {NAMES[currency] ?? currency} <b>{currencySymbol(currency)}</b>. <button className="ph-link" onClick={() => setPicking(true)}>Change</button></>}</p>

        <div className="ph-welcome-foot">
          <span>Stays on this phone. No account, no bank login.</span>
          <button className="ph-link" onClick={() => onSample(currency)}>Look around an example month</button>
          {cloudConfigured && !returning && <button className="ph-link" onClick={() => setReturning(true)}>I already have an account</button>}
        </div>
        {cloudConfigured && returning && <div className="welcome-acct"><Account compact /></div>}
      </div>

      <AnimatePresence>
        {picking && (
          <motion.div className="ph-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicking(false)}>
            <motion.div className="ph-sheet" role="dialog" aria-label="Choose your money" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()}>
              <div className="ph-grab" aria-hidden />
              <div className="ph-sheet-title">What do you count in?</div>
              <div className="ph-money-list">
                {CURRENCIES.map((c) => (
                  <button key={c.code} className={'ph-row' + (c.code === currency ? ' on' : '')} onClick={() => { setCurrency(c.code); setPicking(false); haptic(); }}>
                    <span className="ph-row-icon num">{currencySymbol(c.code)}</span>
                    <span className="ph-row-text"><b>{c.name}</b></span>
                    {c.code === currency && <Icon.check size={16} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
