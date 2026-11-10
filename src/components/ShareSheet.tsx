import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Seg } from '../lib/analytics';
import { drawCard, FORMATS, SHARE_HOST, shareText, toBlob, type CardFormat } from '../lib/sharecard';
import type { State } from '../lib/types';
import { Icon } from './Icons';

/** Shows the month as an exhibition card and hands it to the system share sheet. Amounts stay off unless asked for. */
export function ShareSheet({ state, title, onClose }: { state: State; title?: Seg[]; onClose: () => void }) {
  const [format, setFormat] = useState<CardFormat>(() => (matchMedia('(max-width: 760px)').matches ? 'story' : 'post'));
  const [amounts, setAmounts] = useState(false);
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    setFailed(false);
    drawCard({ state, title, amounts, format }).then(toBlob).then((blob) => {
      if (!live) return;
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setCard({ url, blob });
    }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [state, title, amounts, format]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  useEffect(() => {
    // Captured first, so Escape closes only this sheet and not the Edition underneath.
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);

  const fileName = `CashGlome ${state.month} ${FORMATS[format].label}.png`;
  const file = () => new File([card!.blob], fileName, { type: 'image/png' });
  const canShareFiles = typeof navigator.canShare === 'function' && !!card && navigator.canShare({ files: [file()] });
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2600); };

  const save = () => {
    if (!card) return;
    const a = Object.assign(document.createElement('a'), { href: card.url, download: fileName });
    document.body.appendChild(a); a.click(); a.remove();
    flash('Saved to your downloads.');
  };
  const share = async () => {
    if (!card) return;
    if (!canShareFiles) { save(); return; }
    try { await navigator.share({ files: [file()], text: `${shareText(state, state.month, title)} ${SHARE_HOST}` }); }
    catch (e) { if ((e as DOMException)?.name !== 'AbortError') save(); }
  };
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  const copy = async () => {
    if (!card) return;
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': card.blob })]); flash('Copied. Paste it anywhere.'); }
    catch { flash('Copying isn’t allowed here. Save the image instead.'); }
  };

  return (
    <motion.div className="scrim cap-scrim share-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="panel share" role="dialog" aria-modal aria-label="Share this chapter"
        initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <button className="panel-x" onClick={onClose} aria-label="Close"><Icon.close size={13} /></button>
        <div className={'share-preview ' + format}>
          {card ? <img src={card.url} alt="Your exhibition card" /> : <div className="share-wait">{failed ? 'The card couldn’t be drawn. Try again in a moment.' : 'Hanging the painting…'}</div>}
        </div>
        <div className="share-side">
          <div>
            <div style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold)' }}>The exhibition card</div>
            <div className="h3" style={{ marginTop: 6 }}>Show the month, not the money.</div>
            <p className="small" style={{ marginTop: 10, color: 'var(--ink-3)', lineHeight: 1.45 }}>The painting as far as you’ve restored it, your chapter’s title and a few counts. It’s drawn on this device; nothing is uploaded.</p>
          </div>
          <div className="share-row">
            <span className="label">Size</span>
            <div className="seg" role="radiogroup" aria-label="Card size">
              {(Object.keys(FORMATS) as CardFormat[]).map((f) => (
                <button key={f} role="radio" aria-checked={format === f} className={format === f ? 'on' : ''} onClick={() => setFormat(f)}>{FORMATS[f].label}</button>
              ))}
            </div>
          </div>
          <div className="small" style={{ color: 'var(--ink-3)', marginTop: -8 }}>{FORMATS[format].hint}</div>
          <div className="share-row">
            <span><span className="label">Show amounts</span><span className="small" style={{ display: 'block', color: 'var(--ink-3)', marginTop: 3 }}>Adds what you spent and kept.</span></span>
            <button role="switch" aria-checked={amounts} aria-label="Show amounts" className={'share-switch' + (amounts ? ' on' : '')} onClick={() => setAmounts((v) => !v)}><i /></button>
          </div>
          <div className="share-actions">
            <button className="btn primary" disabled={!card} onClick={share}><Icon.share size={15} /> {canShareFiles ? 'Share' : 'Save image'}</button>
            {canShareFiles && <button className="btn" disabled={!card} onClick={save}><Icon.download size={14} /> Save</button>}
            {canCopy && <button className="btn" disabled={!card} onClick={copy}>Copy</button>}
          </div>
          <div className="small share-note" aria-live="polite">{note}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}
