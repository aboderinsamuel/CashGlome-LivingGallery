import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downscale, type Picture } from '../lib/images';
import { paintParchment, paintRenaissance } from '../lib/paint';
import { readPicture, warmReader, type Reading } from '../lib/receipt';
import { aiEnabled } from '../lib/ai';
import { parseOne } from '../lib/parser';
import { cat, choosable } from '../lib/categories';
import { dayLabel, money, todayISO, uid } from '../lib/format';
import type { Parsed, Settings } from '../lib/types';
import { sfx } from '../lib/sound';
import { Icon } from './Icons';

export interface CaptureDone { parsed: Parsed | null; picture: Picture }
interface Props {
  file: Blob | null;
  settings: Settings;
  currency: string;
  attachTo?: string; // label of an entry that gets this picture
  onDone: (r: CaptureDone) => void;
  onClose: () => void;
}
type Stage = 'camera' | 'reading' | 'review';

export function CaptureSheet({ file: initial, settings, currency, attachTo, onDone, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(initial ? 'reading' : 'camera');
  const [orig, setOrig] = useState<string | null>(null);
  const [progress, setProgress] = useState({ p: 0, stage: 'Looking' });
  const [reading, setReading] = useState<Reading | null>(null);
  const [kind, setKind] = useState<'thing' | 'receipt'>('thing');
  const [art, setArt] = useState<{ thing?: Blob; receipt?: Blob }>({});
  const [artURL, setArtURL] = useState<{ thing?: string; receipt?: string }>({});
  const [sentence, setSentence] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const small = useRef<{ blob: Blob; bitmap: ImageBitmap } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const seed = useMemo(() => Math.floor(Math.random() * 1e6), []);

  useEffect(() => { if (!attachTo && !aiEnabled(settings)) warmReader(); if (initial) start(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  useEffect(() => () => { [orig, artURL.thing, artURL.receipt].forEach((u) => u && URL.revokeObjectURL(u)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function paint(k: 'thing' | 'receipt') {
    if (art[k] || !small.current) return;
    const blob = k === 'thing' ? await paintRenaissance(small.current.bitmap, seed) : await paintParchment(small.current.bitmap, seed);
    setArt((a) => ({ ...a, [k]: blob }));
    setArtURL((a) => ({ ...a, [k]: URL.createObjectURL(blob) }));
  }

  async function start(file: Blob) {
    setStage('reading'); setErr(null);
    setOrig(URL.createObjectURL(file));
    try {
      const [ds, r] = await Promise.all([
        downscale(file),
        attachTo ? Promise.resolve<Reading>({ kind: 'thing', engine: 'device' }) : readPicture(settings, file, currency, (p, s) => setProgress({ p, stage: s })).catch(() => ({ kind: 'thing', engine: 'device' } as Reading)),
      ]);
      small.current = ds;
      setReading(r); setKind(r.kind);
      setProgress({ p: 1, stage: r.kind === 'thing' ? 'Painting it' : 'Inking the page' });
      const blob = r.kind === 'thing' ? await paintRenaissance(ds.bitmap, seed) : await paintParchment(ds.bitmap, seed);
      setArt({ [r.kind]: blob }); setArtURL({ [r.kind]: URL.createObjectURL(blob) });
      const amt = r.total ? String(r.total) : '';
      setSentence(r.kind === 'receipt' ? [r.merchant, amt].filter(Boolean).join(' ') : [r.label, amt].filter(Boolean).join(' '));
      setCategory(r.category ?? null);
      setStage('review');
      sfx.restore();
      setTimeout(() => field.current?.focus(), 900);
    } catch {
      setErr('That picture couldn’t be opened. Try another one.');
      setStage('camera');
    }
  }

  const parsed = useMemo<Parsed | null>(() => {
    const p = parseOne(sentence);
    if (!p) return null;
    const date = p.date !== todayISO() ? p.date : reading?.date ?? p.date;
    return { ...p, dir: 'out', category: category && cat(category).dir === 'out' ? category : p.dir === 'in' ? 'other' : p.category, date, source: reading?.engine === 'muse' ? 'muse' : 'oracle' };
  }, [sentence, category, reading]);

  const ready = !!small.current && !!art[kind] && (attachTo ? true : !!parsed);
  const finish = () => {
    if (!ready || !small.current) return;
    onDone({ parsed: attachTo ? null : parsed, picture: { id: uid(), kind, original: small.current.blob, painted: art[kind], createdAt: Date.now() } });
  };
  const switchKind = (k: 'thing' | 'receipt') => { setKind(k); paint(k); };

  return (
    <motion.div className="scrim cap-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')); if (f) start(f); }}>
      <motion.div className={'panel cap ' + stage} role="dialog" aria-modal aria-label="Add a photo"
        initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} layout>
        <button className="panel-x" onClick={onClose} aria-label="Close"><Icon.close size={13} /></button>
        {stage === 'camera' && <CameraStage onFile={start} error={err} />}
        {stage === 'reading' && orig && <ReadingStage src={orig} progress={progress} />}
        {stage === 'review' && orig && (
          <div className="cap-review">
            <div className="cap-art">
              <Artwork kind={kind} orig={orig} painted={artURL[kind]} box={kind === 'receipt' ? reading?.box : undefined} />
            </div>
            <div className="cap-form">
              {!attachTo && (
                <div className="seg" role="tablist">
                  <button className={kind === 'thing' ? 'on' : ''} onClick={() => switchKind('thing')}><Icon.image size={14} /> Thing</button>
                  <button className={kind === 'receipt' ? 'on' : ''} onClick={() => switchKind('receipt')}><Icon.receipt size={14} /> Receipt</button>
                </div>
              )}
              {attachTo ? (
                <div className="cap-big"><div className="cap-amt">{attachTo}</div></div>
              ) : (
                <>
                  <div className="cap-big">
                    <div className={'cap-amt num' + (parsed ? '' : ' empty')}>{parsed ? `−${money(parsed.amount, currency)}` : money(0, currency)}</div>
                    <div className="cap-meta">
                      <label className="popup">
                        <span className="dotc" style={{ background: cat(parsed?.category ?? category ?? 'other').color }} />
                        <select value={parsed?.category ?? category ?? 'other'} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                          {choosable('out').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <Icon.chevronDown size={11} />
                      </label>
                      {parsed && <span className="small">{dayLabel(parsed.date)}</span>}
                    </div>
                  </div>
                  <input
                    ref={field} className="field cap-field" value={sentence} onChange={(e) => setSentence(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') finish(); }}
                    placeholder={kind === 'receipt' ? 'Shop and total, like Shoprite 12,450' : 'What is it and how much? Sneakers 45,000'}
                    aria-label="What it is and how much"
                  />
                  {kind === 'receipt' && reading?.kind === 'receipt' && !reading.total && <div className="small" style={{ color: 'var(--rust)' }}>Couldn’t read the total. Type it in.</div>}
                </>
              )}
              <div className="cap-foot">
                <span className="small cap-privacy">
                  <Icon.check size={12} />
                  {reading?.engine === 'muse' ? 'Muse read it. The photo stays on this device.' : 'Read on this device. Nothing was uploaded.'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={onClose}>Cancel</button>
                  <button className="btn primary" disabled={!ready} onClick={finish}>{attachTo ? 'Hang it' : 'Add'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function CameraStage({ onFile, error }: { onFile: (f: Blob) => void; error: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<'asking' | 'on' | 'none'>('asking');
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null; let live = true;
    if (!navigator.mediaDevices?.getUserMedia) { setCam('none'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => { if (!live) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } setCam('on'); })
      .catch(() => setCam('none'));
    return () => { live = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  const snap = () => {
    const v = video.current; if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    setFlash(true); sfx.shutter();
    c.toBlob((b) => b && setTimeout(() => onFile(b), 180), 'image/jpeg', 0.92);
  };
  return (
    <div className="cap-camera">
      <div className={'cap-view' + (cam === 'on' ? ' live' : '')}>
        <video ref={video} playsInline muted style={{ opacity: cam === 'on' ? 1 : 0 }} />
        {cam !== 'on' && (
          <div className="cap-drop">
            <Icon.image size={34} />
            <div className="h3" style={{ fontSize: 22 }}>{cam === 'asking' ? 'Opening the camera…' : 'Drop a photo here'}</div>
            {error && <div className="small" style={{ color: 'var(--rust)' }}>{error}</div>}
          </div>
        )}
        <AnimatePresence>{flash && <motion.div className="cap-flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} onAnimationComplete={() => setFlash(false)} />}</AnimatePresence>
      </div>
      <div className="cap-controls">
        <button className="btn" onClick={() => input.current?.click()}><Icon.image size={15} /> Choose a photo</button>
        <button className="shutter" disabled={cam !== 'on'} onClick={snap} aria-label="Take the photo"><span /></button>
        <span style={{ width: 140 }} />
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

function ReadingStage({ src, progress }: { src: string; progress: { p: number; stage: string } }) {
  return (
    <div className="cap-reading">
      <div className="cap-scan">
        <img src={src} alt="" />
        <motion.div className="cap-beam" animate={{ top: ['-20%', '100%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }} />
      </div>
      <div className="cap-progress">
        <span>{progress.stage}…</span>
        <div className="bar"><motion.i animate={{ width: `${Math.max(6, progress.p * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} /></div>
      </div>
    </div>
  );
}

/** The photo becomes the painting: a brush stroke sweeps the oil paint over it, then it settles in its frame. */
function Artwork({ kind, orig, painted, box }: { kind: 'thing' | 'receipt'; orig: string; painted?: string; box?: { x: number; y: number; w: number; h: number } }) {
  return (
    <div className={'artwork ' + kind}>
      <div className="artwork-inner">
        <img src={orig} alt="" className="artwork-photo" />
        {painted && (
          <motion.img key={painted} src={painted} alt="" className="artwork-paint"
            initial={{ clipPath: 'inset(0 100% 0 0 round 2px)', filter: 'brightness(1.25)' }}
            animate={{ clipPath: 'inset(0 0% 0 0 round 2px)', filter: 'brightness(1)' }}
            transition={{ duration: 1.5, ease: [0.6, 0.05, 0.2, 1] }} />
        )}
        {painted && <motion.span className="artwork-brush" initial={{ left: '-10%', opacity: 1 }} animate={{ left: '105%', opacity: 0 }} transition={{ duration: 1.5, ease: [0.6, 0.05, 0.2, 1] }} />}
        {box && painted && (
          <motion.span className="artwork-box" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.4, type: 'spring', stiffness: 300, damping: 20 }}
            style={{ left: `${(box.x - 0.015) * 100}%`, top: `${(box.y - 0.01) * 100}%`, width: `${(box.w + 0.03) * 100}%`, height: `${(box.h + 0.02) * 100}%` }} />
        )}
      </div>
    </div>
  );
}
