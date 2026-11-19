// The Oracle: an offline natural-language money reader.
// Works instantly with no network; Florin (Gemini) refines it when connected.
//
// It answers three questions about anything written, said or pasted:
//   how much   findAmounts: "6k", "₦4,500", "five thousand naira", "R$ 45,90", an alert's "Amt:"
//   which way  direction:   who did the paying. "sent mum 20k" is out, "mum sent 20k" is in
//   how many   segments:    "bolt 6k lunch 4.5k, got paid 350k" is three entries
// Every rule here is pinned by tests/money-cases.mjs (npm run test:parser). Change a rule, run the tests.
import { CATEGORIES, cat } from './categories';
import type { Dir, Feeling, Parsed } from './types';
import { todayISO } from './format';
import { plain, tongueCategory, tongueDir, YESTERDAY } from './tongues';

export interface ReadOptions { /** The person's own currency: settles what a bare "$" or "£" means. */ home?: string }

/* ——— Spoken numbers: "four thousand five hundred" → "4500", so voice entries read like typed ones ——— */
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
const NUMBER_WORDS = [...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)].join('|');
const SCALE_NEXT = '(?=\\s+(?:hundred|thousand|million|billion)\\b)';
// A run of number words. Digits may join in when a scale word follows them ("5 thousand 5 hundred").
const NUM_WORD = new RegExp(`(?<![\\p{L}\\d.,])(?:(?:\\d+(?:\\.\\d+)?${SCALE_NEXT}|a|an|and|point|half|${NUMBER_WORDS})[\\s-]+)*(?:${NUMBER_WORDS})\\b`, 'giu');

export function spokenToDigits(text: string): string {
  return text.replace(NUM_WORD, (phrase: string, offset: number, whole: string) => {
    let words = phrase.toLowerCase().split(/[\s-]+/).filter(Boolean);
    // "n5 thousand", "₦4.5 million": the digits already carry the amount, the scale word is read with them.
    if (SCALES[words[0]] && /\d\s*$/.test(whole.slice(0, offset))) return phrase;
    const lead = words[0] === 'and' ? 'and ' : '';
    words = words.filter((w) => w !== 'and');
    let total = 0, cur = 0, scaled = false, frac = '', inFrac = false, any = false;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === 'half') { // "half a million"
        const s = SCALES[words[i + 2]];
        if ((words[i + 1] === 'a' || words[i + 1] === 'an') && s) { total += 0.5 * s; scaled = true; any = true; i += 2; continue; }
        return phrase;
      }
      if ((w === 'a' || w === 'an') && SCALES[words[i + 1]]) { cur = 1; continue; }
      if (w === 'a' || w === 'an') return phrase;
      if (w === 'point') { inFrac = true; continue; }
      if (inFrac) {
        if (UNITS[w] !== undefined && UNITS[w] < 10) { frac += UNITS[w]; continue; }
        if (SCALES[w] && frac) { total += parseFloat(`${cur}.${frac}`) * SCALES[w]; cur = 0; frac = ''; inFrac = false; scaled = true; continue; }
        return phrase;
      }
      if (/^\d/.test(w)) { cur += parseFloat(w); any = true; continue; }
      // "twelve fifty", "nine ninety nine": a price said the short way
      if (i === 1 && !scaled && cur > 0 && cur < 20 && TENS[w] !== undefined && !words.some((x) => SCALES[x])) {
        const cents = TENS[w] + (UNITS[words[2]] ?? 0);
        return `${lead}${cur}.${String(cents).padStart(2, '0')}`;
      }
      if (UNITS[w] !== undefined) { cur += UNITS[w]; any = true; }
      else if (TENS[w] !== undefined) { cur += TENS[w]; any = true; }
      else if (w === 'hundred') { cur = (cur || 1) * 100; scaled = true; any = true; }
      else if (SCALES[w]) { total += (cur || 1) * SCALES[w]; cur = 0; scaled = true; any = true; }
    }
    const value = total + cur;
    // Leave lone small words alone ("one coffee"), convert real amounts.
    if (!any || (!scaled && value < 20 && !frac)) return phrase;
    return lead + String(Math.round(value * 100) / 100) + (frac ? '.' + frac : '');
  });
}

/* ——— Numbers that are not money: dates, times, phone and reference numbers ——— */
const MONTH = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const MASKS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  new RegExp(`\\b\\d{1,2}[- ]?(?:${MONTH})\\b\\.?(?:[-/, ]+20\\d{2}\\b|[-/]\\d{2}\\b)?`, 'gi'),
  new RegExp(`\\b(?:${MONTH})\\b\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+20\\d{2}\\b)?(?![\\d,.]*\\d|\\s?[km]\\b)`, 'gi'),
  new RegExp(`\\b(?:${MONTH})\\b\\.?\\s+20\\d{2}\\b`, 'gi'),
  /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\b\.?)?/gi,
  /(?<![\d,.])\d{10,}(?![\d,.]*\d)/g,
];
// Only inside bank alerts: account and card numbers, masked or not, and reference numbers.
const ALERT_MASKS: RegExp[] = [
  /(?:\ba\/c|\bacct?|\bacc|\bac|\baccount|\bcard)\b\.?\s*(?:no\.?|number|ending(?: in)?)?\s*[:#.]*\s*(?=[xX*.]*[\d*])[\dxX*.]+/gi,
  /(?<![\p{L}])\d*[xX*]{2,}[.xX*]*\d+|\d+\.*[xX*]{2,}[.xX*\d]*/gu,
  /\b(?:ref(?:erence)?|txn id|transaction id|trans(?:action)? ref|session id|rrn|upi ref no)\b\.?\s*(?:no\.?)?\s*[:#]?\s*\d+/gi,
];
const blank = (m: string) => ' '.repeat(m.length);
const mask = (s: string, masks = MASKS) => masks.reduce((t, r) => t.replace(r, blank), s);

/* ——— Amounts ——— */
const CUR_PRE = 'R\\$|MX\\$|CA\\$|C\\$|AU\\$|A\\$|US\\$|GH₵|GH¢|GHC|E£|=N=|[₦$€£¥₹₵₩#]|NGN|USD|EUR|GBP|CAD|AUD|KES|KSH|GHS|ZAR|INR|JPY|BRL|MXN|AED|EGP|CNY|RMB|KRW|XOF|FCFA|CFA|TZS|TSH|SAR|RS\\.?|N(?=\\d)|R(?=\\d)';
// 1.500,00 (comma decimals) · 1,500.00 · 1500.00
const NUM = '\\d{1,3}(?:\\.\\d{3})*,\\d{2}(?!\\d)|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?';
const HEAD = new RegExp(`(?<![\\p{L}\\d.,])(?:(?<cur>${CUR_PRE})\\s?)?(?<num>${NUM})`, 'giu');
const SPACED = /(?: \d{3})+(?![\d,.])/y; // "R 5 000": spaces as thousands, only beside a currency
const MULT_RE = /(?:\s?(thousand|grand|million|mil|billion|bn)|\s?([km])(\d(?!\d))?|(b))(?![\p{L}\d])/iuy;
const SUF_RE = /\s?\(?(egyptian pounds?|canadian dollars?|australian dollars?|us dollars?|kenyan? shillings?|ghana(?:ian)? cedis?|south african rands?|mexican pesos?|naira|ngn|dollars?|usd|bucks?|euros?|eur|pounds?|gbp|quid|cad|aud|kes|ksh|shillings?|bob|ghs|cedis?|zar|rands?|inr|rupees?|jpy|yen|brl|reais|mxn|pesos?|aed|dirhams?|dhs|egp|yuan|kuai|rmb|cny|won|krw|fcfa|f cfa|cfa|francs?|xof|tsh|tzs|shilingi|riyals?|sar|rupaye|rupay|rupiya|ريال|درهم|دراهم|جنيه|रुपये|रुपए|रुपया|रु|[€₩])\)?(?![\p{L}\p{M}])|\s?(元|块钱|块|塊|人民币|円|圓|원)/iuy;
const MULT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9, thousand: 1e3, grand: 1e3, million: 1e6, mil: 1e6, billion: 1e9 };
const NOT_MONEY_AFTER = /^\s*(days?|weeks?|months?|years?|yrs?|hrs?|hours?|mins?|minutes?|nights?|times?|trips?|x\b|pcs|pieces|people|persons?|plates?|bottles?|packs?|cartons?|crates?|bags?|kg|g\b|gb|mb|liters?|litres?|am\b|pm\b|st\b|nd\b|rd\b|th\b|%)/i;

const DOLLARS = new Set(['USD', 'CAD', 'AUD', 'MXN']);
function currencyOf(token: string, home?: string): string | undefined {
  const t = token.toLowerCase().replace(/[.\s()]+/g, ' ').trim();
  if (t === '$' || /^(dollars?|bucks?)$/.test(t)) return home && DOLLARS.has(home) ? home : 'USD';
  if (t === '£' || /^pounds?$/.test(t)) return home === 'EGP' ? 'EGP' : 'GBP';
  if (/^(₦|=n=|#|n|ngn|naira)$/.test(t)) return 'NGN';
  if (/^(us\$|usd|us dollars?)$/.test(t)) return 'USD';
  if (/^(€|eur|euros?)$/.test(t)) return 'EUR';
  if (/^(gbp|quid)$/.test(t)) return 'GBP';
  if (/^(c\$|ca\$|cad|canadian dollars?)$/.test(t)) return 'CAD';
  if (/^(a\$|au\$|aud|australian dollars?)$/.test(t)) return 'AUD';
  if (/^(ksh|kes|bob|shillings?|kenyan? shillings?)$/.test(t)) return 'KES';
  if (/^(gh₵|gh¢|ghc|₵|ghs|cedis?|ghana(ian)? cedis?)$/.test(t)) return 'GHS';
  if (/^(r|zar|rands?|south african rands?)$/.test(t)) return 'ZAR';
  if (/^(₹|inr|rs|rupees?|rupaye|rupay|rupiya|रुपये|रुपए|रुपया|रु)$/.test(t)) return 'INR';
  if (t === '¥') return home === 'CNY' ? 'CNY' : 'JPY';
  if (/^(jpy|yen|円|圓)$/.test(t)) return 'JPY';
  if (/^(cny|rmb|yuan|kuai|元|块钱|块|塊|人民币)$/.test(t)) return 'CNY';
  if (/^(₩|krw|won|원)$/.test(t)) return 'KRW';
  if (/^(xof|fcfa|f cfa|cfa|francs?)$/.test(t)) return 'XOF';
  if (/^(tzs|tsh)$/.test(t)) return 'TZS';
  if (t === 'shilingi') return home === 'TZS' ? 'TZS' : 'KES';
  if (/^(sar|riyals?|ريال)$/.test(t)) return 'SAR';
  if (/^(r\$|brl|reais)$/.test(t)) return 'BRL';
  if (/^(mx\$|mxn|pesos?|mexican pesos?)$/.test(t)) return 'MXN';
  if (/^(aed|dhs|dirhams?|درهم|دراهم)$/.test(t)) return 'AED';
  if (/^(e£|egp|egyptian pounds?|جنيه)$/.test(t)) return 'EGP';
  return undefined;
}

export interface AmountHit { value: number; start: number; end: number; strong: boolean; currency?: string }

export function findAmounts(text: string, home?: string): AmountHit[] {
  const hits: AmountHit[] = [];
  HEAD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEAD.exec(text))) {
    const g = m.groups!;
    const start = m.index;
    let end = start + m[0].length;
    let num = g.num;
    if (g.cur && /^\d{1,3}$/.test(num)) {
      SPACED.lastIndex = end;
      const sp = SPACED.exec(text);
      if (sp) { num += sp[0]; end += sp[0].length; }
    }
    let v = /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(num) ? parseFloat(num.replace(/\./g, '').replace(',', '.')) : parseFloat(num.replace(/[,\s]/g, ''));
    let currency = g.cur ? currencyOf(g.cur, home) : undefined;
    let strong = !!g.cur || /[,\s]\d{3}/.test(num);
    MULT_RE.lastIndex = end;
    const mm = MULT_RE.exec(text);
    if (mm) {
      const word = (mm[1] ?? mm[2] ?? mm[4]).toLowerCase();
      v = v * MULT[word] + (mm[3] ? (Number(mm[3]) * MULT[word]) / 10 : 0); // "2k5" is 2,500
      end += mm[0].length; strong = true;
    }
    SUF_RE.lastIndex = end;
    const sm = SUF_RE.exec(text);
    if (sm) { currency = currencyOf(sm[1] ?? sm[2], home) ?? currency; end += sm[0].length; strong = true; }
    HEAD.lastIndex = end;
    const after = text.slice(end);
    // "2gb", "3rd", "5pm", "ps5": a number glued to letters is a thing, not a price ("5,000.00CR" on an alert is)
    if (!mm && !sm && /^\p{L}/u.test(after) && !/^(?:CR|DR)\b/.test(after)) continue;
    if (!g.cur && !mm && !sm && NOT_MONEY_AFTER.test(after)) continue;
    if (!isFinite(v) || v <= 0) continue;
    hits.push({ value: Math.round(v * 100) / 100, start, end, strong, currency });
  }
  return hits;
}

/* ——— Which numbers in a line are prices, and which is the price of this entry ——— */
const QTY_BEFORE = /(?:^|\b(?:bought|buy|got|get|sold|sell|ordered|for|of|and|with|x))\s*$/i;
const SPLIT_GUARD = /\b(instead of|rather than|out of|not|of my|of the|remaining|balance|change|left|vs|or)\b/i;
const TRAILING_FILLER = /\b(yesterday|today|tonight|last night|this (?:morning|afternoon|evening)|each|only|sha|o|worth it|no regrets?)\b|[^\p{L}]/giu;

function moneyHits(seg: string, home?: string): AmountHit[] {
  const hits = findAmounts(seg, home);
  if (hits.length < 2) return hits;
  return hits.filter((h, i) => {
    if (h.strong || !Number.isInteger(h.value)) return true;
    const bigger = hits.some((o) => o !== h && o.value >= h.value * 1000);
    if (h.value <= 50 && bigger) return false; // "iphone 15 pro 1.8m": a model number
    const next = hits[i + 1];
    if (next && !/\p{L}/u.test(seg.slice(h.end, next.start))) return false; // "table 4 2500"
    // "bought 2 shirts 45000": a small count after a verb, before a thing, beside a far larger number
    const counted = hits.some((o) => o !== h && o.value >= h.value * 20);
    const word = seg.slice(h.end).match(/^\s*(\p{L}+)/u)?.[1]?.toLowerCase();
    return !(h.value <= 20 && counted && QTY_BEFORE.test(seg.slice(0, h.start)) && word && !/^(on|for|to|at|from|in|naira)$/.test(word));
  });
}

function pickAmount(seg: string, money: AmountHit[]): AmountHit {
  if (money.length > 1 && SPLIT_GUARD.test(seg)) return money[0]; // "paid 5k out of 20k"
  return money.find((h) => h.strong) ?? money.reduce((a, b) => (b.value > a.value ? b : a));
}

/** "bolt 6k lunch 4.5k" and "5k bolt 3k lunch": several prices with words between them are several entries. */
function splitByAmounts(seg: string, home?: string): string[] {
  const money = moneyHits(seg, home);
  if (money.length < 2 || SPLIT_GUARD.test(seg)) return [seg];
  for (let i = 1; i < money.length; i++) if (!/\p{L}/u.test(seg.slice(money[i - 1].end, money[i].start))) return [seg];
  const tail = seg.slice(money[money.length - 1].end).replace(TRAILING_FILLER, '');
  const cuts = tail ? money.slice(1).map((h) => h.start) : money.slice(0, -1).map((h) => h.end);
  const out: string[] = [];
  let at = 0;
  for (const c of cuts) { out.push(seg.slice(at, c).trim()); at = c; }
  out.push(seg.slice(at).trim());
  return out.filter(Boolean);
}

/* ——— Which way the money went ——— */
type Cue = 'sell' | 'verb' | 'noun' | 'from' | 'none';
const set = (s: string) => new Set(s.split(' '));
const FIRST = set("i we me i've ive i'm im");
const SUBJ_FILLER = set('and then also so omo abeg sha chai oya well ok okay lol just don done dey go will has have had already finally today yesterday tonight morning evening afternoon night this last now na do did later again even still e o please pls the a an on at my our monday tuesday wednesday thursday friday saturday sunday');
// Verbs where money leaves whoever does them. Who that is decides the direction.
const GIVE = set('paid pay pays paying sent send sends sending gave give gives giving given transferred transfer transfers trf dashed dash gifted dropped drop lent lend tipped sprayed spray settled settle returned return repaid repay credited blessed bless forwarded remitted');
const NOUNY = set('gift gifts tip credit deposit payment'); // usually nouns: they only decide beside "me" or "from"
const TAKE = set('collect collected collects collecting');
const IN_VERB = set('received recieved receive receives earned earn won win wins');
const SELL = set('sold sell sells selling');
const OUT_VERB = set('withdrew withdraw withdrawn withdrawal spent spend spending bought buy buying purchased purchase ordered booked renewed subscribed lost lose debited debit donated donate wasted waste blew blow chop chopped flexed contributed contribute invested invest saved save recharged recharge loaded funded fueled fuelled repaired fixed charged deducted deduct removed remove cost costs stolen robbed scammed');
const BORROW = set('borrow borrowed borrows');
const REFUND_NOUN = set('refund refunds reversal rvsl cashback');
const REFUND_VERB = set('refunded reversed');
const PASSIVE = set("got get gets was were been being am i'm im");
const ADVERB = set('just finally also now been');
const GOT_SKIP = set('a an the my some another one alert gift transfer credit payment bonus refund of cash dash tip back');
const MADE_OUT = set('payment payments transfer deposit purchase contribution donation order withdrawal');
const THEM = set('customer customers client clients buyer buyers him her them');
const TRADE_SUBJECT = /^(customers?|clients?|buyers?)$/;
const IN_NOUN = /\b(salary|freelance|gig|adsense|sponsorship|brand deal|stipend|allowance|bonus|profits?|interest|dividends?|commission|winnings|royalties|income|revenue|sales|alert|wages|paycheck|grant|scholarship|pocket money)\b/;
const LOAN_IN = /\b(took|take|got|get|collected|collect|received|obtained)\b[^§]*\bloan\b|\bloan (from|disbursed|approved|credited)\b|\bloan\b.*\b(credited|disbursed|approved|landed)\b/;
const LANDED = /\b(money|cash|payment|funds?) (don )?(enter|entered|land|landed|drop|dropped|came in|come in|reflect|reflected)\b|\b(paid|cash|cashed) out\b|\bpayout\b|\bpay ?day\b/;
const TO_ME = /^(?:\s+\S+){0,5}?\s+(?:to|for)\s+(?:me|us|my (?:account|acct|wallet|opay|kuda|palmpay))\b/;
const FROM = /\bfrom\b(?! my\b)/;

const padded = (text: string) => ' ' + text.toLowerCase().replace(/[^\p{L}\p{N}&'\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
const hasWord = (t: string, w: string) => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ');
/** Does this name something money is spent on (rent, fuel, a shop)? People (mum, a friend) don't count. */
const OUT_THINGS = CATEGORIES.filter((c) => c.dir === 'out' && c.id !== 'giving' && c.id !== 'other');
const outThing = (text: string) => { const t = padded(text); return OUT_THINGS.some((c) => c.words.some((w) => hasWord(t, w))); };

function direction(seg: string, money: AmountHit[]): { dir: Dir; cue: Cue } {
  let t = seg;
  for (const h of [...money].sort((a, b) => b.start - a.start)) t = t.slice(0, h.start) + ' § ' + t.slice(h.end);
  const w = t.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}\p{N}§'\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const flat = w.join(' ');
  const yes = (dir: Dir, cue: Cue = 'verb') => ({ dir, cue });
  const far = tongueDir(t); // Spanish, Chinese, Arabic and the rest: each language's own verbs decide
  if (far) return yes(far);
  if (LOAN_IN.test(flat) || LANDED.test(flat)) return yes('in');

  const subject = (i: number): 'me' | 'thing' | 'other' => {
    const s = w.slice(0, i).filter((x) => !SUBJ_FILLER.has(x) && x !== '§' && !/\d/.test(x));
    if (!s.length || s.some((x) => FIRST.has(x))) return 'me';
    return outThing(s.join(' ')) ? 'thing' : 'other';
  };
  const beforeIs = (i: number, words: Set<string>) => words.has(w[i - 1]) || (ADVERB.has(w[i - 1]) && words.has(w[i - 2]));
  const toMe = (i: number) => w[i + 1] === 'me' || w[i + 1] === 'us' || ((w[i + 1] === 'to' || w[i + 1] === 'for') && (w[i + 2] === 'me' || w[i + 2] === 'us')) || TO_ME.test(' ' + w.slice(i + 1).join(' '));
  const rest = (i: number) => w.slice(i + 1).join(' ');

  for (let i = 0; i < w.length; i++) {
    const x = w[i];
    if (x === 'gimme') return yes('in');
    if (x === 'got' || x === 'get' || x === 'gotten') { // "got 45k" came in; "got 2 shirts 45k" was bought
      let j = i + 1;
      while (GOT_SKIP.has(w[j])) j++;
      if (w[j] === '§') return yes('in');
      continue;
    }
    if (x === 'made' || x === 'make') {
      let j = i + 1;
      while (w[j] === 'a' || w[j] === 'the' || w[j] === 'my') j++;
      if (MADE_OUT.has(w[j])) return yes('out');
      if (w[j] === '§' || w[j] === 'sales' || w[j] === 'profit' || w[j] === 'money') return yes('in');
      continue;
    }
    if (REFUND_NOUN.has(x)) return yes('in');
    if (REFUND_VERB.has(x)) return yes(w.slice(0, i).some((y) => FIRST.has(y)) || THEM.has(w[i + 1]) || w[i + 1] === 'the' ? 'out' : 'in');
    if (BORROW.has(x)) { // "borrow me 5k" and "borrowed 5k from Ada" come in; "I borrow Emeka 10k" is a loan given
      if (w[i + 1] === 'me' || w[i + 1] === 'us' || FROM.test(rest(i))) return yes('in');
      let j = i + 1;
      while (w[j] === 'a' || w[j] === 'the' || w[j] === 'some') j++;
      return yes(w[j] === '§' || w[j] === undefined ? 'in' : 'out');
    }
    if (IN_VERB.has(x)) return yes('in');
    if (SELL.has(x)) return yes('in', 'sell');
    if (TAKE.has(x)) return yes(subject(i) === 'me' ? 'in' : 'out'); // "I collect 30k" in; "police collect 2k" out
    if (NOUNY.has(x)) {
      if (beforeIs(i, PASSIVE) || toMe(i) || FROM.test(flat)) return yes('in');
      continue;
    }
    if (GIVE.has(x)) {
      if (beforeIs(i, PASSIVE)) return yes('in'); // "got paid", "was gifted"
      if (toMe(i)) return yes('in'); // "paid me", "sent 5k to me"
      if (w[i + 1] === 'from' && w[i + 2] !== 'my') return yes('in'); // "transfer from Kemi"
      if (w[i - 1] === 'to') return yes('out'); // "had to pay"
      const who = subject(i);
      if (who === 'me') return yes('out'); // "sent mum 20k"
      if (who === 'thing') return yes(IN_NOUN.test(rest(i)) ? 'in' : 'out'); // "rent paid 400k"
      return yes('in'); // "mum sent 20k"
    }
    if (OUT_VERB.has(x)) {
      if ((x === 'bought' || x === 'buy' || x === 'ordered') && w.slice(0, i).some((y) => TRADE_SUBJECT.test(y))) return yes('in', 'sell');
      return yes('out');
    }
  }
  if (IN_NOUN.test(flat)) return yes('in', 'noun');
  if (FROM.test(flat)) return outThing(flat) ? yes('out', 'from') : yes('in', 'from'); // "5k from Tunde" in; "lunch from kfc" out
  return yes('out', 'none');
}

/* ——— Feelings, dates, categories, labels ——— */
const JOY_RE = /(\bworth it\b|\bloved\b|\blove it\b|\bhappy\b|\bamazing\b|\bbest\b|❤️|😍|🥰|🔥|\benjoyed\b|\btreat(ed)? myself\b|\bno regrets?\b)/i;
const REGRET_RE = /(\bregret(ted|ting)?\b|\bwasted?\b|\bshouldn'?t have\b|\bunnecessary\b|\bimpulse\b|\bdumb\b|\bstupid\b|😩|😭|🤦|\bugh\b|\bscam(med)?\b|\boverpriced\b|\bwhy did i\b)/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseDate(text: string, now = new Date()): string {
  const t = text.toLowerCase();
  const d = new Date(now);
  if (/\byesterday\b|\blast night\b/.test(t) || YESTERDAY.test(t)) { d.setDate(d.getDate() - 1); return todayISO(d); }
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
  const t = padded(text);
  let best = { id: dir === 'in' ? 'windfall' : 'other', score: 0 };
  for (const c of CATEGORIES) {
    if (c.dir !== dir || c.hidden) continue;
    let s = 0;
    // Your own categories know their own name, and win a tie: you made them for a reason.
    for (const w of c.custom ? [...c.words, c.name.toLowerCase()] : c.words) if (hasWord(t, w)) s += (1 + w.length / 8) * (c.custom ? 1.5 : 1);
    if (s > best.score) best = { id: c.id, score: s };
  }
  // "Got paid 350k" on its own reads as wages; "got paid for X" as work done for someone.
  if (best.score === 0) { const far = tongueCategory(text, dir); if (far) best = { id: far, score: 1 }; }
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
  for (let i = 0; i < 3; i++) s = s.replace(FILLER, '').replace(/^(on|for|from|to|the|a|an|my|me|in|was|and)\s+/i, '').trim();
  s = s.replace(/[,.;:!—–\-\s]+$/g, '').replace(/\s+(for|on|to|from|at|with|of|in|by|me|was)$/i, '').trim();
  if (!s) return '';
  s = s.length > 46 ? s.slice(0, 44).trim() + '…' : s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ——— One entry from one piece of text ——— */
interface Read { parsed: Parsed; cue: Cue }

function readSegment(seg: string, raw: string, home?: string, prev?: Read): Read | null {
  const money = moneyHits(seg, home);
  if (!money.length) return null;
  const pick = pickAmount(seg, money);
  let { dir, cue } = direction(seg, money);
  let inherited: string | undefined;
  // "sold rice 40k and beans 25k": the beans were sold too.
  if (cue === 'none' && prev?.cue === 'sell' && !/\b(for|on|to|at)\b/i.test(seg)) { dir = 'in'; cue = 'sell'; inherited = prev.parsed.category; }

  const best = scoreCategory(seg, dir);
  const category = best.score === 0 && inherited ? inherited : best.id;
  const confidence = Math.min(0.97, (cue === 'none' ? 0.6 : cue === 'verb' || cue === 'sell' ? 0.9 : 0.8) + (best.score > 0 ? 0.07 : 0));
  let feeling: Feeling | undefined;
  if (REGRET_RE.test(seg)) feeling = 'regret';
  else if (JOY_RE.test(seg)) feeling = 'joy';
  const label = makeLabel(seg, findAmounts(seg, home)) || cat(category).name;
  return { cue, parsed: { amount: pick.value, dir, category, label, feeling, date: parseDate(raw), confidence, text: raw, source: 'oracle', currency: pick.currency } };
}

/* ——— Bank and wallet alerts: one message, one entry, never the balance ——— */
const ALERT_SIG = /\b(?:avail(?:able)?\.?\s*bal|avl\.?\s*bal|bal(?:ance)?\s*(?:is\b|:)|(?:new|current|your)\s+[\w-]{0,8}\s*balance|saldo|a\/c|acct?\s*[:.]|amt\s*[:.]|credit alert|debit alert|txn\s*:|(?:has been|was|were) (?:credited|debited|deducted)|(?:credited|debited) (?:to|from|with)|confirmed\.|you(?:'ve| have)? (?:just )?(?:received|sent|spent|paid|made)\b|pix (?:recebido|enviado)|payment (?:received|made) for|e-transfer)/i;
const ALERT_CRDR = /\b(?:DR|CR)\b/;
const isAlert = (s: string) => ALERT_SIG.test(s) || ALERT_CRDR.test(s);
const BAL_BEFORE = /(?:bal(?:ance)?|avail(?:able)?|avl|saldo(?:\s+disponible)?|total)\b[^\d\n]{0,24}$/i;
const AMT_BEFORE = /\b(?:amt|amount)\b\s*[:=]?\s*$/i;
const A_REVERSAL = /\b(?:revers\w*|rvsl|refund\w*|estorno|reembolso)\b/i;
const A_CREDIT = [/\bcredit(?:ed)?\b/i, /\bCR\b/];
const A_DEBIT = [/\bdebit(?:ed)?\b/i, /\bDR\b/];
const A_IN = [/\b(?:received|recieved|deposit(?:ed)?|paid in(?:to)?|transfer(?:red)? (?:of [^.\n]{0,30}? )?from|trf (?:from|frm)|frm|inflow|recebido|recebeu|recibiste|abono|salary)\b/i];
const A_OUT = [/\b(?:sent|spent|purchase|paid (?:to|from|for)|payment (?:made|to)|you paid|made a [^.\n]{0,24}(?:transaction|purchase|payment)|pos|withdraw(?:al|n)?|wdl|atm|deducted|charged?|transfer(?:red)? (?:of [^.\n]{0,30}? )?to|trf to|bought|compra|enviado|pagaste|retiro|airtime)\b/i];
const firstAt = (s: string, res: RegExp[]) => res.reduce((at, r) => { const i = s.search(r); return i >= 0 && i < at ? i : at; }, Infinity);
const tidy = (s: string) => { const t = s.replace(/[/_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 46); return t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()) : t; };

function alertDir(s: string): Dir | undefined {
  if (A_REVERSAL.test(s)) return 'in';
  for (const [ins, outs] of [[A_CREDIT, A_DEBIT], [A_IN, A_OUT]]) {
    const i = firstAt(s, ins), o = firstAt(s, outs);
    if (i !== o) return i < o ? 'in' : 'out';
  }
  return undefined;
}

function readAlert(chunk: string, home?: string): Parsed | null {
  const s = mask(mask(chunk, ALERT_MASKS));
  const live = findAmounts(s, home).filter((h) => !BAL_BEFORE.test(s.slice(Math.max(0, h.start - 36), h.start)));
  const pick = live.find((h) => AMT_BEFORE.test(s.slice(Math.max(0, h.start - 12), h.start))) ?? live.find((h) => h.currency) ?? live[0];
  if (!pick) return null;
  // amounts out of the way, so "Transfer of ₦8,000.00 to KEMI" reads as "transfer of § to"
  const bare = findAmounts(s, home).sort((x, y) => y.start - x.start).reduce((t, h) => t.slice(0, h.start) + '§' + t.slice(h.end), s);
  const dir = alertDir(bare) ?? direction(s, [pick]).dir;
  const desc = chunk.match(/\b(?:desc|des|narration|narr|remarks?)\s*[:-]\s*([^\n]+)/i)?.[1].split(/\.\s|\s(?=(?:avail|bal|date|time|ref)\b)/i)[0]
    ?? chunk.match(/\b(?:from|to|at|with|de|en)\s+(\p{Lu}[\p{Lu}\d .&'-]{2,40})/u)?.[1];
  const label = desc ? tidy(desc.replace(/[\s.,-]+$/, '')) : dir === 'in' ? 'Bank credit' : 'Bank debit';
  const best = scoreCategory(desc ?? '', dir);
  return { amount: pick.value, dir, category: best.id, label: label || (dir === 'in' ? 'Bank credit' : 'Bank debit'), date: todayISO(), confidence: 0.95, text: chunk.trim(), source: 'oracle', currency: pick.currency };
}

/** Several alerts pasted together: blank lines part them, and so does one alert per line. */
function alertChunks(text: string): string[] {
  return text.split(/\n\s*\n/).flatMap((chunk) => {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    const whole = lines.every((l) => isAlert(l) && readAlert(l) && alertDir(l.replace(/[d.,]+/g, '§')));
    return lines.length > 1 && whole ? lines : [chunk];
  }).filter((c) => c.trim());
}

/* ——— The story of a day, split into its money moments ——— */
const JOIN = /,(?!\d)\s*|\.\s+|\s+(?:and then|then|also|plus|and|&|\+)\s+(?=\D*\d)/i;

function segments(text: string, home?: string): string[] {
  const lines = mask(spokenToDigits(text)).split(/\n|;|\s\|\s/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.split(JOIN).map((s) => s.trim()).filter(Boolean);
    const priced = parts.filter((p) => findAmounts(p, home).length);
    if (priced.length > 1) {
      // words with no amount ("went to the market,") belong to the amount that follows
      let carry = '';
      for (const p of parts) {
        if (findAmounts(p, home).length) { out.push(...splitByAmounts((carry + ' ' + p).trim(), home)); carry = ''; }
        else carry += ' ' + p;
      }
    } else out.push(...splitByAmounts(line, home));
  }
  return out;
}

export function splitStory(text: string): string[] {
  return alertChunks(plain(text)).flatMap((c) => (isAlert(c) ? [c.trim()] : segments(c)));
}

/** Everything in a piece of writing that moved money, in the order it was written. */
export function parseStory(text: string, opts: ReadOptions = {}): Parsed[] {
  const out: Parsed[] = [];
  for (const chunk of alertChunks(plain(text, opts.home))) {
    if (isAlert(chunk)) { const a = readAlert(chunk, opts.home); if (a) { out.push(a); continue; } }
    let prev: Read | undefined;
    for (const seg of segments(chunk, opts.home)) {
      const r = readSegment(seg, seg, opts.home, prev);
      if (r) out.push(r.parsed);
      prev = r ?? undefined;
    }
  }
  return out;
}

/** Reads the text as a single entry (the first amount that counts). */
export function parseOne(text: string, opts: ReadOptions = {}): Parsed | null {
  const raw = plain(text, opts.home).trim();
  if (!raw) return null;
  if (isAlert(raw)) { const a = readAlert(raw, opts.home); if (a) return a; }
  return readSegment(mask(spokenToDigits(raw)), raw, opts.home)?.parsed ?? null;
}
