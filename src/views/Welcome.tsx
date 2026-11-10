import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CURRENCIES, currencySymbol } from '../lib/format';
import { PAINTINGS } from '../lib/art';
import { Icon } from '../components/Icons';
import { AppIcon } from '../components/Logo';
import { TrafficLights } from '../components/Shell';
import { LivingArt } from '../components/LivingArt';

const ease = [0.2, 0.8, 0.2, 1] as const;
const BONE = '#F6EEDC';

/** First run: a living painting, then one question. Everything else is learned by doing. */
export function Welcome({ initialCurrency, onDone }: { initialCurrency: string; onDone: (name: string, currency: string, sample: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(initialCurrency);
  const art = step === 0 ? 'moneylender' : 'goldsmith';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, overflow: 'hidden', background: '#0E0A06', color: BONE }}>
      <AnimatePresence initial={false}>
        <motion.div key={art} style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease }}>
          <LivingArt id={art} dust light parallax style={{ position: 'absolute', inset: 0 }}
            shade={step === 0 ? 'linear-gradient(0deg, rgba(14,10,6,.92) 0%, rgba(14,10,6,.55) 38%, rgba(14,10,6,.1) 70%), linear-gradient(rgba(14,10,6,.5), transparent 20%)' : 'rgba(14,10,6,.45)'} />
        </motion.div>
      </AnimatePresence>

      <div className="drag" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 clamp(24px, 5vw, 56px)', zIndex: 2 }}>
        <span className="nodrag" style={{ marginRight: 8 }}><TrafficLights /></span>
        <AppIcon size={26} />
        <span style={{ font: '600 14px var(--ui)' }}>CashGlome</span>
        <span style={{ flex: 1 }} />
        <span style={{ font: 'italic 400 14px var(--serif)', opacity: 0.75 }}>{PAINTINGS[art].title}, {PAINTINGS[art].artist}, {PAINTINGS[art].year}</span>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="cover" exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.6, ease }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'clamp(28px, 6vw, 80px)' }}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.2 }} style={{ font: '330 clamp(60px, 10vw, 168px)/0.86 var(--serif)', letterSpacing: '-0.05em' }}>
              Your money<br />has a <em style={{ color: 'var(--gold-2)' }}>story</em>.
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, marginTop: 36, flexWrap: 'wrap' }}>
              <p style={{ font: '400 21px/1.45 var(--serif)', color: 'rgba(246,238,220,.82)', maxWidth: 460, margin: 0 }}>
                Type it, say it, or snap the receipt. See where every coin went.
              </p>
              <button className="btn lg nodrag" onClick={() => setStep(1)} style={{ background: BONE, color: '#1A140D', borderColor: 'transparent' }}>Begin <Icon.right size={14} /></button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '72px 20px 24px', overflowY: 'auto' }}>
            <motion.div className="welcome-pane" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease }}>
              <h1 className="welcome-h">What should we <em>call you</em>?</h1>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && onDone(name.trim(), currency, false)} placeholder="Your first name" className="welcome-input" aria-label="Your first name" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                <label className="popup dark">
                  <span style={{ font: '400 17px/1 var(--serif)' }}>{currencySymbol(currency)}</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Money">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                  <Icon.chevronDown size={11} />
                </label>
                <span style={{ flex: 1 }} />
                <button className="btn lg gold" disabled={!name.trim()} onClick={() => onDone(name.trim(), currency, false)}>Start <Icon.right size={14} /></button>
              </div>
              <button className="welcome-sample" onClick={() => onDone(name.trim() || 'Friend', currency, true)}>Or look around an example month first</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
