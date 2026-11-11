// Writes every test string as one JSON file, tests/money-cases.json: the contract any CashGlome money
// reader must pass, whatever language it is written in (this web app, the Android app, later iOS).
//   npm run export:cases
// Each case: { group, text, want: [{ dir: "in" | "out", amount, currency? }] }
import { writeFileSync } from 'node:fs';
import { CASES as main } from '../tests/money-cases.mjs';
import { CASES as holdout } from '../tests/holdout.mjs';

const want = (s) => s.split(',').map((tok) => {
  const m = tok.trim().match(/^([io])([\d.]+)(?::([A-Z]{3}))?$/);
  if (!m) throw new Error('Bad expectation: ' + tok);
  return { dir: m[1] === 'i' ? 'in' : 'out', amount: Number(m[2]), ...(m[3] ? { currency: m[3] } : {}) };
});
const cases = [...main, ...holdout].map(([group, text, expect]) => ({ group, text, want: want(expect) }));
writeFileSync('tests/money-cases.json', JSON.stringify({ version: 1, count: cases.length, cases }, null, 1) + '\n');
console.log(`Wrote ${cases.length} cases to tests/money-cases.json`);
