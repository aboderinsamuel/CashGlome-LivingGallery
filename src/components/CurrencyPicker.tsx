// Choosing the money you count in: a coin, a name, and a search, instead of the browser's grey list.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CURRENCIES, currencySymbol, guessCurrency } from '../lib/format';
import { Icon } from './Icons';

/** Words people search with: the country, the city, what the money is called at home. */
const ALSO: Record<string, string> = {
  NGN: 'nigeria lagos abuja naija', USD: 'united states america usa dollar', EUR: 'europe france germany spain italy portugal netherlands ireland belgium',
  GBP: 'united kingdom britain england london sterling quid', CAD: 'canada toronto', AUD: 'australia sydney', KES: 'kenya nairobi bob',
  GHS: 'ghana accra', ZAR: 'south africa johannesburg cape town', INR: 'india delhi mumbai', JPY: 'japan tokyo 円', BRL: 'brazil sao paulo',
  MXN: 'mexico', AED: 'emirates dubai abu dhabi', EGP: 'egypt cairo', CNY: 'china renminbi rmb 元 人民币', KRW: 'korea seoul 원',
  XOF: 'senegal ivory coast cote divoire mali benin togo burkina niger cfa', TZS: 'tanzania dar es salaam', SAR: 'saudi arabia riyadh',
};

export function Coin({ code, size = 30 }: { code: string; size?: number }) {
  const s = currencySymbol(code);
  return <span className="coin" style={{ width: size, height: size, fontSize: s.length > 2 ? size * 0.34 : size * 0.48 }} aria-hidden>{s}</span>;
}

export function CurrencyPicker({ value, onChange, dark = false }: { value: string; onChange: (code: string) => void; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    // Open upward when the list wouldn't fit below the button.
    const r = btn.current?.getBoundingClientRect();
    if (r) setUp(window.innerHeight - r.bottom < 380 && r.top > window.innerHeight - r.bottom);
    setOpen((o) => !o);
  };
  const cur = CURRENCIES.find((c) => c.code === value) ?? CURRENCIES[0];
  return (
    <div className={'cpick' + (dark ? ' dark' : '') + (up ? ' up' : '')}>
      <button ref={btn} type="button" className="cpick-btn" aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        <Coin code={cur.code} />
        <span className="cpick-name">{cur.name}<small>{cur.code} · change</small></span>
        <Icon.chevronDown size={12} />
      </button>
      <AnimatePresence>{open && <CurrencyList value={value} onPick={(c) => { onChange(c); setOpen(false); }} onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function CurrencyList({ value, onPick, onClose }: { value: string; onPick: (c: string) => void; onClose: () => void }) {
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
