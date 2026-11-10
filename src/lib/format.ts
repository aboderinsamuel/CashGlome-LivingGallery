export const CURRENCIES: { code: string; name: string; flag: string; scale: number }[] = [
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬', scale: 1500 },
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸', scale: 1 },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺', scale: 0.92 },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧', scale: 0.78 },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦', scale: 1.37 },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺', scale: 1.5 },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪', scale: 130 },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭', scale: 15 },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦', scale: 18 },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳', scale: 84 },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵', scale: 150 },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷', scale: 5.5 },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽', scale: 18 },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪', scale: 3.67 },
  { code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬', scale: 49 },
];

export function guessCurrency(): string {
  try {
    const loc = navigator.language || 'en-US';
    const region = loc.split('-')[1]?.toUpperCase();
    const map: Record<string, string> = { NG: 'NGN', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', KE: 'KES', GH: 'GHS', ZA: 'ZAR', IN: 'INR', JP: 'JPY', BR: 'BRL', MX: 'MXN', AE: 'AED', EG: 'EGP', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR' };
    return (region && map[region]) || 'USD';
  } catch {
    return 'USD';
  }
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, compact: boolean, decimals: number) {
  const k = currency + compact + decimals;
  let f = fmtCache.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency', currency, currencyDisplay: 'narrowSymbol',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: decimals, minimumFractionDigits: 0,
      });
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals });
    }
    fmtCache.set(k, f);
  }
  return f;
}

export function money(n: number, currency: string, opts: { compact?: boolean; sign?: boolean } = {}) {
  const abs = Math.abs(n);
  const compact = opts.compact ?? false;
  const decimals = abs < 100 && abs % 1 !== 0 ? 2 : compact ? 1 : 0;
  const s = nf(currency, compact, decimals).format(abs);
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : '';
  return sign + s;
}

export function currencySymbol(currency: string) {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function todayISO(d = new Date()) {
  const z = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export const monthOf = (iso: string) => iso.slice(0, 7);
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return todayISO(d).slice(0, 7);
}
export function monthLabel(month: string, style: 'long' | 'short' = 'long') {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style, year: 'numeric' });
}
export function dayLabel(iso: string) {
  const today = todayISO();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === today) return 'Today';
  if (iso === todayISO(y)) return 'Yesterday';
  const [Y, M, D] = iso.split('-').map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
export function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
