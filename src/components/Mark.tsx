// Small marks that recur everywhere, drawn as things from a studio rather than app chrome:
// a struck coin for a currency, an ink monogram for a person, a pan of pigment for a category.
import { cat } from '../lib/categories';
import { currencySymbol } from '../lib/format';

/** Dollars, pesos and others share a sign; on a coin the sign must say which one. */
const SHARED: Record<string, string> = { USD: 'US$', CAD: 'C$', AUD: 'A$', MXN: 'Mex$', BRL: 'R$', CNY: '元', JPY: '円', XOF: 'CFA', EGP: 'E£', SAR: 'SR', AED: 'Dh', TZS: 'TSh', KES: 'KSh', ZAR: 'R', GHS: '₵' };
export const coinMark = (code: string) => SHARED[code] ?? currencySymbol(code);

/** A struck coin: flat metal, an engraved rim, the sign in the middle. */
export function Medallion({ code, size = 30 }: { code: string; size?: number }) {
  const s = coinMark(code);
  const fs = s.length >= 4 ? size * 0.27 : s.length === 3 ? size * 0.31 : s.length === 2 ? size * 0.38 : size * 0.5;
  return (
    <span className="medal" style={{ width: size, height: size, fontSize: fs }} aria-hidden>
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="20" cy="20" r="19" className="medal-face" />
        <circle cx="20" cy="20" r="16.2" className="medal-rim" />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return <line key={i} x1={20 + Math.cos(a) * 17.4} y1={20 + Math.sin(a) * 17.4} x2={20 + Math.cos(a) * 18.6} y2={20 + Math.sin(a) * 18.6} className="medal-mill" />;
        })}
      </svg>
      <b>{s}</b>
    </span>
  );
}

/** A category as a dab of its pigment, with its initial scratched into it. */
export function Pigment({ category, size = 36 }: { category: string; size?: number }) {
  const c = cat(category);
  return (
    <span className="pigment" style={{ width: size, height: size, ['--pg' as string]: c.color, fontSize: size * 0.46 }} aria-hidden>
      <i>{c.name.trim()[0]}</i>
    </span>
  );
}
