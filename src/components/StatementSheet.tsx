// Bring in a statement: a bank's PDF or CSV becomes entries, read on this device. The person sees every
// line before anything is written, unticks what they don't want, and lines already in the book are left out.
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cat, choosable } from '../lib/categories';
import { CURRENCIES, money, monthLabel, monthOf, spanInWords } from '../lib/format';
import { readStatement, StatementError, toEntries, type Statement, type StatementLine, type StatementProblem } from '../lib/statement';
import type { Entry } from '../lib/types';
import { Icon } from './Icons';
import './statement.css';

/** The question Florin is asked after a statement comes in. */
export const STATEMENT_QUESTION = 'What does my statement say about me?';

export const SAMPLES = [
  { file: 'lantern-quay-october-2026.pdf', name: 'Lantern & Quay Bank', note: 'October, US dollars, PDF' },
  { file: 'compass-mutual-november-2026.pdf', name: 'Compass Mutual Bank', note: 'November, euros, PDF' },
  { file: 'saltmarsh-credit-union-november-2026.csv', name: 'Saltmarsh Credit Union', note: 'November, shillings, CSV' },
];

interface Props {
  file: File | null;
  book: Entry[];
  currency: string;
  /** Whether the book has nothing in it yet, so it can take the statement's currency. */
  empty: boolean;
  onAdd: (entries: Entry[], st: Statement, currency?: string) => void;
  onAsk: () => void;
  onLedger: () => void;
  onClose: () => void;
}
type Stage = { s: 'pick' } | { s: 'reading'; name: string; done: number; of: number } | { s: 'error'; problem: StatementProblem; name: string } | { s: 'review'; st: Statement } | { s: 'done'; st: Statement; n: number };

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const inWords = (n: number) => (n < 20 ? NUM[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + NUM[n % 10] : '') : String(n));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** "COMPASS MUTUAL BANK" reads "Compass Mutual Bank". */
const bankTitle = (b: string) => (b === b.toUpperCase() ? b.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, c: string) => a + c.toUpperCase()) : b);
const short = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en', { day: 'numeric', month: 'short' });

const PROBLEMS: Record<StatementProblem, { head: [string, string]; body: string }> = {
  scanned: { head: ['This one is a ', 'picture'], body: 'Its pages are images, like a scan or a photo saved as a PDF, so there are no words on them for this device to read. Most banks also offer a CSV or a “download as PDF” from the app, and those work. For a single receipt, the camera reads it.' },
  locked: { head: ['This statement is ', 'sealed'], body: 'It is protected with a password. Open it in your bank’s app or a PDF reader, save a copy without the password, and bring that in. The password never needs to come here.' },
  unreadable: { head: ['This file wouldn’t ', 'open'], body: 'It may be damaged, or not really a PDF. Download it again from your bank, or use the CSV export if there is one.' },
  empty: { head: ['No lines to ', 'read'], body: 'The file opened, but no dated lines with amounts were found in it. A CSV export from your bank usually reads cleanly.' },
  type: { head: ['Only a ', 'PDF or CSV'], body: 'Statements come in as PDF or CSV files. For a photo of a receipt, use the camera beside the writing box.' },
};

export function StatementSheet({ file, book, currency, empty, onAdd, onAsk, onLedger, onClose }: Props) {
  const [stage, setStage] = useState<Stage>({ s: 'pick' });
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, Partial<StatementLine>>>({});
  const [adopt, setAdopt] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const runs = useRef(0);

  useEffect(() => { if (file) void open(file); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function open(f: File) {
    const run = ++runs.current;
    setStage({ s: 'reading', name: f.name, done: 0, of: 0 });
    // Let the reading page paint before pdf.js arrives.
    await new Promise((r) => setTimeout(r, 60));
    try {
      const t0 = Date.now();
      const st = await readStatement(f, book, (done, of) => run === runs.current && setStage({ s: 'reading', name: f.name, done, of }));
      // A small statement reads in a blink; the page stays long enough to be seen being read.
      await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - t0))));
      if (run !== runs.current) return;
      setKeep(new Set(st.lines.filter((l) => !l.dup).map((l) => l.id)));
      setEdits({});
      setAdopt(empty && !!st.currency && st.currency !== currency);
      setStage({ s: 'review', st });
    } catch (e) {
      if (run !== runs.current) return;
      console.warn('[statement]', e);
      setStage({ s: 'error', problem: e instanceof StatementError ? e.problem : 'unreadable', name: f.name });
    }
  }
  async function sample(name: string) {
    try {
      const res = await fetch(`./samples/${name}`);
      if (!res.ok) throw new Error(String(res.status));
      const b = await res.blob();
      void open(new File([b], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'text/csv' }));
    } catch { setStage({ s: 'error', problem: 'unreadable', name }); }
  }
  const pick = (l?: FileList | null) => { const f = l?.[0]; if (f) void open(f); };

  const st = stage.s === 'review' ? stage.st : null;
  // Exactly as the bank printed it: cents on every line when the statement has cents.
  const dp = st?.lines.some((l) => l.amount % 1 !== 0) ? 2 : 0;
  const cash = (n: number, c: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol', minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n); } catch { return money(n, c); }
  };
  const lines = useMemo(() => (st ? st.lines.map((l) => ({ ...l, ...edits[l.id] })) : []), [st, edits]);
  const chosen = lines.filter((l) => keep.has(l.id));
  const sumIn = chosen.filter((l) => l.dir === 'in').reduce((a, l) => a + l.amount, 0);
  const sumOut = chosen.filter((l) => l.dir === 'out').reduce((a, l) => a + l.amount, 0);
  const dups = lines.filter((l) => l.dup).length;
  // As the bank printed it: in the statement's own money when it names one.
  const shownCur = st?.currency ?? currency;
  const foreign = st?.currency && st.currency !== currency ? st.currency : null;
  const curName = (c: string) => CURRENCIES.find((x) => x.code === c)?.name ?? c;
  const toggle = (id: string) => setKeep((k) => { const n = new Set(k); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = chosen.length === lines.length;

  const add = () => {
    if (!st || !chosen.length) return;
    const entries = toEntries(st, keep, edits);
    onAdd(entries, st, adopt && st.currency ? st.currency : undefined);
    setStage({ s: 'done', st, n: entries.length });
  };

  return (
    <motion.div className="scrim cap-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); pick(e.dataTransfer.files); }}>
      <motion.div className={'panel stm stm-' + stage.s} role="dialog" aria-modal aria-label="Import a statement" data-stage={stage.s}
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}>
        <button className="panel-x" onClick={onClose} aria-label="Close"><Icon.close size={13} /></button>
        <input ref={input} id="statement-file" data-testid="statement-file" type="file" accept=".pdf,.csv,application/pdf,text/csv" hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />

        <>
          {stage.s === 'pick' && (
            <motion.div key="pick" className="stm-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="stm-kicker">From your bank</div>
              <h2 className="stm-title">Bring in a <em>statement</em></h2>
              <p className="stm-lede">A month of lines in one go. Choose the PDF or CSV your bank gives you; you’ll see every line before anything is written.</p>
              <button className={'stm-drop' + (over ? ' over' : '')} onClick={() => input.current?.click()}>
                <Folio />
                <span className="stm-drop-words">
                  <b>Choose a statement</b>
                  <span>or drop a PDF or CSV here</span>
                </span>
              </button>
              <p className="stm-privacy"><Icon.lock size={13} /> Read here, on this device. Nothing is uploaded, and there is no bank login.</p>
              <div className="stm-samples">
                <span className="stm-samples-h">No statement to hand? Try a sample</span>
                {SAMPLES.map((s) => (
                  <button key={s.file} className="stm-sample" data-sample={s.file} onClick={() => void sample(s.file)}>
                    <span>{s.name}</span><i>{s.note}</i>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {stage.s === 'reading' && (
            <motion.div key="reading" className="stm-body stm-reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <div className="stm-page" aria-hidden>
                {Array.from({ length: 9 }, (_, i) => (
                  <motion.i key={i} initial={{ scaleX: 0 }} animate={{ scaleX: [0, 1, 1, 0] }} transition={{ duration: 2.4, times: [0, 0.35, 0.8, 1], delay: i * 0.12, repeat: Infinity, repeatDelay: 0.3 }} style={{ width: `${58 + ((i * 37) % 38)}%` }} />
                ))}
              </div>
              <h2 className="stm-title small">Reading the <em>statement</em></h2>
              <p className="stm-lede">{stage.of ? `Page ${Math.min(stage.done + 1, stage.of)} of ${stage.of}` : 'Opening it'} · {stage.name}</p>
              <div className="stm-bar"><motion.i animate={{ width: `${stage.of ? Math.max(8, (stage.done / stage.of) * 100) : 8}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} /></div>
              <p className="stm-privacy"><Icon.lock size={13} /> On this device. Nothing leaves it.</p>
            </motion.div>
          )}

          {stage.s === 'error' && (
            <motion.div key="error" className="stm-body stm-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert">
              <div className="stm-kicker">{stage.name}</div>
              <h2 className="stm-title">{PROBLEMS[stage.problem].head[0]}<em>{PROBLEMS[stage.problem].head[1]}</em></h2>
              <p className="stm-lede">{PROBLEMS[stage.problem].body}</p>
              <div className="stm-actions">
                <button className="btn" onClick={onClose}>Write it by hand</button>
                <button className="btn primary" onClick={() => input.current?.click()}>Try another file</button>
              </div>
            </motion.div>
          )}

          {stage.s === 'review' && st && (
            <motion.div key="review" className="stm-review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <header className="stm-head">
                <div className="stm-kicker">{st.kind === 'pdf' ? `Statement${st.pages ? ` · ${st.pages} ${st.pages === 1 ? 'page' : 'pages'}` : ''}` : 'Statement · CSV'}</div>
                <h2 className="stm-title small">{st.bank ? bankTitle(st.bank) : <>Your <em>statement</em></>}</h2>
                <p className="stm-span">From {spanInWords(st.from, st.to)}</p>
                <div className="stm-figs">
                  <div><span>Lines</span><b className="num">{lines.length}</b></div>
                  <div><span>Came in</span><b className="num in">{cash(lines.filter((l) => l.dir === 'in').reduce((a, l) => a + l.amount, 0), shownCur)}</b></div>
                  <div><span>Went out</span><b className="num">{cash(lines.filter((l) => l.dir === 'out').reduce((a, l) => a + l.amount, 0), shownCur)}</b></div>
                </div>
                {foreign && (
                  <div className="stm-note">
                    {empty
                      ? <label className="stm-adopt"><input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} /> <span>This statement counts in {foreign}, and your book is still empty. Keep the book in {foreign} from now on</span></label>
                      : <>This statement counts in {foreign}{curName(foreign) !== foreign ? ` (${curName(foreign)})` : ''} and your book in {currency}. The amounts are added as written, never converted with a guessed rate.</>}
                  </div>
                )}
                {dups > 0 && <div className="stm-note">{dups === 1 ? 'One line is' : `${cap(inWords(dups))} lines are`} already in your book, so {dups === 1 ? 'it is' : 'they are'} left unticked.</div>}
              </header>
              <div className="stm-list-bar">
                <button className="stm-all" onClick={() => setKeep(all ? new Set() : new Set(lines.map((l) => l.id)))}>{all ? 'Untick all' : 'Tick all'}</button>
                <span className="small">Untick anything you don’t want. Tap a category to change it.</span>
              </div>
              <ul className="stm-list" aria-label="Lines found in the statement">
                {lines.map((l) => {
                  const c = cat(l.category);
                  const on = keep.has(l.id);
                  return (
                    <li key={l.id} className={'stm-line' + (on ? ' on' : '') + (l.dup ? ' dup' : '')}>
                      <label className="stm-check">
                        <input type="checkbox" checked={on} onChange={() => toggle(l.id)} aria-label={`Keep ${l.label}, ${cash(l.amount, shownCur)}`} />
                        <span aria-hidden><Icon.check size={12} /></span>
                      </label>
                      <span className="stm-date num">{short(l.date)}</span>
                      <span className="stm-what">
                        <span className="stm-label" title={l.text}>{l.label}</span>
                        <span className="stm-meta">
                          <span className="stm-cat"><span className="dotc" style={{ background: c.color }} />
                            <select value={l.category} onChange={(e) => setEdits((x) => ({ ...x, [l.id]: { ...x[l.id], category: e.target.value } }))} aria-label={`Category for ${l.label}`}>
                              {choosable(l.dir).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          </span>
                          {l.dup && <span className="stm-dup">Already in your book</span>}
                        </span>
                      </span>
                      <span className={'stm-amt num' + (l.dir === 'in' ? ' in' : '')}>{l.dir === 'in' ? '+' : '−'}{cash(l.amount, shownCur)}</span>
                    </li>
                  );
                })}
              </ul>
              <footer className="stm-foot">
                <span className="small num">{chosen.length ? <>{sumIn ? `+${cash(sumIn, shownCur)}` : ''}{sumIn && sumOut ? ' · ' : ''}{sumOut ? `−${cash(sumOut, shownCur)}` : ''}</> : 'Nothing ticked'}</span>
                <div className="stm-actions">
                  <button className="btn" onClick={onClose}>Cancel</button>
                  <button className="btn primary" data-testid="statement-add" disabled={!chosen.length} onClick={add}>{chosen.length === 1 ? 'Add 1 entry' : `Add ${chosen.length} entries`}</button>
                </div>
              </footer>
            </motion.div>
          )}

          {stage.s === 'done' && (
            <motion.div key="done" className="stm-body stm-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Seal />
              <h2 className="stm-title">{cap(inWords(stage.n))} {stage.n === 1 ? 'line' : 'lines'}, <em>filed</em></h2>
              <p className="stm-lede">They are in your book under {[...new Set([monthOf(stage.st.from), monthOf(stage.st.to)])].map((m) => monthLabel(m)).join(' and ')}, each one marked as from {stage.st.bank ? bankTitle(stage.st.bank) : 'your statement'}. Florin can read them now; every sum is still counted here.</p>
              <div className="stm-actions stack">
                <button className="btn primary" data-testid="statement-ask" onClick={onAsk}>Ask Florin about it</button>
                <button className="btn" onClick={onLedger}>See them in the Ledger</button>
              </div>
            </motion.div>
          )}
        </>
      </motion.div>
    </motion.div>
  );
}

/** A folded statement page, drawn in ink. */
function Folio() {
  return (
    <svg className="stm-folio" viewBox="0 0 64 76" width="56" height="66" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h36l12 12v56H8z" fill="var(--paper)" />
      <path d="M44 4v12h12" />
      <path d="M16 26h22M16 33h30M16 40h26M16 47h30M16 54h18" opacity="0.55" />
      <path d="M40 56l4 4 8-9" stroke="var(--gold)" strokeWidth="1.8" />
    </svg>
  );
}

/** A wax seal: the lines are kept. */
function Seal() {
  return (
    <motion.svg className="stm-seal" viewBox="0 0 80 80" width="76" height="76" aria-hidden initial={{ scale: 1.6, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
      <path d="M40 4c6 0 8 5 13 6s10-1 13 4-1 9 1 14 7 7 6 13-6 7-7 12 2 10-3 13-9 0-13 3-6 8-12 8-8-5-13-6-10 1-13-4 1-9-1-14-7-7-6-13 6-7 7-12-2-10 3-13 9 0 13-3 6-8 12-8z" fill="var(--vermilion)" opacity="0.92" />
      <circle cx="40" cy="40" r="22" fill="none" stroke="rgba(255,240,220,0.55)" strokeWidth="1.2" />
      <path d="M30 41l7 7 14-15" fill="none" stroke="#FFF3E2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}
