// Choosing the money you count in: a coin, a name, and a search, instead of the browser's grey list.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CURRENCIES, currencySymbol, guessCurrency } from '../lib/format';
import { Icon } from './Icons';
import { Medallion } from './Mark';

/** Words people search with: the country, the city, what the money is called at home. */
const ALSO: Record<string, string> = {
  NGN: 'nigeria lagos abuja naija', USD: 'united states america usa dollar', EUR: 'europe france germany spain italy portugal netherlands ireland belgium',
  GBP: 'united kingdom britain england london sterling quid', CAD: 'canada toronto', AUD: 'australia sydney', KES: 'kenya nairobi bob',
  GHS: 'ghana accra', ZAR: 'south africa johannesburg cape town', INR: 'india delhi mumbai', JPY: 'japan tokyo 円', BRL: 'brazil sao paulo',
  MXN: 'mexico', AED: 'emirates dubai abu dhabi', EGP: 'egypt cairo', CNY: 'china renminbi rmb 元 人民币', KRW: 'korea seoul 원',
  XOF: 'senegal ivory coast cote divoire mali benin togo burkina niger cfa', TZS: 'tanzania dar es salaam', SAR: 'saudi arabia riyadh',
};

export function Coin({ code, size = 30 }: { code: string; size?: number }) {
  return <Medallion code={code} size={size} />;
}

/** A pane of glass with the coin and the name on it; it opens the list below it (a sheet on a phone). */
export function CurrencyMenu({ value, onChange, disabled, labelledBy, onOpen }: { value: string; onChange: (c: string) => void; disabled?: boolean; labelledBy?: string; onOpen?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<React.CSSProperties>({});
  const [up, setUp] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const set = (o: boolean) => {
    // The list floats on the page itself, placed by the button, so no card around the button can clip it.
    const r = btn.current?.getBoundingClientRect();
    if (o && r) {
      const flip = r.bottom + 440 > innerHeight && r.top > innerHeight - r.bottom;
      setUp(flip);
      const left = Math.max(12, Math.min(r.left, innerWidth - 392));
      setAt(flip ? { left, bottom: innerHeight - r.top + 8 } : { left, top: r.bottom + 8 });
    }
    setOpen(o); onOpen?.(o);
  };
  const cur = CURRENCIES.find((c) => c.code === value);
  return (
    <span className="cmenu">
      <button ref={btn} type="button" className={'cglass' + (open ? ' open' : '')} onClick={() => set(!open)} aria-haspopup="dialog" aria-expanded={open}
        aria-labelledby={labelledBy ? `${labelledBy} cglass-${value}` : undefined} disabled={disabled}>
        <Medallion code={value} size={26} />
        <span id={`cglass-${value}`} className="cglass-n">{cur?.name ?? value}</span>
        <span className="cglass-c">{value}</span>
        <Icon.chevronDown size={16} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className={'cmenu-pop cpick' + (up ? ' up' : '')} style={at} initial={{ opacity: 0, y: up ? 6 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: up ? 6 : -6 }}>
              <CurrencyList value={value} onPick={(c) => { onChange(c); set(false); }} onClose={() => set(false)} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

export function CurrencyList({ value, onPick, onClose }: { value: string; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const guess = useMemo(() => guessCurrency(), []);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) {
      const top = [...new Set([value, guess])];
      return [...top.map((c) => ({ c: CURRENCIES.find((x) => x.code === c)!, top: true })), ...CURRENCIES.filter((c) => !top.includes(c.code)).map((c) => ({ c, top: false }))].filter((r) => r.c);
    }
    return CURRENCIES.filter((c) => `${c.name} ${c.code} ${currencySymbol(c.code)} ${ALSO[c.code] ?? ''}`.toLowerCase().includes(t)).map((c) => ({ c, top: false }));
  }, [q, value, guess]);
  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => window.addEventListener('pointerdown', away), 0);
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', away); };
  }, [onClose]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${at}"]`)?.scrollIntoView({ block: 'nearest' }); }, [at]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[at]) onPick(rows[at].c.code); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };
  const firstOther = rows.findIndex((r) => !r.top);
  // On a phone the list is a sheet from the bottom of the screen, so it lives at the root of the page,
  // outside any blurred card (a backdrop filter would otherwise trap a fixed sheet inside it).
  const sheet = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const body = (
    <>
      <motion.div className="cpick-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden />
      <motion.div ref={box} className="cpick-panel" role="dialog" aria-label="Choose your currency"
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
        <div className="cpick-grab" aria-hidden />
        <div className="cpick-search">
          <Icon.search size={15} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Search a currency or country" aria-label="Search currencies"
            role="combobox" aria-expanded aria-controls="cpick-list" aria-activedescendant={rows[at] ? `cpick-${rows[at].c.code}` : undefined} />
          <button type="button" className="cpick-done" onClick={onClose}>Done</button>
        </div>
        <ul ref={list} id="cpick-list" className="cpick-list" role="listbox" aria-label="Currencies">
          {rows.length === 0 && <li className="cpick-empty">No currency called “{q}” yet. Try its country.</li>}
          {rows.map((r, i) => (
            <li key={r.c.code} role="presentation">
              {i === 0 && r.top && <div className="cpick-sec">Suggested for you</div>}
              {i === firstOther && firstOther > 0 && !q && <div className="cpick-sec">All currencies</div>}
              <button type="button" id={`cpick-${r.c.code}`} data-i={i} role="option" aria-selected={r.c.code === value}
                className={'cpick-row' + (i === at ? ' at' : '') + (r.c.code === value ? ' on' : '')} onMouseEnter={() => setAt(i)} onClick={() => onPick(r.c.code)}>
                <Coin code={r.c.code} size={34} />
                <span className="n">{r.c.name}</span>
                <span className="c">{r.c.code}</span>
                {r.c.code === value && <Icon.check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </>
  );
  return sheet ? createPortal(<div className="cpick-sheet">{body}</div>, document.body) : body;
}
