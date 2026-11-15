// Exports the README hero (docs/assets/hero.gif and a still) from scripts/hero/hero.html.
// Needs the dev server running. Run: npx electron scripts/make-hero.cjs [http://localhost:5190] [step]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, '..', 'docs', 'assets');
const base = (process.argv.find((a) => /^https?:\/\//.test(a)) || 'http://localhost:5190').replace(/\/$/, '');
const step = Number(process.argv.find((a) => /^\d$/.test(a)) || 1);
fs.mkdirSync(out, { recursive: true });
setTimeout(() => { console.log('timeout'); app.exit(1); }, 600000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1300, height: 600, show: false, webPreferences: { backgroundThrottling: false } });
  await win.loadURL(`${base}/scripts/hero/hero.html?export`);
  const js = (code) => win.webContents.executeJavaScript(code, true);
  for (let i = 0; i < 100 && (await js('document.title')) !== 'ready'; i++) await new Promise((r) => setTimeout(r, 200));
  fs.writeFileSync(path.join(out, 'hero-still.png'), Buffer.from(await js('hero.still(6.6)'), 'base64'));
  const t = Date.now();
  const gif = Buffer.from(await js(`hero.gif(${step})`), 'base64');
  fs.writeFileSync(path.join(out, 'hero.gif'), gif);
  console.log(`hero.gif ${(gif.length / 1048576).toFixed(2)} MB in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  app.exit(0);
});
