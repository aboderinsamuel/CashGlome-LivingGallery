// Fetches public-domain paintings from Wikimedia Commons at 1800px into a folder, checking each licence.
// Usage: node scripts/fetch-art.mjs <outDir>   (then: npx electron scripts/compress-art.cjs <outDir>)
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { LIBRARY } from './art-library.mjs';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const UA = { 'User-Agent': 'CashGlomeArtFetch/1.0 (public-domain art for an open-source app)' };
const API = 'https://commons.wikimedia.org/w/api.php';

async function find(q) {
  const u = new URL(API);
  Object.entries({ action: 'query', format: 'json', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '6', prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1800' })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  let j; for (let n = 0; ; n++) { const r = await fetch(u, { headers: UA }); const s = await r.text(); try { j = JSON.parse(s); break; } catch { if (n > 4) throw new Error('rate limited'); await new Promise((ok) => setTimeout(ok, 8000 * (n + 1))); } }
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages.find((p) => { const i = p.imageinfo?.[0]; return i && /jpeg|png/.test(i.mime) && i.width >= 900; });
}

const report = [];
for (const a of LIBRARY) {
  const file = path.join(out, a.id + '.jpg');
  if (existsSync(file)) { report.push(`${a.id}: kept`); continue; }
  try {
    const p = a.file ? await find(`"${a.file}"`) ?? await find(a.q) : await find(a.q);
    if (!p) { report.push(`${a.id}: NOT FOUND (${a.q})`); continue; }
    const i = p.imageinfo[0];
    const lic = (i.extmetadata?.LicenseShortName?.value ?? '?').replace(/<[^>]+>/g, '');
    if (!/public domain|pd|cc0/i.test(lic)) { report.push(`${a.id}: SKIPPED licence "${lic}" ${p.title}`); continue; }
    const buf = Buffer.from(await (await fetch(i.thumburl ?? i.url, { headers: UA })).arrayBuffer());
    writeFileSync(file, buf);
    report.push(`${a.id}: ${p.title} [${lic}] ${Math.round(buf.length / 1024)}KB`);
    await new Promise((r) => setTimeout(r, 2500));
  } catch (e) { report.push(`${a.id}: ERROR ${e.message}`); }
}
console.log(report.join('\n'));
