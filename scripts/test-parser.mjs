// Scores the offline money reader against tests/money-cases.mjs.
//   npm run test:parser            summary by group
//   npm run test:parser -- -v      also list every miss
// Exits 1 when any in/out direction is wrong, so it can gate a release.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// tests/holdout.mjs was written after the reader, without looking at its rules: its first score (68/71) is the honest one.
const named = process.argv.filter((a) => a.endsWith('.mjs') && a.includes('tests'));
const files = named.length ? named : ['tests/money-cases.mjs', 'tests/holdout.mjs'];
const CASES = (await Promise.all(files.map((f) => import(pathToFileURL(join(process.cwd(), f)).href)))).flatMap((m) => m.CASES);

const verbose = process.argv.includes('-v');
const dir = mkdtempSync(join(tmpdir(), 'cg-parser-'));
const out = join(dir, 'parser.mjs');
await build({ entryPoints: [process.env.CG_PARSER ?? 'src/lib/parser.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { parseStory } = await import(pathToFileURL(out).href);

const want = (s) => s.split(',').map((tok) => {
  const m = tok.trim().match(/^([io])([\d.]+)(?::([A-Z]{3}))?$/);
  if (!m) throw new Error('Bad expectation: ' + tok);
  return { dir: m[1] === 'i' ? 'in' : 'out', amount: Number(m[2]), currency: m[3] };
});
const show = (items) => items.map((p) => `${p.dir === 'in' ? '+' : '−'}${p.amount}${p.currency ? ' ' + p.currency : ''}`).join(', ') || '(nothing)';

const groups = new Map();
const misses = [];
for (const [group, text, expect] of CASES) {
  const w = want(expect);
  let got = [];
  try { got = parseStory(text); } catch (e) { got = []; misses.push(`[${group}] CRASH ${JSON.stringify(text)}: ${e.message}`); }
  const same = got.length === w.length;
  const dirOk = same && w.every((x, i) => got[i].dir === x.dir);
  const amtOk = same && w.every((x, i) => Math.abs(got[i].amount - x.amount) < 0.005);
  const hasCur = w.some((x) => x.currency);
  const curOk = same && w.every((x, i) => !x.currency || got[i].currency === x.currency);
  const g = groups.get(group) ?? { n: 0, dir: 0, amt: 0, cur: 0, curN: 0, all: 0 };
  g.n++; g.dir += dirOk; g.amt += amtOk; if (hasCur) { g.curN++; g.cur += curOk; }
  g.all += dirOk && amtOk && (!hasCur || curOk);
  groups.set(group, g);
  if (!(dirOk && amtOk && (!hasCur || curOk))) {
    const why = [!dirOk && 'direction', !amtOk && 'amount', hasCur && !curOk && 'currency'].filter(Boolean).join('+');
    misses.push(`[${group}] ${why}: ${JSON.stringify(text)}\n      want ${show(w)}\n      got  ${show(got)}`);
  }
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1).padStart(5) + '%' : '    –');
const total = { n: 0, dir: 0, amt: 0, cur: 0, curN: 0, all: 0 };
console.log('\ngroup        cases   in/out   amount   currency   all right');
for (const [name, g] of groups) {
  for (const k of Object.keys(total)) total[k] += g[k];
  console.log(`${name.padEnd(12)} ${String(g.n).padStart(5)}   ${pct(g.dir, g.n)}   ${pct(g.amt, g.n)}   ${pct(g.cur, g.curN)}     ${pct(g.all, g.n)}`);
}
console.log(`${'TOTAL'.padEnd(12)} ${String(total.n).padStart(5)}   ${pct(total.dir, total.n)}   ${pct(total.amt, total.n)}   ${pct(total.cur, total.curN)}     ${pct(total.all, total.n)}`);
console.log(`\nin/out direction: ${total.dir}/${total.n} right, ${total.n - total.dir} wrong`);

// Speed: the reader runs on every keystroke, so one reading must cost far less than a frame (16 ms).
const texts = CASES.map((c) => c[1]);
const rounds = 40;
const t0 = performance.now();
for (let r = 0; r < rounds; r++) for (const t of texts) parseStory(t);
const each = (performance.now() - t0) / (rounds * texts.length);
console.log(`speed: ${each.toFixed(3)} ms per reading (${texts.length * rounds} readings)\n`);

// Voice: Android Chrome re-sends the whole sentence as each new "final" result. The transcript must not repeat.
const sp = join(dir, 'speech.mjs');
await build({ entryPoints: ['src/lib/speech.ts'], bundle: true, format: 'esm', platform: 'node', outfile: sp, logLevel: 'error' });
const { transcriptOf, stitch } = await import(pathToFileURL(sp).href);
const R = (list) => list.map(([t, f]) => ({ isFinal: f, 0: { transcript: t } }));
const voice = [
  ['android cumulative finals', R([['I', true], ['I', true], ['I spent', true], ['I spent', true], ['I spent 4,000', true], ['I spent 4,000 Naira', true], ['I spent 4,000 Naira on food', true]]), 'I spent 4,000 Naira on food'],
  ['android finals plus interim', R([['bolt', true], ['bolt 6k', true], ['bolt 6k lunch', false]]), 'bolt 6k lunch'],
  ['desktop separate phrases', R([['bolt 6k', true], [' lunch 4.5k', true], [' got paid', false]]), 'bolt 6k lunch 4.5k got paid'],
  ['same final delivered twice', R([['got paid 350k', true], ['got paid 350k', true]]), 'got paid 350k'],
  ['interim only', R([['sent mum', false]]), 'sent mum'],
];
let voiceBad = 0;
for (const [name, results, expect] of voice) {
  const { finals, interim } = transcriptOf(results);
  const got = stitch(finals, interim);
  if (got !== expect) { voiceBad++; misses.push(`[voice transcript] ${name}\n      want ${expect}\n      got  ${got}`); }
}
console.log(`voice transcript: ${voice.length - voiceBad}/${voice.length} right\n`);

if (verbose && misses.length) console.log(misses.join('\n') + '\n');
else if (misses.length) console.log(`${misses.length} cases not fully right. Run with -v to list them.\n`);
rmSync(dir, { recursive: true, force: true });
process.exit(total.dir === total.n && !voiceBad ? 0 : 1);
