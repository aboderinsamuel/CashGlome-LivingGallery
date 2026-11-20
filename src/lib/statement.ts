// Bank statements, read on this device. A PDF or CSV a bank gave you becomes proposed entries: nothing is
// uploaded, nothing leaves. PDFs are read with pdf.js (loaded only when a statement is opened); the words on
// each page are put back into rows by where they sit, and the columns are found from the table's header.
//
// Every bank lays its statement out differently, so each row is read in three ways, best first:
//   1. Columns: a header names them ("Debit / Credit / Balance", "Money out", "Amount"), each figure is
//      filed under the heading it sits beneath.
//   2. Signs: "-45.00", "(45.00)", "45.00 DR" are money out; "CR" and "+" are money in.
//   3. The running balance: when it falls by the amount, money went out; when it rises, money came in.
import { CURRENCIES, todayISO, uid } from './format';
import { readCategory } from './parser';
import { recall } from './learn';
import type { Dir, Entry } from './types';

export interface StatementLine {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  text: string; // the row as the bank printed it
  amount: number;
  dir: Dir;
  category: string;
  /** Already in the book: same day (or the day either side), same amount, same direction. */
  dup: boolean;
}
export interface Statement {
  kind: 'pdf' | 'csv';
  file: string;
  bank?: string;
  currency?: string;
  pages?: number;
  from: string;
  to: string;
  lines: StatementLine[];
}
export type StatementProblem = 'scanned' | 'locked' | 'unreadable' | 'empty' | 'type';
export class StatementError extends Error {
  constructor(public problem: StatementProblem) { super(problem); }
}

interface Cell { text: string; x0: number; x1: number }
interface Row { cells: Cell[]; page: number }
type ColKind = 'date' | 'desc' | 'out' | 'in' | 'amount' | 'balance' | 'type';
interface Col { kind: ColKind; x0: number; x1: number }

/* ——— Opening the file ——— */

export const isStatementFile = (f: File) => /\.(pdf|csv)$/i.test(f.name) || f.type === 'application/pdf' || f.type === 'text/csv';

export async function readStatement(file: File, book: Entry[], onProgress?: (done: number, of: number) => void): Promise<Statement> {
  const pdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const csv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  if (!pdf && !csv) throw new StatementError('type');
  const buf = await file.arrayBuffer();
  const { rows, pages } = pdf ? await pdfRows(buf, onProgress) : { rows: csvRows(new TextDecoder().decode(buf)), pages: undefined };
  const all = rows.map((r) => r.cells.map((c) => c.text).join(' ')).join('\n');
  const year = commonYear(all);
  const order = dayOrder(rows);
  const lines = readRows(rows, { year, order });
  if (!lines.length) throw new StatementError('empty');
  const dates = lines.map((l) => l.date).sort();
  const bank = bankName(rows);
  const marked = lines.map((l) => ({ ...l, dup: book.some((e) => e.dir === l.dir && Math.abs(e.amount - l.amount) < 0.005 && Math.abs(dayNum(e.date) - dayNum(l.date)) <= 1) }));
  return { kind: pdf ? 'pdf' : 'csv', file: file.name, bank, currency: currencyOf(all), pages, from: dates[0], to: dates[dates.length - 1], lines: marked };
}

/** The proposed lines the person kept, as entries for the book. */
export function toEntries(st: Statement, keep: Set<string>, edits: Record<string, Partial<StatementLine>> = {}): Entry[] {
  const now = Date.now();
  const tag = st.bank || st.file.replace(/\.(pdf|csv)$/i, '');
  return st.lines.filter((l) => keep.has(l.id)).map((l, i) => {
    const x = { ...l, ...edits[l.id] };
    return { id: uid(), text: x.text, label: x.label, amount: x.amount, dir: x.dir, category: x.category, date: x.date, createdAt: now + i, source: 'oracle', confidence: 0.9, statement: tag };
  });
}

/* ——— PDF: the words on each page, back into rows ——— */

async function pdfRows(buf: ArrayBuffer, onProgress?: (done: number, of: number) => void): Promise<{ rows: Row[]; pages: number }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  } catch (e) {
    throw new StatementError((e as { name?: string })?.name === 'PasswordException' ? 'locked' : 'unreadable');
  }
  const rows: Row[] = [];
  let chars = 0;
  onProgress?.(0, doc.numPages);
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform?: number[]; width?: number; height?: number }[])
      .filter((it) => typeof it.str === 'string' && it.str.trim() && it.transform)
      .map((it) => ({ s: it.str!, x: it.transform![4], y: it.transform![5], w: it.width ?? 0, h: Math.abs(it.height || it.transform![3]) || 8 }));
    chars += items.reduce((a, it) => a + it.s.trim().length, 0);
    // Rows: words whose baselines sit within a third of a line of each other, top of the page first.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const bands: (typeof items)[] = [];
    for (const it of items) {
      const band = bands[bands.length - 1];
      if (band && Math.abs(band[0].y - it.y) <= Math.max(2, it.h * 0.35)) band.push(it); else bands.push([it]);
    }
    for (const band of bands) {
      band.sort((a, b) => a.x - b.x);
      // Cells: words closer than half a letter's height belong together.
      const cells: Cell[] = [];
      for (const it of band) {
        const last = cells[cells.length - 1];
        const gap = last ? it.x - last.x1 : Infinity;
        if (last && gap < it.h * 0.55) { last.text += (gap > it.h * 0.12 && !last.text.endsWith(' ') ? ' ' : '') + it.s; last.x1 = Math.max(last.x1, it.x + it.w); }
        else cells.push({ text: it.s, x0: it.x, x1: it.x + it.w });
      }
      rows.push({ cells: cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() })).filter((c) => c.text), page: p });
    }
    onProgress?.(p, doc.numPages);
  }
  // A page of pictures (a scan or a photo saved as PDF) has no words to read.
  if (chars < 30 * doc.numPages) throw new StatementError('scanned');
  return { rows, pages: doc.numPages };
}

/* ——— CSV: each column becomes a cell standing where its heading stands ——— */

function csvRows(text: string): Row[] {
  const src = text.replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t', '|'].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((c) => c.trim())).map((r) => ({ page: 1, cells: r.map((c, i) => ({ text: c.trim(), x0: i * 100, x1: i * 100 + 90 })).filter((c) => c.text) }));
}

/* ——— Reading the rows ——— */

const HEAD: [ColKind, RegExp][] = [
  ['balance', /^(?:running\s+)?(?:balance|bal\.?|saldo|solde|残高|잔액|余额)\b/i],
  ['out', /^(?:debits?|withdrawals?|money\s+out|paid\s+out|out|debit\s+amount|withdrawal\s+amount|cargo|retiros?|débit|sortie|soll|출금|支出)\b/i],
  ['in', /^(?:credits?|deposits?|money\s+in|paid\s+in|in|credit\s+amount|deposit\s+amount|abono|depósitos?|crédit|entrée|haben|입금|收入)\b/i],
  ['amount', /^(?:amount|amt|value|transaction\s+amount|importe|montant|valor|betrag|금액|金额)\b/i],
  ['type', /^(?:type|dr\s*\/\s*cr|cr\s*\/\s*dr|d\/c|direction)\b/i],
  ['date', /^(?:(?:transaction|txn|trans\.?|posting|posted|value|book(?:ing)?)\s+)?(?:date|fecha|data|datum|날짜|日期)\b/i],
  ['desc', /^(?:description|details|narration|narrative|particulars|transaction(?:\s+details)?|memo|payee|merchant|reference|remarks|concepto|libellé|descripción|beschreibung|적요|摘要)\b/i],
];
const SKIP = /\b(?:opening|closing|brought|carried|b\/f|c\/f|bal(?:ance)?\s+(?:fwd|forward)|total|subtotal|sum of|statement balance|available balance|saldo (?:inicial|final|anterior))\b/i;
const NOISE = /\bpage\s+\d+\s*(?:of|\/)\s*\d+\b|continued|thank you|this statement|please (?:check|contact|note)|www\.|https?:/i;
const CREDIT_WORDS = /\b(?:salary|payroll|wages?|deposit|received|from|refund|reversal|interest|dividend|credit|cashback|inward|incoming)\b/i;

function headerOf(row: Row): Col[] | null {
  const cols: Col[] = [];
  for (const c of row.cells) {
    const k = HEAD.find(([, re]) => re.test(c.text.trim()))?.[0];
    if (k) cols.push({ kind: k, x0: c.x0, x1: c.x1 });
  }
  const kinds = new Set(cols.map((c) => c.kind));
  return kinds.has('date') && (kinds.has('out') || kinds.has('in') || kinds.has('amount') || kinds.has('balance')) && cols.length >= 3 ? cols : null;
}

/** "1,234.56", "1.234,56", "(45.00)", "-45", "45.00 DR", "€12,50", "KSh 3,400". */
const AMT = /^\(?\s*([-−+])?\s*(?:[A-Z]{3}\s?|[₦$£€¥₹₩₱₵₺₽¢]|R\$|KSh\s?|GH₵\s?|Rs\.?\s?)?\s*([-−])?\s*(\d{1,3}(?:[,.\s\u00a0\u202f']\d{3})+|\d+)(?:([.,])(\d{1,2}))?\s*(\))?\s*(CR|DR|Cr|Dr|cr|dr|[-+])?$/;
interface Amt { value: number; sign: -1 | 0 | 1; strong: boolean }
function amountOf(text: string): Amt | null {
  const m = text.trim().match(AMT);
  if (!m) return null;
  const [, pre, pre2, int, , frac, close, post] = m;
  const value = Number(int.replace(/[,.\s\u00a0\u202f']/g, '') + (frac ? '.' + frac : ''));
  if (!isFinite(value)) return null;
  const neg = pre === '-' || pre === '−' || pre2 === '-' || pre2 === '−' || (text.trim().startsWith('(') && !!close) || post === '-' || /^dr$/i.test(post ?? '');
  const pos = pre === '+' || post === '+' || /^cr$/i.test(post ?? '');
  // A reference number is digits alone; money has cents, thousands marks or a currency.
  const strong = !!frac || /[,.\s\u00a0\u202f']/.test(int) || /[^\d\s.,()+\-−]/.test(text.replace(/(CR|DR)$/i, ''));
  return { value, sign: neg ? -1 : pos ? 1 : 0, strong };
}

const MONTHS: Record<string, number> = {};
[
  ['jan', 'january', 'janv', 'janvier', 'ene', 'enero', 'januar', 'gen', 'janeiro'],
  ['feb', 'february', 'févr', 'fevr', 'février', 'fev', 'fevereiro', 'febrero', 'februar'],
  ['mar', 'march', 'mars', 'marzo', 'märz', 'mrz', 'março', 'marco'],
  ['apr', 'april', 'avr', 'avril', 'abr', 'abril'],
  ['may', 'mai', 'mayo', 'maio', 'mag'],
  ['jun', 'june', 'juin', 'junio', 'juni', 'junho', 'giu'],
  ['jul', 'july', 'juil', 'juillet', 'julio', 'juli', 'julho', 'lug'],
  ['aug', 'august', 'août', 'aout', 'ago', 'agosto'],
  ['sep', 'sept', 'september', 'septembre', 'septiembre', 'set', 'setembro'],
  ['oct', 'october', 'octobre', 'octubre', 'okt', 'oktober', 'out', 'outubro', 'ott'],
  ['nov', 'november', 'novembre', 'noviembre', 'novembro'],
  ['dec', 'december', 'déc', 'decembre', 'décembre', 'dic', 'diciembre', 'dez', 'dezember', 'dezembro'],
].forEach((names, i) => names.forEach((n) => { MONTHS[n] = i + 1; }));
const mon = (s?: string) => (s ? MONTHS[s.toLowerCase().replace(/\.$/, '')] : undefined);

interface Ctx { year: number; order: 'dmy' | 'mdy' }
const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};
/** A date at the start of the text, and what follows it. */
function leadingDate(text: string, ctx: Ctx, loose = true): { date: string; rest: string } | null {
  const t = text.trim();
  let m: RegExpMatchArray | null;
  const done = (d: string | null, len: number) => (d ? { date: d, rest: t.slice(len).trim() } : null);
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/))) return done(iso(+m[1], +m[2], +m[3]), m[0].length);
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])/))) {
    const [a, b] = [+m[1], +m[2]];
    const [d, mo] = ctx.order === 'mdy' ? [b, a] : [a, b];
    return done(iso(+m[3], mo, d), m[0].length);
  }
  if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?[-\s/.]*([A-Za-zÀ-ÿ]{3,9})\.?(?:[-\s/.,]*(\d{4}|\d{2}))?(?![\d])/)) && mon(m[2])) {
    const y = m[3] ? +m[3] : ctx.year;
    return done(fixYear(iso(y, mon(m[2])!, +m[1]), !m[3]), m[0].length);
  }
  if ((m = t.match(/^([A-Za-zÀ-ÿ]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?![\d])/)) && mon(m[1])) {
    const y = m[3] ? +m[3] : ctx.year;
    return done(fixYear(iso(y, mon(m[1])!, +m[2]), !m[3]), m[0].length);
  }
  // "03/10" with no year, only where a row starts ("14.10" there is money, not a date).
  if (loose && (m = t.match(/^(\d{1,2})\/(\d{1,2})(?![\d/.])/))) {
    const [a, b] = [+m[1], +m[2]];
    const [d, mo] = ctx.order === 'mdy' ? [b, a] : [a, b];
    return done(fixYear(iso(ctx.year, mo, d), true), m[0].length);
  }
  return null;
}
/** A date printed without its year can't be in the future: it was last year's. */
function fixYear(d: string | null, guessed: boolean) {
  if (!d || !guessed || d <= todayISO()) return d;
  return `${+d.slice(0, 4) - 1}${d.slice(4)}`;
}
const dayNum = (d: string) => Math.round(new Date(d + 'T12:00').getTime() / 864e5);

function commonYear(text: string) {
  const counts = new Map<number, number>();
  for (const m of text.matchAll(/\b(20\d{2})\b/g)) counts.set(+m[1], (counts.get(+m[1]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? new Date().getFullYear();
}
/** 03/10 or 10/03? A day above twelve settles it; with no such day, day first, as most of the world writes it. */
function dayOrder(rows: Row[]): 'dmy' | 'mdy' {
  let dmy = 0, mdy = 0;
  for (const r of rows) {
    const m = r.cells[0]?.text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

function readRows(rows: Row[], ctx: Ctx): StatementLine[] {
  const out: StatementLine[] = [];
  let head: Col[] | null = null;
  let prevBal: number | undefined;
  let lastDate: string | undefined;
  let open: { line: StatementLine; desc: string[]; main: number; at: number } | null = null;
  const close = () => { if (open) { finish(open.line, open.desc, open.main); open = null; } };

  rows.forEach((row, ri) => {
    const whole = row.cells.map((c) => c.text).join(' ');
    const h = headerOf(row);
    if (h) { close(); head = h; return; }
    if (SKIP.test(whole)) {
      // Opening and closing balances: not money that moved, but the start of the running balance.
      close();
      const a = row.cells.map((c) => amountOf(c.text)).filter((x): x is Amt => !!x && x.strong);
      if (a.length && /opening|brought|b\/f|forward|inicial|anterior/i.test(whole)) prevBal = a[a.length - 1].value * (a[a.length - 1].sign < 0 ? -1 : 1);
      return;
    }
    if (NOISE.test(whole)) return;

    // The date: the first cell, or the first two (a day and month printed apart).
    let date: string | undefined;
    const used = new Set<number>();
    const lead = leadingDate(row.cells[0]?.text ?? '', ctx);
    const desc: string[] = [];
    if (lead) { date = lead.date; used.add(0); if (lead.rest && !amountOf(lead.rest)) desc.push(lead.rest); }
    // A second date (value date) is not part of the description.
    row.cells.forEach((c, i) => { if (!used.has(i) && i <= 2) { const d = leadingDate(c.text, ctx, false); if (d && !d.rest) used.add(i); } });

    // The figures, and which column each sits under.
    const figs: { a: Amt; col?: ColKind; i: number }[] = [];
    row.cells.forEach((c, i) => {
      if (used.has(i)) return;
      const a = amountOf(c.text);
      const col = head ? columnOf(c, head) : undefined;
      if (a && (a.strong || (col && col !== 'desc' && col !== 'date' && col !== 'type'))) { figs.push({ a, col, i }); used.add(i); }
    });
    const typeCell = head ? row.cells.find((c, i) => !used.has(i) && columnOf(c, head!) === 'type') : undefined;
    row.cells.forEach((c, i) => { if (!used.has(i) && c !== typeCell) desc.push(c.text); });

    if (!figs.length) {
      // A wrapped description: words under the line above, with no date and no figure of their own.
      if (open && !date && ri - open.at <= 2 && rows[open.at].page === row.page && desc.join(' ').length < 80) { open.desc.push(...desc); open.at = ri; }
      return;
    }
    if (!date) { if (!lastDate || (!head && !out.length && !open)) return; date = lastDate; }
    close();

    let amount: number | undefined, dir: Dir | undefined, bal: number | undefined;
    if (head && figs.some((f) => f.col)) {
      for (const f of figs) {
        if (f.col === 'balance') bal = f.a.value * (f.a.sign < 0 ? -1 : 1);
        else if (f.col === 'out' && f.a.value) { amount = f.a.value; dir = 'out'; }
        else if (f.col === 'in' && f.a.value) { amount = f.a.value; dir = 'in'; }
        else if (amount === undefined && f.a.value) { amount = f.a.value; dir = f.a.sign < 0 ? 'out' : f.a.sign > 0 ? 'in' : undefined; }
      }
    } else {
      const f = figs.length >= 2 ? figs[figs.length - 2] : figs[0];
      if (figs.length >= 2) { const b = figs[figs.length - 1].a; bal = b.value * (b.sign < 0 ? -1 : 1); }
      amount = f.a.value; dir = f.a.sign < 0 ? 'out' : f.a.sign > 0 ? 'in' : undefined;
    }
    if (typeCell && !dir) dir = /\b(?:cr|credit|in|deposit)\b/i.test(typeCell.text) ? 'in' : /\b(?:dr|debit|out|withdrawal)\b/i.test(typeCell.text) ? 'out' : undefined;
    // The running balance settles any doubt about which way it went.
    if (amount && bal !== undefined && prevBal !== undefined) {
      const diff = bal - prevBal;
      if (Math.abs(Math.abs(diff) - amount) < 0.011) dir = diff > 0 ? 'in' : 'out';
    }
    if (bal !== undefined) prevBal = bal;
    if (!amount) return;
    const text = desc.join(' ');
    if (!dir) dir = CREDIT_WORDS.test(text) ? 'in' : 'out';
    lastDate = date;
    open = { line: { id: uid(), date, label: '', text: '', amount, dir, category: '', dup: false }, desc, main: desc.length, at: ri };
  });
  close();
  return out;

  function finish(line: StatementLine, desc: string[], main: number) {
    const raw = desc.join(' ').replace(/\s+/g, ' ').trim();
    line.text = raw || (line.dir === 'in' ? 'Bank credit' : 'Bank debit');
    // The label from the row itself; a wrapped second line (card numbers, references) stays in the text.
    line.label = labelOf(desc.slice(0, main || 1).join(' '), line.dir);
    line.category = categoryOf(raw, line.label, line.dir);
    out.push(line);
  }
}

function columnOf(c: Cell, head: Col[]): ColKind | undefined {
  // Under a heading's span (figures are usually right-aligned under it), else the nearest heading.
  const pad = 18;
  const over = head.filter((h) => c.x1 > h.x0 - pad && c.x0 < h.x1 + pad);
  const pool = over.length ? over : head;
  const mid = (c.x0 + c.x1) / 2;
  return pool.slice().sort((a, b) => Math.min(Math.abs(mid - (a.x0 + a.x1) / 2), Math.abs(c.x1 - a.x1)) - Math.min(Math.abs(mid - (b.x0 + b.x1) / 2), Math.abs(c.x1 - b.x1)))[0]?.kind;
}

/* ——— Words a person would write ——— */

const CODES = /^(?:pos|pur|purchase|card|card\s+payment|card\s+purchase|debit\s+card|contactless|online|web|nip|ft|txn|trf|tfr|ach|eft|upi|imps|neft|dd|so|standing\s+order|direct\s+debit|bill\s+payment)\b[\s:/*-]*/i;
export function labelOf(raw: string, dir: Dir): string {
  let t = raw
    .replace(/\b(?:ref(?:erence)?|txn|trx|id|auth)\s*[:#.]?\s*[\w-]*\d[\w-]*/gi, ' ')
    .replace(/\*{2,}\d+|\bx{2,}\d+\b|\b\d{5,}\b/gi, ' ')
    .replace(/[/*_|#]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3 && CODES.test(t); i++) t = t.replace(CODES, '').trim();
  t = t.replace(/^[-–:,.\s]+|[-–:,.\s]+$/g, '');
  if (/^(?:atm|cash)\b|withdrawal/i.test(t) && dir === 'out') return 'Cash withdrawal';
  if (!t) return dir === 'in' ? 'Money in' : 'Money out';
  if (t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s(&-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/(?<=\S\s)(To|From|Of|And|For|The|At|In|On)(?=\s)/g, (w) => w.toLowerCase());
  return t.length > 42 ? t.slice(0, 41).trimEnd() + '…' : t;
}

function categoryOf(raw: string, label: string, dir: Dir): string {
  const t = raw.toLowerCase();
  let id: string | undefined;
  if (dir === 'out') {
    if (/\b(?:fee|fees|charges?|commission|levy|stamp duty|maintenance|sms alert|service charge)\b/.test(t) && !/school|tuition/.test(t)) id = 'bills';
    else if (/\b(?:savings?|pot|holiday fund|emergency fund)\b/.test(t)) id = 'savings';
    else if (/\b(?:grocer|grocers|supermarket|supermercado|supermarché)\b/.test(t)) id = 'groceries';
    else if (/\b(?:bookshop|bookstore|books?)\b/.test(t)) id = 'education';
    else if (/\b(?:atm|cash withdrawal|withdrawal)\b/.test(t)) id = 'other';
  } else {
    if (/\b(?:salary|payroll|wages?)\b/.test(t)) id = 'salary';
    else if (/\binterest\b|\bdividend/.test(t)) id = 'harvest';
    else if (/\b(?:refund|reversal|cashback)\b/.test(t)) id = 'refund';
  }
  const guess = id ?? readCategory(raw, dir);
  return recall({ label, dir, category: guess }).category;
}

/* ——— Who the statement is from, and in what money ——— */

function bankName(rows: Row[]): string | undefined {
  for (const r of rows.slice(0, 8)) for (const c of r.cells) {
    if (/\b(?:bank|banco|banque|bancorp|credit union|savings|trust|mutual|building society|financial|caisse|sparkasse|은행|银行)\b/i.test(c.text) && c.text.length <= 48 && !/statement/i.test(c.text)) return c.text.replace(/\s+/g, ' ').trim();
  }
  return undefined;
}

const SYMBOLS: [RegExp, string][] = [[/€/, 'EUR'], [/£/, 'GBP'], [/₦/, 'NGN'], [/₹/, 'INR'], [/₩/, 'KRW'], [/R\$/, 'BRL'], [/KSh/, 'KES'], [/GH₵|₵/, 'GHS'], [/¥|元/, 'CNY']];
function currencyOf(text: string): string | undefined {
  const named = text.match(/\b(?:currency|ccy|devise|moneda|moeda|währung)\s*[:\-]?\s*([A-Z]{3})\b/i)?.[1]?.toUpperCase();
  if (named && CURRENCIES.some((c) => c.code === named)) return named;
  const counts = CURRENCIES.map((c) => [c.code, (text.match(new RegExp(`\\b${c.code}\\b`, 'g')) ?? []).length] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (counts.length) return counts[0][0];
  return SYMBOLS.find(([re]) => re.test(text))?.[1];
}
