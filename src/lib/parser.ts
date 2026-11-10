// The Oracle: an offline natural-language money parser.
// Works instantly with no network; Meta Muse refines it when connected.
import { CATEGORIES, cat } from './categories';
import type { Dir, Feeling, Parsed } from './types';
import { todayISO } from './format';

const MULT: Record<string, number> = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9, thousand: 1e3, grand: 1e3, million: 1e6, mil: 1e6, billion: 1e9, bn: 1e9 };

const AMOUNT_RE = /(?<cur>[₦$€£¥₹]|ngn|usd|eur|gbp|ksh|kes|ghs|zar|inr|n(?=\d))?\s?(?<num>\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(?<mult>k|K|m|M|b|B|bn|thousand|grand|million|mil|billion)?(?![a-zA-Z])/gi;
const NOT_MONEY_AFTER = /^\s*(days?|weeks?|months?|years?|hrs?|hours?|mins?|minutes?|times?|x\b|pcs|pieces|people|plates?|bottles?|packs?|kg|g\b|liters?|litres?|am\b|pm\b|st\b|nd\b|rd\b|th\b|%)/i;

/* ——— Spoken numbers: "four thousand five hundred" → "4500", so voice entries read like typed ones ——— */
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
const NUMBER_WORDS = [...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)].join('|');
const NUM_WORD = new RegExp(`\\b(?:(?:a|an|and|point|${NUMBER_WORDS})[\\s-]+)*(?:${NUMBER_WORDS})\\b`, 'gi');

export function spokenToDigits(text: string): string {
  return text.replace(NUM_WORD, (phrase) => {
    const words = phrase.toLowerCase().split(/[\s-]+/).filter((w) => w && w !== 'and');
    let total = 0, cur = 0, scaled = false, frac = '', inFrac = false, any = false;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if ((w === 'a' || w === 'an') && SCALES[words[i + 1]]) { cur = 1; continue; }
      if (w === 'a' || w === 'an') return phrase;
      if (w === 'point') { inFrac = true; continue; }
      if (inFrac) {
        if (UNITS[w] !== undefined && UNITS[w] < 10) { frac += UNITS[w]; continue; }
        if (SCALES[w] && frac) { total += parseFloat(`${cur}.${frac}`) * SCALES[w]; cur = 0; frac = ''; inFrac = false; scaled = true; continue; }
        return phrase;
      }
      // "twelve fifty", "nine ninety nine": a price said the short way
      if (i === 1 && !scaled && cur > 0 && cur < 20 && TENS[w] !== undefined && !words.some((x) => SCALES[x] || x === 'hundred')) {
        const cents = TENS[w] + (UNITS[words[2]] ?? 0);
        return `${cur}.${String(cents).padStart(2, '0')}`;
      }
      if (UNITS[w] !== undefined) { cur += UNITS[w]; any = true; }
      else if (TENS[w] !== undefined) { cur += TENS[w]; any = true; }
      else if (w === 'hundred') { cur = (cur || 1) * 100; scaled = true; any = true; }
      else if (SCALES[w]) { total += (cur || 1) * SCALES[w]; cur = 0; scaled = true; any = true; }
    }
    const value = total + cur;
    // Leave lone small words alone ("one coffee"), convert real amounts.
    if (!any || (!scaled && value < 20 && !frac)) return phrase;
    return String(value) + (frac ? '.' + frac : '');
  });
}

export interface AmountHit { value: number; start: number; end: number; strong: boolean }

export function findAmounts(text: string): AmountHit[] {
  const hits: AmountHit[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const g = m.groups!;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!g.mult && NOT_MONEY_AFTER.test(text.slice(end))) continue;
    let v = parseFloat(g.num.replace(/[,\s]/g, ''));
    if (!isFinite(v)) continue;
    if (g.mult) v *= MULT[g.mult] ?? MULT[g.mult.toLowerCase()] ?? 1;
    hits.push({ value: v, start, end, strong: !!(g.cur || g.mult) || g.num.includes(',') });
  }
  return hits;
}

const PAID_IN = /\b(got|get|been|was|just got) paid\b|\bpaid me\b|\bsent me\b|\bgave me\b|\btransferred to me\b/gi;
const IN_RE = /\b(got paid|get paid|been paid|got|get|received|recieved|receive|earned|earn|paid me|pay me|sent me|send me|gave me|give me|transferred to me|credited|credit alert|salary|payday|income|refund(ed)?|reversal|sold|profit|allowance|bonus|won|winnings|payout|dividends?|interest|commission|cashback|came in|made|brand deal|invoice paid|client paid|blessed me|dashed me|sprayed me)\b/i;
const OUT_RE = /\b(spent|spend|spending|bought|buy|buying|paid|pay|paying|sent|send|gave|give|transfer(red)?( to)?|subscribed|subscription|lost|debited|debit alert|ordered|order for|booked|renewed|tipped|donated|for|on)\b/i;
const STRONG_OUT = /\b(spent|bought|paid for|paid|debited|ordered|lost)\b/i;

const JOY_RE = /(\bworth it\b|\bloved\b|\blove it\b|\bhappy\b|\bamazing\b|\bbest\b|❤️|😍|🥰|🔥|\benjoyed\b|\btreat(ed)? myself\b|\bno regrets?\b)/i;
const REGRET_RE = /(\bregret(ted|ting)?\b|\bwasted?\b|\bshouldn'?t have\b|\bunnecessary\b|\bimpulse\b|\bdumb\b|\bstupid\b|😩|😭|🤦|\bugh\b|\bscam(med)?\b|\boverpriced\b|\bwhy did i\b)/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseDate(text: string, now = new Date()): string {
  const t = text.toLowerCase();
  const d = new Date(now);
  if (/\byesterday\b|\blast night\b/.test(t)) { d.setDate(d.getDate() - 1); return todayISO(d); }
  const ago = t.match(/\b(\d+|a|one|two|three|four|five|six)\s+(day|days|week|weeks)\s+ago\b/);
  if (ago) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const n = words[ago[1]] ?? parseInt(ago[1], 10);
    d.setDate(d.getDate() - n * (ago[2].startsWith('week') ? 7 : 1));
    return todayISO(d);
  }
  if (/\blast week\b/.test(t)) { d.setDate(d.getDate() - 7); return todayISO(d); }
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b(on |last )?${w}\\b`).test(t));
  if (wd >= 0) {
    let diff = (d.getDay() - wd + 7) % 7;
    if (diff === 0 && /\blast\b/.test(t)) diff = 7;
    d.setDate(d.getDate() - diff);
    return todayISO(d);
  }
  return todayISO(now);
}

function scoreCategory(text: string, dir: Dir) {
  const t = ' ' + text.toLowerCase().replace(/[^\p{L}\p{N}&'\s]/gu, ' ') + ' ';
  let best = { id: dir === 'in' ? 'windfall' : 'other', score: 0 };
  for (const c of CATEGORIES) {
    if (c.dir !== dir) continue;
    let s = 0;
    for (const w of c.words) {
      if (t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ')) s += 1 + w.length / 8;
    }
    if (s > best.score) best = { id: c.id, score: s };
  }
  // "Got paid 350k" on its own reads as wages; "got paid for X" as work done for someone.
  if (dir === 'in' && best.score === 0 && /\b(got paid|paid me|pay ?day|earned)\b/.test(t)) best = { id: /\bfor\b/.test(t) ? 'craft' : 'salary', score: 0.5 };
  return best;
}

const FILLER = /^(i\s+)?(just\s+)?(spent|spend|bought|buy|paid|pay|got|get|received|recieved|earned|made|sent|gave|ordered|booked|renewed|subscribed to|transferred)\b\s*/i;

function makeLabel(text: string, hits: AmountHit[]) {
  let s = text;
  for (const h of [...hits].sort((a, b) => b.start - a.start)) s = s.slice(0, h.start) + ' ' + s.slice(h.end);
  s = s
    .replace(/\b(naira|dollars?|bucks|pounds?|euros?|cedis?|rand|shillings?|rupees?|yen)\b/gi, ' ')
    .replace(/\b(yesterday|today|last night|this morning|tonight|last week|\d+ days? ago)\b/gi, ' ')
    .replace(/[—–-]\s*(regret.*|worth it.*|loved it.*)$/i, ' ')
    .replace(/\b(worth it|no regrets?|regret(ted)?|loved it|ugh)\b/gi, ' ')
    .replace(/[😩😭🤦❤😍🥰🔥💼]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (let i = 0; i < 3; i++) s = s.replace(FILLER, '').replace(/^(on|for|from|to|the|a|an|my|me|in)\s+/i, '').trim();
  s = s.replace(/[,.;:!—–\-\s]+$/g, '').replace(/\s+(for|on|to|from|at|with|of|in|by|me)$/i, '').trim();
  if (!s) return '';
  s = s.length > 46 ? s.slice(0, 44).trim() + '…' : s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function parseOne(text: string): Parsed | null {
  const raw = spokenToDigits(text.trim());
  if (!raw) return null;
  const hits = findAmounts(raw);
  if (!hits.length) return null;
  const pick = hits.find((h) => h.strong) ?? hits.reduce((a, b) => (b.value > a.value ? b : a));

  const inHit = IN_RE.test(raw);
  const outHit = OUT_RE.test(raw);
  const strongOut = STRONG_OUT.test(raw.replace(PAID_IN, ' '));
  let dir: Dir = 'out';
  let confidence = 0.55;
  if (inHit && !strongOut) { dir = 'in'; confidence = 0.8; }
  else if (strongOut || outHit) { dir = 'out'; confidence = 0.8; }
  if (/\b(lost|loss)\b.*\b(bet|stake)/i.test(raw)) dir = 'out';
  if (/\b(won|winnings)\b/i.test(raw)) dir = 'in';

  let best = scoreCategory(raw, dir);
  // A strong category match in the opposite direction can flip an ambiguous entry.
  if (confidence < 0.7) {
    const other = scoreCategory(raw, dir === 'in' ? 'out' : 'in');
    if (other.score > best.score) { dir = dir === 'in' ? 'out' : 'in'; best = other; }
  }
  if (best.score > 0) confidence = Math.min(0.95, confidence + 0.12);

  let feeling: Feeling | undefined;
  if (REGRET_RE.test(raw)) feeling = 'regret';
  else if (JOY_RE.test(raw)) feeling = 'joy';

  const label = makeLabel(raw, hits) || cat(best.id).name;
  return { amount: Math.round(pick.value * 100) / 100, dir, category: best.id, label, feeling, date: parseDate(raw), confidence, text: raw, source: 'oracle' };
}

// Split a "story of my day" into individual money moments.
export function splitStory(text: string): string[] {
  const lines = spokenToDigits(text).split(/\n|;|\s\|\s/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.split(/,\s+|\.\s+|\s+(?:and then|then|also|plus|and)\s+(?=\D*\d)/i).map((s) => s.trim()).filter(Boolean);
    const withMoney = parts.filter((p) => findAmounts(p).length);
    if (withMoney.length > 1) {
      // keep context words for segments without an amount attached to the next one
      let carry = '';
      for (const p of parts) {
        if (findAmounts(p).length) { out.push((carry + ' ' + p).trim()); carry = ''; }
        else carry += ' ' + p;
      }
    } else out.push(line);
  }
  return out;
}

export function parseStory(text: string): Parsed[] {
  return splitStory(text).map(parseOne).filter((p): p is Parsed => !!p);
}
