// The exhibition card: a month's painting, restored as far as it has been, with the chapter's
// title and a few plain numbers. Drawn on a canvas on this device and handed to the share sheet.
// Amounts are left off unless the person turns them on.
import { chapterOf, computeStats, spaceSegs, type Seg } from './analytics';
import { artSrc, candleOf, COLS, PATCHES, paintingOf, restorationOf, ROWS } from './art';
import { cat } from './categories';
import { money, monthLabel } from './format';
import type { State } from './types';
import { varnish } from './varnish';

/** Where the card sends people. One place to change it before launch. */
export const SHARE_HOST = 'cashglome.app';

export type CardFormat = 'story' | 'post';
export const FORMATS: Record<CardFormat, { w: number; h: number; label: string; hint: string }> = {
  story: { w: 1080, h: 1920, label: 'Story', hint: 'Instagram, TikTok, WhatsApp status' },
  post: { w: 1080, h: 1350, label: 'Post', hint: 'Feeds, X, LinkedIn' },
};

export interface CardOptions { state: State; month?: string; title?: Seg[]; amounts: boolean; format: CardFormat }

const INK = '#120E09', CREAM = '#F3EAD8', MUTED = 'rgba(243, 234, 216, 0.62)', FAINT = 'rgba(243, 234, 216, 0.16)', GOLD = '#D4AE5E', GOLD2 = '#E9CC88';
const SERIF = "'Newsreader Variable', 'Iowan Old Style', Georgia, serif";
const GROT = "'Schibsted Grotesk Variable', 'Helvetica Neue', Arial, sans-serif";

const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error('Could not load ' + src));
  img.src = src;
});

/** Draws `img` into the rect like object-fit: cover with object-position ax/ay (0..1). */
function cover(g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, ax: number, ay: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width, ih = (img as HTMLImageElement).naturalHeight || img.height;
  const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
  g.drawImage(img, (iw - sw) * ax, (ih - sh) * ay, sw, sh, x, y, w, h);
}

/** Splits styled segments into lines that fit `max`, keeping each word's style. */
function wrap(g: CanvasRenderingContext2D, segs: Seg[], max: number, font: (em: boolean) => string) {
  const words: { t: string; em: boolean }[] = [];
  for (const s of segs) for (const w of s.t.split(/(\s+)/)) if (w) words.push({ t: w, em: !!s.em });
  const lines: { t: string; em: boolean; w: number }[][] = [[]];
  let width = 0;
  for (const w of words) {
    g.font = font(w.em);
    const ww = g.measureText(w.t).width;
    const line = lines[lines.length - 1];
    if (/^\s+$/.test(w.t)) { if (line.length) { line.push({ ...w, w: ww }); width += ww; } continue; }
    if (width + ww > max && line.length) {
      while (line.length && /^\s+$/.test(line[line.length - 1].t)) width -= line.pop()!.w;
      lines.push([{ ...w, w: ww }]); width = ww;
    } else { line.push({ ...w, w: ww }); width += ww; }
  }
  return lines;
}

let grain: HTMLCanvasElement | null = null;
function grainTile() {
  if (grain) return grain;
  grain = Object.assign(document.createElement('canvas'), { width: 220, height: 220 });
  const g = grain.getContext('2d')!, id = g.createImageData(220, 220);
  for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 14; }
  g.putImageData(id, 0, 0);
  return grain;
}

/** Everything the card says, worked out once. */
export function cardFacts(state: State, month = state.month, title?: Seg[]) {
  const s = computeStats(state.entries, month);
  const ch = chapterOf(state, s);
  const painting = paintingOf(s);
  const r = restorationOf(state.entries, month, state.quiet);
  const spendCats = s.byCat.filter((c) => cat(c.id).nature !== 'save');
  const top = spendCats[0];
  const candle = candleOf(state.entries);
  return {
    s, painting, r,
    numeral: ch.numeral,
    title: spaceSegs(title ?? ch.title),
    character: ch.character,
    month: monthLabel(month),
    top: top ? { name: cat(top.id).short, color: cat(top.id).color, pct: Math.round((top.total / Math.max(1, s.spend)) * 100) } : null,
    candle: s.isCurrent && candle.streak >= 2 ? candle.streak : 0,
  };
}

export async function drawCard({ state, month = state.month, title, amounts, format }: CardOptions): Promise<HTMLCanvasElement> {
  const F = cardFacts(state, month, title);
  const { w: W, h: H } = FORMATS[format];
  const story = format === 'story';
  const cur = state.profile.currency;

  await Promise.all([
    document.fonts?.load(`400 40px ${SERIF}`), document.fonts?.load(`italic 400 40px ${SERIF}`),
    document.fonts?.load(`600 40px ${GROT}`), document.fonts?.load(`400 40px ${GROT}`),
  ].filter(Boolean)).catch(() => {});

  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';

  // Laid out from the bottom up: the footer and stats sit at fixed heights, the words above them take
  // what they need, and the painting gets the rest. A long title shrinks the painting, never the type.
  const LX = 80, RX = W - 80;
  // The whole title always shows: a long one gets smaller type rather than losing its last words.
  let size = story ? 74 : 56;
  const font = (em: boolean) => `${em ? 'italic ' : ''}${em ? 400 : 360} ${size}px ${SERIF}`;
  let lines = wrap(g, F.title, RX - LX, font);
  while (lines.length > 3 && size > (story ? 48 : 38)) { size -= 2; lines = wrap(g, F.title, RX - LX, font); }
  lines = lines.slice(0, 3);
  const lead = size * 1.04;
  const said = F.s.entries.length >= 4;
  const statsY = H - (story ? 280 : 118); // stories keep clear of the app's own bars, top and bottom
  const ruleY = statsY - (story ? 74 : 58);
  const charY = ruleY - (story ? 84 : 64);
  const lastY = said ? charY - (lead + (story ? 14 : 4)) : ruleY - (story ? 70 : 56);
  const titleY = lastY - (lines.length - 1) * lead;
  const meterY = titleY - (story ? 112 : 84);
  const artistY = meterY - (story ? 26 : 22);
  const nameY = artistY - (story ? 38 : 32);
  const PY = story ? 270 : 142;
  const PH = Math.min(Math.round((story ? 860 : 600) * 1.25), Math.round(nameY - (story ? 66 : 58) - PY));
  const PW = Math.round(PH / 1.25), PX = (W - PW) / 2;

  // The plate: the same 4:5 crop and patch grid the app shows.
  const [fx, fy] = F.painting.focus.split(' ').map((v) => parseFloat(v));
  const ax = fx < 35 ? 0 : fx > 65 ? 1 : 0.5, ay = fy < 35 ? 0 : fy > 65 ? 1 : 0.5;
  const clean = await loadImage(artSrc(F.painting.id, 'lg'));
  const dirtyCells = F.r.order.slice(F.r.restored);
  const grime = dirtyCells.length ? await varnish(F.painting.id, 900, 1125, ax, ay).then(loadImage).catch(() => null) : null;

  // Ground: warm black, a faint glow behind the painting, film grain.
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, PY + PH * 0.45, 40, W / 2, PY + PH * 0.45, W * 0.9);
  glow.addColorStop(0, 'rgba(120, 86, 40, 0.30)'); glow.addColorStop(1, 'rgba(18, 14, 9, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  // Header.
  const top = story ? 200 : 84;
  g.textBaseline = 'alphabetic';
  g.fillStyle = CREAM; g.font = `600 30px ${GROT}`; g.textAlign = 'left';
  g.fillText('CashGlome', LX, top);
  g.fillStyle = GOLD; g.font = `italic 400 32px ${SERIF}`; g.textAlign = 'right';
  g.fillText(`Chapter ${F.numeral} · ${F.month}`, RX, top);

  // The painting, with its varnish still on the patches not yet earned.
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.6)'; g.shadowBlur = 70; g.shadowOffsetY = 26;
  g.fillStyle = '#000'; g.fillRect(PX, PY, PW, PH);
  g.restore();
  cover(g, clean, PX, PY, PW, PH, ax, ay);
  if (grime && dirtyCells.length) {
    const m = Object.assign(document.createElement('canvas'), { width: COLS * 4, height: ROWS * 4 });
    const mg = m.getContext('2d')!; mg.fillStyle = '#fff';
    for (const i of dirtyCells) mg.fillRect((i % COLS) * 4, Math.floor(i / COLS) * 4, 4, 4);
    const v = Object.assign(document.createElement('canvas'), { width: PW, height: PH });
    const vg = v.getContext('2d')!;
    vg.imageSmoothingQuality = 'high';
    vg.drawImage(grime, 0, 0, PW, PH);
    vg.globalCompositeOperation = 'destination-in';
    vg.imageSmoothingEnabled = true;
    vg.drawImage(m, 0, 0, PW, PH); // smoothing feathers the patch edges, as in the app
    g.drawImage(v, PX, PY);
  }
  g.strokeStyle = 'rgba(212, 174, 94, 0.55)'; g.lineWidth = 2;
  g.strokeRect(PX - 14, PY - 14, PW + 28, PH + 28);

  // Museum label under the painting.
  g.textAlign = 'left'; g.fillStyle = CREAM; g.font = `italic 400 ${story ? 36 : 30}px ${SERIF}`;
  let name = F.painting.title;
  const room = RX - LX - 250;
  if (g.measureText(name).width > room) {
    while (name.length > 8 && g.measureText(name + '…').width > room) name = name.slice(0, -1);
    name = name.trimEnd() + '…';
  }
  g.fillText(name, LX, nameY);
  g.textAlign = 'right'; g.font = `600 ${story ? 24 : 21}px ${GROT}`; g.fillStyle = F.r.complete ? GOLD2 : MUTED;
  g.fillText(F.r.complete ? 'Fully restored' : `${F.r.restored} of ${PATCHES} restored`, RX, nameY);
  g.textAlign = 'left'; g.fillStyle = MUTED; g.font = `400 ${story ? 24 : 21}px ${GROT}`;
  g.fillText(`${F.painting.artist}, ${F.painting.year}`, LX, artistY);
  const bw = (RX - LX) / PATCHES;
  for (let i = 0; i < PATCHES; i++) { g.fillStyle = i < F.r.restored ? GOLD : FAINT; g.fillRect(LX + i * bw + 1.5, meterY, bw - 3, 5); }

  // The chapter's title, in the app's own voice.
  let y = titleY;
  for (const line of lines) {
    let x = LX;
    for (const run of line) { g.font = font(run.em); g.fillStyle = run.em ? GOLD2 : CREAM; g.fillText(run.t, x, y); x += run.w; }
    y += lead;
  }

  // Who you were this month.
  if (said) {
    g.font = `italic 400 ${story ? 36 : 29}px ${SERIF}`; g.fillStyle = MUTED;
    g.fillText(`This month I was ${F.character.name.replace(/^The /, 'the ')}.`, LX, charY);
  }

  // Plain numbers. Amounts only if asked for.
  const stats: { big: string; small: string; dot?: string }[] = [
    { big: String(F.s.entries.length), small: F.s.entries.length === 1 ? 'entry written' : 'entries written' },
    { big: String(F.s.daysLogged), small: F.s.daysLogged === 1 ? 'day written' : 'days written' },
  ];
  if (F.candle) stats.push({ big: String(F.candle), small: 'day candle' });
  if (F.top) stats.push({ big: F.top.name, small: `${F.top.pct}% of spending`, dot: F.top.color });
  if (amounts) {
    stats.length = Math.min(stats.length, 2);
    stats.push({ big: money(F.s.spend, cur, { compact: F.s.spend >= 1e6 }), small: 'spent' });
    if (F.s.inflow > 0) stats.push({ big: money(Math.max(0, F.s.inflow - F.s.outflow), cur, { compact: F.s.inflow >= 1e6 }), small: 'kept' });
  }
  const shown = stats.slice(0, 4);
  g.strokeStyle = FAINT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(LX, ruleY); g.lineTo(RX, ruleY); g.stroke();
  y = statsY;
  const colW = (RX - LX) / shown.length;
  shown.forEach((st, i) => {
    const x = LX + i * colW;
    let big = st.big, bsz = story ? 50 : 40;
    g.font = `600 ${bsz}px ${GROT}`;
    while (g.measureText(big).width > colW - (st.dot ? 40 : 18) && bsz > 26) { bsz -= 2; g.font = `600 ${bsz}px ${GROT}`; }
    let tx = x;
    if (st.dot) { g.fillStyle = st.dot; g.beginPath(); g.arc(x + 9, y - bsz * 0.34, 9, 0, Math.PI * 2); g.fill(); tx += 28; }
    g.fillStyle = CREAM; g.fillText(big, tx, y);
    g.font = `400 ${story ? 22 : 19}px ${GROT}`; g.fillStyle = MUTED;
    g.fillText(st.small, x, y + (story ? 36 : 30));
  });

  // Footer: where to start your own.
  g.textAlign = 'center'; g.font = `400 ${story ? 24 : 21}px ${GROT}`; g.fillStyle = MUTED;
  g.fillText(`Write your month at ${SHARE_HOST}`, W / 2, H - (story ? 192 : 50));

  // Grain last, so the type sits in the same film as the paint.
  g.fillStyle = g.createPattern(grainTile(), 'repeat')!;
  g.fillRect(0, 0, W, H);
  return c;
}

export const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Could not draw the card'))), 'image/png'));

export function shareText(state: State, month = state.month, title?: Seg[]) {
  const F = cardFacts(state, month, title);
  const t = F.title.map((x) => x.t).join('');
  return `My ${F.month.split(' ')[0]} in CashGlome: ${t} ${F.r.complete ? `I restored ${F.painting.artist}'s ${F.painting.title}.` : ''}`.trim();
}
