import { CURRENCIES, currencySymbol } from '../lib/format';

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];

/** "Saturday, the fourteenth of November" */
export function dateInWords(d = new Date()) {
  return `${d.toLocaleDateString('en', { weekday: 'long' })}, the ${ORD[d.getDate()]} of ${d.toLocaleDateString('en', { month: 'long' })}`;
}

/** A sum written the way people write it: 4.5k, 350k, 1.2m. */
function short(n: number) {
  const r = (x: number) => (x >= 100 ? Math.round(x / 10) * 10 : x >= 10 ? Math.round(x) : Math.round(x * 2) / 2);
  if (n >= 1e6) return `${r(n / 1e6)}m`;
  if (n >= 1e3) return `${r(n / 1e3)}k`;
  return `${r(n)}`;
}

/** Example lines in the person's own money, so the first tap writes something believable anywhere. */
export function examplesFor(currency: string): string[] {
  const k = CURRENCIES.find((c) => c.code === currency)?.scale ?? 1;
  const s = (usd: number) => short(usd * k);
  const sym = k <= 1.6 ? currencySymbol(currency) : '';
  return [
    `bus ${sym}${s(1.5)}, lunch ${sym}${s(4)}, got paid ${sym}${s(240)}`,
    `groceries ${sym}${s(22)}, sent mum ${sym}${s(30)}`,
    `coffee ${sym}${s(3)}, rent ${sym}${s(300)}`,
  ];
}
