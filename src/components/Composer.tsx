import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { cat, choosable } from '../lib/categories';
import { money, todayISO } from '../lib/format';
import { parseStory } from '../lib/parser';
import { isQuestion } from '../lib/ask';
import { listen, voiceSupport, type Listening } from '../lib/speech';
import type { Entry, Parsed } from '../lib/types';
import { Icon } from './Icons';
import { readLineOnce, type LineRead } from '../stage/brain';

export interface ComposerHandle { focus: () => void; fill: (t: string) => void; speak: () => void }
export interface Notice { text: ReactNode; undo?: () => void; art?: string; /** one thing to do about it, e.g. "Yes, write it for me" */ action?: { label: string; run: () => void } }
interface Props {
  currency: string;
  aiOn: boolean;
  busy: boolean;
  notice: Notice | null;
  /** The notice has been seen: its time ran out, or it was tapped, swiped or Escaped away. */
  onNoticeDone?: () => void;
  /** basis: the chips the overrides were made on (Florin's reading, or the rules' while Florin was still reading). */
  onSubmit: (text: string, overrides: Record<number, Partial<Parsed>>, basis?: 'florin' | 'rules') => void;
  onCamera: (file?: Blob) => void;
  /** A question typed or said here is answered instead of added. */
  onAsk: (q: string) => void;
  /** Things you buy all the time, offered as one-tap repeats while the box is empty. */
  usuals?: Entry[];
  onRepeat?: (e: Entry) => void;
  /** Shown above the box: routine check-ins waiting for an answer. */
  above?: ReactNode;
  /** "Remember I spend 4k on transport every weekday" goes to Memory instead of the ledger. */
  onRemember?: (text: string) => void;
  /** Shown in the row above the box while it is empty and nothing else has something to say (one-tap chips). */
  idle?: ReactNode;
  onFocusChange?: (focused: boolean) => void;
}

const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ currency, aiOn, busy, notice, onNoticeDone, onSubmit, onCamera, onAsk, usuals = [], onRepeat, above, onRemember, idle, onFocusChange }, ref) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const [over, setOver] = useState<Record<number, Partial<Parsed>>>({});
  const [menu, setMenu] = useState<number | null>(null);
  const [voice, setVoice] = useState<'off' | 'starting' | 'on'>('off');
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const session = useRef<Listening | null>(null);
  const canSpeak = useMemo(() => voiceSupport() !== null, []);
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

  const memo = !!onRemember && /^(please\s+)?(remember|keep in mind|note that|fyi)\b/i.test(text.trim());
  const question = useMemo(() => !memo && isQuestion(text), [text, memo]);
  // Florin reads the line once you pause; its chips replace the rules' first guess. Sending reuses the same reading.
  const [florin, setFlorin] = useState<{ text: string; read: LineRead } | null>(null);
  const [reading, setReading] = useState(false);
  const wantsFlorin = aiOn && !question && !memo && /\d/.test(text) && text.trim().length >= 4;
  useEffect(() => {
    if (!wantsFlorin) { setReading(false); return; }
    const line = text.trim(); let live = true;
    setReading(true);
    const t = setTimeout(() => {
      void readLineOnce(line, currency).then((r) => { if (!live) return; setReading(false); if (r && (r.read.length || r.unmoved.length)) setFlorin({ text: line, read: r }); });
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [text, currency, wantsFlorin]);
  const mine = florin && florin.text === text.trim() ? florin.read : null;
  const items = useMemo(() => question || memo ? [] : (mine ? mine.read : parseStory(text, { home: currency })).map((p, i) => ({ ...p, ...over[i] })), [text, over, question, memo, currency, mine]);
  const unmoved = mine && !mine.read.length ? mine.unmoved[0] : null;
  const submit = () => {
    if (!text.trim() || busy) return;
    if (memo) { session.current?.stop(); onRemember!(text.trim()); setText(''); return; }
    if (question) { session.current?.stop(); onAsk(text.trim()); setText(''); return; } session.current?.stop(); onSubmit(text.trim(), over, mine ? 'florin' : 'rules'); setText(''); };
  const camera = () => (touch ? fileIn.current?.click() : onCamera());
  const listening = voice !== 'off';
  const placeholder = busy ? (aiOn ? 'Florin is reading…' : 'Reading…') : voice === 'starting' ? 'Getting ready…' : voice === 'on' ? 'Listening…' : 'What did today cost?';
  const shown = note ? { text: note } : notice;
  const visible = !!shown && !text && !listening;
  // A notice is a glance, not a wall: about 4.5 s, 6 s when it offers Undo or an action. A finger or pointer
  // resting on it holds it; tap, swipe or Escape puts it away at once.
  const [held, setHeld] = useState(false);
  const done = () => { setHeld(false); if (note) setNote(null); else onNoticeDone?.(); };
  const doneRef = useRef(done); doneRef.current = done;
  const offers = !!notice && (!!notice.undo || !!notice.action);
  useEffect(() => {
    if (!notice || note || held) return;
    const t = setTimeout(() => doneRef.current(), offers ? 6000 : 4500);
    return () => clearTimeout(t);
  }, [notice, note, held, offers]);
  useEffect(() => {
    if (!visible) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') doneRef.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [visible]);

  return (
    <div className="composer-wrap">
      {above}
      <AnimatePresence mode="popLayout">
        {shown && visible && (
          <motion.div key={note ? 'note' : 'n'} className="notice glass" role="status"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6, transition: { duration: 0.18 } }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            drag="x" dragSnapToOrigin dragElastic={0.6} onDragEnd={(_, i) => { if (Math.abs(i.offset.x) > 60 || Math.abs(i.velocity.x) > 400) done(); }}
            onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
            onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) done(); }}
            title="Tap or swipe to put away">
            {'art' in shown && shown.art && <img src={shown.art} alt="" className="notice-art" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            <span>{shown.text}</span>
            {'action' in shown && shown.action && <button className="notice-undo notice-do" onClick={shown.action.run}>{shown.action.label}</button>}
            {'undo' in shown && shown.undo && <button className="notice-undo" onClick={shown.undo}>Undo</button>}
          </motion.div>
        )}
        {focused && !text && !listening && usuals.length > 0 && onRepeat && (
          <motion.div key="u" className="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            {usuals.map((e) => (
              <button key={e.id} className="pchip glass again" onMouseDown={(ev) => ev.preventDefault()} onClick={() => onRepeat(e)} title={`Add ${e.label} again, for today`}>
                <Icon.repeat size={13} /> {e.label} <b>{money(e.amount, currency)}</b>
              </button>
            ))}
          </motion.div>
        )}
        {idle && !shown && !text && !listening && (
          <motion.div key="idle" className="preview idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>{idle}</motion.div>
        )}
        {memo && (
          <motion.div key="m" className="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            <div className="pchip glass asking"><Icon.quill size={14} /> Something to remember. Press Enter to keep it in Memory</div>
          </motion.div>
        )}
        {question && (
          <motion.div key="q" className="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            <div className="pchip glass asking"><Icon.ask size={14} /> A question. Press Enter to get the answer</div>
          </motion.div>
        )}
        {unmoved && (
          <motion.div key="un" className="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
            <div className="pchip glass asking"><Icon.quill size={14} /> No money changed hands: {money(unmoved.amount, currency)} less owed. Your balance stays as it is</div>
          </motion.div>
        )}
        {items.length > 0 && (
          <motion.div key="p" className={'preview' + (reading && !mine ? ' reading' : '')} title={mine ? 'Read by Florin' : undefined}initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
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
                      {choosable(p.dir).map((x) => (
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
          onFocus={() => { setFocused(true); onFocusChange?.(true); }}
          onBlur={() => { setFocused(false); onFocusChange?.(false); }}
          onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); onCamera(f); } }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { session.current?.stop(); setText(''); ta.current?.blur(); } }}
        />
        {listening && <Waves level={level} on={voice === 'on'} />}
        {canSpeak && (
          <button className={'cmp-icon mic' + (listening ? ' rec' : '')} onClick={speak} aria-label={listening ? 'Stop listening' : 'Say it'} title={listening ? 'Stop' : 'Say it'}>
            {listening ? <Icon.stop size={16} /> : <Icon.mic size={18} />}
          </button>
        )}
        <button className="send" disabled={!text.trim() || busy} onClick={submit} aria-label={question ? 'Ask' : 'Add'}>
          {busy ? <span className="brushing" aria-label="Reading"><i /><i /><i /></span> : <Icon.up size={17} />}
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
