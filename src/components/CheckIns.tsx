import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { cat } from '../lib/categories';
import { money } from '../lib/format';
import { relDay } from '../lib/memory';
import { findAmounts } from '../lib/parser';
import type { Memory } from '../lib/types';
import { Icon } from './Icons';

export interface CheckIn { m: Memory; date: string; key: string }

/** "Did you spend ₦4,000 on transport today?" One tap writes it down; another says it didn't happen. */
export function CheckIns({ list, cur, onYes, onNo, onAllYes }: {
  list: CheckIn[]; cur: string;
  onYes: (c: CheckIn, amount?: number) => void; onNo: (c: CheckIn) => void; onAllYes: () => void;
}) {
  const [other, setOther] = useState<string | null>(null);
  const [amt, setAmt] = useState('');
  const c = list[0];
  return (
    <AnimatePresence mode="popLayout">
      {c && (
        <motion.div key={c.key} className="checkin glass" role="group" aria-label="Routine check-in"
          initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
          <span className="checkin-dot" style={{ background: cat(c.m.category ?? 'other').color }} aria-hidden />
          <div className="checkin-q">
            <div>{c.m.dir === 'in'
              ? <>Did <b>{c.m.label?.toLowerCase()}</b> come in {relDay(c.date)}? <span className="num">+{money(c.m.amount ?? 0, cur)}</span></>
              : <>Did you spend <span className="num">{money(c.m.amount ?? 0, cur)}</span> on <b>{c.m.label?.toLowerCase()}</b> {relDay(c.date)}?</>}</div>
            {list.length > 1 && <div className="small">{list.length - 1} more waiting{list.length > 2 ? '' : ''} · <button className="notice-undo" style={{ display: 'inline' }} onClick={onAllYes}>Yes to all</button></div>}
          </div>
          {other === c.key ? (
            <form className="checkin-amt" onSubmit={(e) => { e.preventDefault(); const v = findAmounts(amt)[0]?.value; if (v) { onYes(c, v); setOther(null); setAmt(''); } }}>
              <input className="field num" autoFocus value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={money(c.m.amount ?? 0, cur)} aria-label="How much it was" />
              <button className="btn primary" disabled={!findAmounts(amt)[0]}>Write</button>
            </form>
          ) : (
            <div className="checkin-btns">
              <button className="btn primary" onClick={() => onYes(c)}><Icon.check size={14} /> Yes</button>
              <button className="btn" onClick={() => { setOther(c.key); setAmt(''); }}>Different</button>
              <button className="btn" onClick={() => onNo(c)}>No</button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
