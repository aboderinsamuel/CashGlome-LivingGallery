// Builds the landing page's live reader from the app's own money reader, so what the website shows
// is exactly what the app does (same rules, same languages, same tests).
//   node scripts/build-site-reader.mjs [path-to-cashglome-site]
// Writes <site>/reader.js, which sets window.CGReader = { read(text, home) }.
import { build } from 'esbuild';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.resolve(root, process.argv[2] || '../cashglome-site');
if (!existsSync(path.join(site, 'index.html'))) {
  console.error(`No website found at ${site}. Pass its folder: node scripts/build-site-reader.mjs <path-to-cashglome-site>`);
  process.exit(1);
}
const out = path.join(site, 'reader.js');
await build({
  stdin: {
    contents: `
      import { parseStory } from './src/lib/parser';
      import { cat } from './src/lib/categories';
      /** Every entry in a line, as the app would file it. Runs in the page; nothing is sent anywhere. */
      export function read(text, home) {
        return parseStory(text, { home }).map((p) => {
          const c = cat(p.category);
          return { dir: p.dir, amount: p.amount, currency: p.currency, label: p.label, category: c.short, color: c.color };
        });
      }`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, minify: true, format: 'iife', globalName: 'CGReader', target: 'es2020', outfile: out, logLevel: 'error',
  banner: { js: "/* CashGlome's own money reader, built from the app (scripts/build-site-reader.mjs). Runs only in this page. */" },
});
console.log(`Wrote ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
