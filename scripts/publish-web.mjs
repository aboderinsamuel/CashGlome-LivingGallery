// Builds the web app into the website's app/ folder (served at cashglome.vercel.app/app/).
// Run from this folder, with cashglome-site checked out next to it:  node scripts/publish-web.mjs
// Then commit and push cashglome-site; Vercel redeploys it.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.resolve(root, process.argv[2] || '../cashglome-site');
const out = path.join(site, 'app');
if (!existsSync(path.join(site, 'index.html'))) {
  console.error(`No website found at ${site}. Pass its folder: node scripts/publish-web.mjs <path-to-cashglome-site>`);
  process.exit(1);
}

// Read .env.local the way Vite does (only to report and to check; Vite reads it itself).
const env = {};
const file = path.join(root, '.env.local');
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trimStart().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

// Anything starting with VITE_ ends up inside the app for anyone to read. Secrets never belong there.
const leaks = Object.entries(env).filter(([k, v]) => k.startsWith('VITE_') && v && (/META.*KEY|SECRET|SERVICE_ROLE|PASSWORD/.test(k) || /service_role|sb_secret_/.test(v)));
if (leaks.length) {
  console.error(`Stopped: ${leaks.map(([k]) => k).join(', ')} would be published inside the app for anyone to read.`);
  console.error('Keep secrets in Vercel environment variables, and never put the Supabase service_role / secret key in the app.');
  process.exit(1);
}

const on = (k) => (env[k] ? 'on ' : 'off');
console.log(`Accounts & sync (Supabase): ${on('VITE_SUPABASE_URL')}  ${env.VITE_SUPABASE_URL || ''}`);
if (!!env.VITE_SUPABASE_URL !== !!env.VITE_SUPABASE_ANON_KEY) {
  console.error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or neither.');
  process.exit(1);
}

execSync(`npx tsc --noEmit`, { cwd: root, stdio: 'inherit' });
execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { cwd: root, stdio: 'inherit' });

// The anon key is fine to publish; make sure nothing secret slipped through anyway.
const js = readdirSync(path.join(out, 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(path.join(out, 'assets', f), 'utf8')).join('\n');
if (/service_role|sb_secret_/.test(js)) { console.error('Stopped: a secret key ended up in the build. Delete app/ and check .env.local.'); process.exit(1); }

console.log(`\nBuilt into ${out}\nNext: in ${site}, commit app/ and push. Vercel redeploys in about a minute.`);
