// Reads a photo: is it a receipt (then find the shop, the total and the date) or a thing someone bought?
// Tesseract reads it on this device, from files bundled with the app (nothing is downloaded at run time).
import { parseOne } from './parser';
import { todayISO } from './format';
import type { Settings } from './types';

export interface Box { x: number; y: number; w: number; h: number } // fractions of the image
export interface Reading {
  kind: 'receipt' | 'thing';
  merchant?: string;
  total?: number;
  date?: string;
  category?: string;
  label?: string;
  box?: Box;
  engine: 'muse' | 'device';
  note?: string; // why Florin wasn't used, when it failed
}
type Progress = (p: number, stage: string) => void;

export async function readPicture(_s: Settings, file: Blob, _currency: string, onProgress: Progress): Promise<Reading> {
  return deviceRead(file, onProgress);
}


/* ——— On this device (Tesseract) ——— */
type TWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let worker: Promise<TWorker> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
let report: Progress = () => {};

// WebAssembly SIMD check (the same bytes wasm-feature-detect uses); picks the faster OCR engine when it can.
const SIMD = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } })();

function getWorker() {
  if (!worker) {
    const here = (p: string) => new URL(p, location.href).href;
    worker = import('tesseract.js').then(({ createWorker }) => createWorker('eng', 1, {
      workerPath: here('./ocr/worker.min.js'),
      corePath: here(SIMD ? './ocr/tesseract-core-simd-lstm.wasm.js' : './ocr/tesseract-core-lstm.wasm.js'),
      langPath: here('./ocr/lang'),
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
      logger: (m) => {
        if (m.status === 'recognizing text') report(0.35 + m.progress * 0.6, 'Reading the receipt');
        else if (m.status.startsWith('loading')) report(0.08 + m.progress * 0.2, 'Getting the reader ready');
      },
    }));
    worker.catch(() => { worker = null; });
  }
  clearTimeout(idle);
  idle = setTimeout(() => { worker?.then((w) => w.terminate()); worker = null; warmed = null; }, 90000);
  return worker;
}

async function deviceRead(file: Blob, onProgress: Progress): Promise<Reading> {
  report = onProgress;
  onProgress(0.05, 'Getting the reader ready');
  const { canvas, w, h } = await prepare(file);
  const wk = await getWorker();
  await warmed;
  onProgress(0.32, 'Reading the receipt');
  const { data } = await wk.recognize(canvas, {}, { text: true, blocks: true });
  onProgress(0.97, 'Almost there');
  const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    .map((l) => ({ text: l.text.replace(/\s+/g, ' ').trim(), bbox: l.bbox, conf: l.confidence }))
    .filter((l) => l.text.length > 1 && l.conf > 30);
  return interpret(lines, w, h);
}

/** Starts the on-device reader early (while the camera is open), so reading feels instant. */
let warmed: Promise<unknown> | null = null;
export function warmReader() {
  if (warmed) return;
  const c = document.createElement('canvas'); c.width = 64; c.height = 24;
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 24); g.fillStyle = '#000'; g.font = '16px monospace'; g.fillText('1.00', 4, 18);
  warmed = getWorker().then((w) => w.recognize(c)).catch(() => { warmed = null; });
}

/** Greyscale with stretched contrast, about 1400px long: what Tesseract likes. */
async function prepare(file: Blob) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0, w, h); bmp.close();
  const img = g.getImageData(0, 0, w, h); const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = l; hist[l]++; }
  const n = w * h; let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
  const span = Math.max(30, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, ((d[i] - lo) / span) * 255)); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(img, 0, 0);
  return { canvas, w, h };
}

type OLine = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } };
const MONEY = /(?:[₦$€£¥₹]|ngn|usd|gbp|eur|kes|ghs|zar)?\s*(\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2}|\d{2,7})(?!\s*(?:%|kg|g\b|ml|l\b|pcs|x\b))/gi;
const TOTAL = /\b(grand\s*total|total\s*(?:due|paid|amount)?|amount\s*(?:due|paid)|balance\s*due|to\s*pay|net\s*(?:amount|total)|sum)\b/i;
const NOT_TOTAL = /\b(sub\s*-?\s*total|tax|vat|discount|change|cash|tender|tendered|saving|tip|card\s*no|qty|items?)\b/i;
const SKIP = /\b(tel|phone|fax|www|http|receipt\s*no|invoice\s*no|vat\s*no|tin|rc\s*no|terminal|auth|ref|txn|trans)\b/i;

export function amountOf(raw: string): number {
  let s = raw.replace(/[^\d.,]/g, '');
  if (/[.,]\d{2}$/.test(s)) { const cents = s.slice(-2); s = s.slice(0, -3).replace(/[.,\s]/g, '') + '.' + cents; }
  else s = s.replace(/[.,\s]/g, '');
  return Number(s);
}

function interpret(lines: OLine[], w: number, h: number): Reading {
  const withMoney = lines.map((l) => {
    const amounts: number[] = [];
    if (!SKIP.test(l.text) && !/\d{2}[/.-]\d{2}[/.-]\d{2,4}/.test(l.text)) {
      for (const m of l.text.matchAll(MONEY)) { const v = amountOf(m[1]); if (v > 0 && v < 1e9) amounts.push(v); }
    }
    return { ...l, amounts };
  });
  const totals = withMoney.filter((l) => l.amounts.length && TOTAL.test(l.text) && !NOT_TOTAL.test(l.text));
  let pick = totals.length ? totals.reduce((a, b) => (Math.max(...b.amounts) >= Math.max(...a.amounts) ? b : a)) : undefined;
  let total = pick ? Math.max(...pick.amounts) : undefined;
  if (!pick) {
    const pool = withMoney.filter((l) => l.amounts.length && !NOT_TOTAL.test(l.text));
    // only trust "the biggest number" on something that looks like a receipt
    if (pool.length >= 3) { pick = pool.reduce((a, b) => (Math.max(...b.amounts) > Math.max(...a.amounts) ? b : a)); total = Math.max(...pick.amounts); }
  }
  const numericLines = withMoney.filter((l) => l.amounts.length).length;
  const isReceipt = !!totals.length || numericLines >= 4 || (lines.length >= 7 && numericLines >= 2);
  if (!isReceipt) return { kind: 'thing', engine: 'device' };

  const merchant = lines.slice(0, 5).map((l) => l.text).find((t) => {
    const letters = t.replace(/[^a-z]/gi, '').length;
    return letters >= 3 && letters / t.length > 0.6 && !/\b(receipt|invoice|welcome|thank|customer|copy|tel|www|date|time|cashier)\b/i.test(t);
  });
  const date = findDate(lines.map((l) => l.text).join('\n'));
  const label = merchant ? tidyName(merchant) : undefined;
  const guess = parseOne(`${label ?? 'shop'} ${total ?? 1}`);
  const box = pick ? { x: pick.bbox.x0 / w, y: pick.bbox.y0 / h, w: (pick.bbox.x1 - pick.bbox.x0) / w, h: (pick.bbox.y1 - pick.bbox.y0) / h } : undefined;
  return { kind: 'receipt', merchant: label, total, date, category: guess && guess.category !== 'other' ? guess.category : 'shopping', box, engine: 'device' };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function findDate(text: string, now = new Date()): string | undefined {
  const usFirst = /^en-US|^en-PH/i.test(navigator.language);
  const ok = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const dt = new Date(y, m - 1, d, 12);
    if (dt.getMonth() !== m - 1 || dt > now || now.getTime() - dt.getTime() > 400 * 864e5) return undefined;
    return todayISO(dt);
  };
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    if (a > 12) return ok(y, b, a);
    if (b > 12) return ok(y, a, b);
    return usFirst ? ok(y, a, b) : ok(y, b, a);
  }
  m = text.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{2,4})\b/i);
  if (m) return ok(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2}),?\s*(\d{2,4})\b/i);
  if (m) return ok(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return undefined;
}

function tidyName(s: string) {
  const t = s.replace(/[^\p{L}\p{N}&' .-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
  return t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}
