import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { CATEGORIES, cat } from '../lib/categories';
import { money, todayISO } from '../lib/format';
import { parseOne, splitStory } from '../lib/parser';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import type { Parsed } from '../lib/types';
import { Icon } from './Icons';

export interface ComposerHandle { focus: () => void; fill: (t: string) => void; speak: () => void }
export interface Notice { text: ReactNode; undo?: () => void; art?: string }
interface Props {
  currency: string;
  aiOn: boolean;
  busy: boolean;
  notice: Notice | null;
  onSubmit: (text: string, overrides: Record<number, Partial<Parsed>>) => void;
  onCamera: (file?: Blob) => void;
}

const HINTS_NG = ['Spent 4,500 on suya', 'Got paid 350k', 'Bolt 6k, data 3k', 'Sent mum 20k'];
const HINTS = ['Lunch 14', 'Got paid 3,200', 'Uber 18, coffee 6.50', 'Netflix 15.49'];
const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ currency, aiOn, busy, notice, onSubmit, onCamera }, ref) {
  const [text, setText] = useState('');
  const [over, setOver] = useState<Record<number, Partial<Parsed>>>({});
  const [menu, setMenu] = useState<number | null>(null);
  const [voice, setVoice] = useState<'off' | 'starting' | 'on'>('off');
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const session = useRef<Listening | null>(null);
  const hints = currency === 'NGN' ? HINTS_NG : HINTS;
  const [hint, setHint] = useState(0);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
  useEffect(() => { const t = setInterval(() => setHint((h) => (h + 1) % hints.length), 4200); return () => clearInterval(t); }, [hints.length]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 6000); return () => clearTimeout(t); }, [note]);
  useEffect(() => () => session.current?.stop(), []);

  const speak = () => {
    if (voice !== 'off') { session.current?.stop(); return; }
    const before = text.trim();
    setNote(null); setVoice('starting'); setLevel(0);
    session.current = listen({
      onReady: () => setVoice('on'),
      onText: (t) => { setVoice('on'); setText(before ? `${before}, ${t}` : t); },
      onLevel: setLevel,
      onError: (m) => setNote(m),
      onEnd: () => { setVoice('off'); setLevel(0); session.current = null; if (!touch) setTimeout(() => ta.current?.focus(), 0); },
    });
  };

  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus(), fill: (t) => { setText(t); setTimeout(() => ta.current?.focus(), 0); }, speak }));
  useEffect(() => { setOver({}); setMenu(null); }, [text]);
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; }, [text]);

  const items = useMemo(() => splitStory(text).map(parseOne).filter((p): p is Parsed => !!p).map((p, i) => ({ ...p, ...over[i] })), [text, over]);
  const submit = () => { if (!text.trim() || busy) return; session.current?.stop(); onSubmit(text.trim(), over); setText(''); };
  const camera = () => (touch ? fileIn.current?.click() : onCamera());
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const listening = voice !== 'off';
  const placeholder = busy ? (aiOn ? 'Muse is reading…' : 'Reading…') : voice === 'starting' ? 'Getting ready…' : voice === 'on' ? 'Listening…' : narrow ? hints[hint] : `What came in or went out? ${hints[hint]}`;
  const shown = note ? { text: note } : notice;

  return (
    <div className="composer-wrap">
      <AnimatePresence mode="popLayout">
        {shown && !text && !listening && (
          <motion.div key={note ? 'note' : 'n'} className="notice glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
            {'art' in shown && shown.art && <img src={shown.art} alt="" className="notice-art" />}
            <span>{shown.text}</span>
            {'undo' in shown && shown.undo && <button className="notice-undo" onClick={shown.undo}>Undo</button>}
          </motion.div>
        )}
        {items.length > 0 && (
          <motion.div key="p" className="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            {items.slice(0, 5).map((p, i) => {
              const c = cat(p.category);
              return (
                <motion.div layout key={i} className="pchip glass" style={{ position: 'relative' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <span className="dotc" style={{ background: c.color }} />
                  <button title="Switch between money in and money out" onClick={() => setOver({ ...over, [i]: { ...over[i], dir: p.dir === 'in' ? 'out' : 'in', category: p.dir === 'in' ? 'other' : 'windfall' } })}>
                    <b style={{ color: p.dir === 'in' ? 'var(--green)' : 'var(--ink)' }}>{p.dir === 'in' ? '+' : '−'}{money(p.amount, currency)}</b>
                  </button>
                  <button onClick={() => setMenu(menu === i ? null : i)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--ink-2)' }}>{c.short}<Icon.chevronDown size={11} /></button>
                  {p.date !== todayISO() && <span className="small">{new Date(p.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span>}
                  {menu === i && (
                    <div className="menu popover" onMouseLeave={() => setMenu(null)}>
                      {CATEGORIES.filter((x) => x.dir === p.dir).map((x) => (
                        <button key={x.id} className={x.id === p.category ? 'on' : ''} onClick={() => { setOver({ ...over, [i]: { ...over[i], category: x.id } }); setMenu(null); }}>
                          <span style={{ width: 10, height: 10, borderRadius: 5, background: x.color, display: 'inline-block' }} />{x.name}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <div className={'composer glass' + (listening ? ' listening' : '')}>
        <button className="cmp-icon" onClick={camera} aria-label="Add a photo or receipt" title="Photo or receipt"><Icon.camera size={18} /></button>
        <textarea
          ref={ta}
          className="cmp-input"
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label="Write what came in or went out"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); onCamera(f); } }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { session.current?.stop(); setText(''); ta.current?.blur(); } }}
        />
        {listening && <Waves level={level} on={voice === 'on'} />}
        {canSpeak && (
          <button className={'cmp-icon mic' + (listening ? ' rec' : '')} onClick={speak} aria-label={listening ? 'Stop listening' : 'Say it'} title={listening ? 'Stop' : 'Say it'}>
            {listening ? <Icon.stop size={16} /> : <Icon.mic size={18} />}
          </button>
        )}
        <button className="send" disabled={!text.trim() || busy} onClick={submit} aria-label="Add">
          {busy ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ width: 15, height: 15, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: 8, display: 'block' }} /> : <Icon.up size={17} />}
        </button>
      </div>
      <input ref={fileIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCamera(f); }} />
    </div>
  );
});

/** Five bars that follow the voice, like the dictation glyph on a Mac. */
function Waves({ level, on }: { level: number; on: boolean }) {
  const shape = [0.45, 0.8, 1, 0.75, 0.5];
  return (
    <span className="waves" aria-hidden>
      {shape.map((k, i) => (
        <motion.i key={i} animate={{ scaleY: on ? 0.18 + Math.min(1, level * 1.4) * k * (0.75 + ((i * 37) % 10) / 40) : 0.18 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} />
      ))}
    </span>
  );
}
