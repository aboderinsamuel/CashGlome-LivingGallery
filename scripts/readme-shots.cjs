// Renders the README's pictures from the real app: a banner, and screenshots of a seeded example world.
// Needs the dev server running (npm run dev). Run: npx electron scripts/readme-shots.cjs [http://localhost:5173]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'docs', 'assets');
const base = process.argv.find((a) => /^https?:\/\//.test(a)) || 'http://localhost:5173/';
fs.mkdirSync(out, { recursive: true });
app.disableHardwareAcceleration();
setTimeout(() => { console.log('timeout'); app.exit(1); }, 180000);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fileURL = (p) => 'file:///' + p.split(path.sep).join('/');

// The example world: a month of entries, and a memory that says how the days go.
const SEED = `(async () => {
  const S = await import('/src/lib/store.ts'), D = await import('/src/lib/demo.ts'), M = await import('/src/lib/memory.ts');
  const st = S.initialState();
  st.profile = { ...st.profile, name: 'Ada', currency: 'USD', onboarded: true };
  st.settings = { ...st.settings, theme: 'dark', sound: false, wallpaper: 'season' };
  st.entries = D.demoEntries('USD');
  const t0 = Date.now() - 3600e3;
  st.memories = ['I have 1,800 in my account', 'I spend 12 on the train every weekday at 6pm', 'Lunch 14 every weekday at 1pm', 'I get paid 3,200 on the 28th', 'Rent 1,400 on the 1st', 'I\\'m saving for a trip to Lisbon in spring']
    .map((t, i) => ({ ...M.readMemory(t), createdAt: t0 + i, updatedAt: t0 + i, asOf: t.includes('account') ? t0 : undefined, since: '2026-11-01' }));
  st.seenBadges = ['first'];
  // The routine days so far are already answered, so no check-ins cover the screenshots.
  st.routineLog = Object.fromEntries(M.dueRoutines(st).map((d) => [d.key, 'done']));
  localStorage.setItem('cashglome.v1', JSON.stringify(st));
  localStorage.setItem('cg-hint-seen', '1');
  return 'seeded';
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(30);
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name, rect, quality = 86) => {
    await wait(900);
    const img = await win.webContents.capturePage(rect);
    fs.writeFileSync(path.join(out, name), name.endsWith('.png') ? img.toPNG() : img.toJPEG(quality));
    console.log('wrote', name, img.getSize());
  };
  const click = (text, sel = 'button, .side-item') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); b?.click(); return !!b; })()`);

  // 1. Banner: a painting, the name, one line.
  const art = path.join(root, 'public', 'art', 'moneylender.jpg');
  const fonts = path.join(root, 'node_modules', '@fontsource-variable');
  const html = `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: N; src: url('${fileURL(path.join(fonts, 'newsreader', 'files', 'newsreader-latin-opsz-normal.woff2'))}'); font-weight: 200 800; }
    @font-face { font-family: N; font-style: italic; src: url('${fileURL(path.join(fonts, 'newsreader', 'files', 'newsreader-latin-opsz-italic.woff2'))}'); font-weight: 200 800; }
    @font-face { font-family: G; src: url('${fileURL(path.join(fonts, 'schibsted-grotesk', 'files', 'schibsted-grotesk-latin-wght-normal.woff2'))}'); font-weight: 400 900; }
    html, body { margin: 0; width: 1600px; height: 640px; background: #0E0A06; overflow: hidden; }
    .art { position: absolute; inset: 0 0 0 auto; width: 980px; background: url('${fileURL(art)}') 60% 35% / cover; filter: saturate(1.05) contrast(1.04); }
    .art::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #0E0A06 0%, rgba(14,10,6,.86) 22%, rgba(14,10,6,.25) 62%, rgba(14,10,6,.05)), linear-gradient(0deg, rgba(14,10,6,.75), transparent 40%); }
    .grain { position: absolute; inset: 0; opacity: .13; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E"); mix-blend-mode: overlay; }
    .t { position: absolute; left: 92px; top: 112px; color: #F6EEDC; }
    .k { font: 600 17px G; letter-spacing: .14em; text-transform: uppercase; color: #D9B45B; }
    h1 { margin: 22px 0 0; font: 330 154px/.86 N; letter-spacing: -.055em; }
    h1 em { color: #E9C75B; font-weight: 300; }
    p { margin: 34px 0 0; max-width: 560px; font: 400 29px/1.32 N; color: rgba(246,238,220,.84); letter-spacing: -.01em; }
    .rule { position: absolute; left: 92px; bottom: 72px; display: flex; gap: 26px; font: 500 16px G; color: rgba(246,238,220,.62); }
    .rule b { color: #F6EEDC; font-weight: 600; }
    .credit { position: absolute; right: 30px; bottom: 26px; font: italic 400 15px N; color: rgba(246,238,220,.6); }
  </style><div class="art"></div><div class="grain"></div>
  <div class="t"><div class="k">A living money world</div><h1>Cash<em>Glome</em></h1><p>Write what came in and what went out. Watch the month become a painting you restore.</p></div>
  <div class="rule"><span><b>Type</b>, say, or snap it</span><span><b>Remembers</b> your routine</span><span><b>Knows</b> if you can afford it</span></div>
  <div class="credit">Quentin Matsys, The Moneylender and his Wife, 1514</div>`;
  const bannerFile = path.join(app.getPath('temp'), 'cg-banner.html');
  fs.writeFileSync(bannerFile, html);
  win.setContentSize(1600, 640);
  await win.loadURL(fileURL(bannerFile));
  await js('document.fonts.ready.then(() => 1)');
  await shot('banner.jpg', undefined, 88);

  // 2. The app, seeded.
  win.setContentSize(1440, 900);
  await win.loadURL(base);
  await wait(1500);
  console.log(await js(SEED));
  await win.loadURL(base);
  await wait(5000);
  await shot('desktop.jpg');

  // Inside the window: open views from the sidebar.
  await click('Memory'); await wait(1800);
  await js(`document.querySelector('.main')?.scrollTo({ top: 0 })`);
  await shot('memory.jpg');
  await js(`document.querySelector('.mem-grid')?.scrollIntoView({ block: 'center' })`);
  await wait(800);
  const g = await js(`(() => { const grid = document.querySelector('.mem-grid'); const s = grid.closest('section').getBoundingClientRect(), b = grid.getBoundingClientRect(); return { x: Math.round(s.x - 24), y: Math.round(s.y - 20), width: Math.round(s.width + 48), height: Math.round(b.bottom - s.y + 44) }; })()`);
  await shot('memory-cards.jpg', g);
  await js(`(() => { const i = document.querySelector('.mem-think input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'headphones 1700'); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.mem-purse').scrollIntoView({ block: 'center' }); })()`);
  await wait(1500);
  const r = await js(`(() => { const b = document.querySelector('.mem-purse').getBoundingClientRect(); return { x: Math.round(b.x - 24), y: Math.round(b.y - 90), width: Math.round(b.width + 48), height: Math.round(b.height + 114) }; })()`);
  await shot('purse.jpg', r);

  await click('This chapter'); await wait(2500);

  // Ask, answered on the device from the memory.
  await js(`document.querySelector('button[title^="Ask about your money"]')?.click()`);
  await wait(900);
  await js(`(async () => { const i = document.querySelector('.ask-input input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Can I afford a 90 dinner on Saturday?'); i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 200)); document.querySelector('.ask-input').requestSubmit(); })()`);
  await wait(2200);
  const a = await js(`(() => { const b = document.querySelector('.panel.ask').getBoundingClientRect(); return { x: Math.round(b.x - 20), y: Math.round(b.y - 20), width: Math.round(b.width + 40), height: Math.round(b.height + 40) }; })()`);
  await shot('ask.jpg', a);
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

  // The share card, drawn exactly as people would post it.
  const card = await js(`(async () => { const st = JSON.parse(localStorage.getItem('cashglome.v1')); const m = await import('/src/lib/sharecard.ts'); const c = await m.drawCard({ state: st, amounts: false, format: 'story' }); return c.toDataURL('image/jpeg', 0.86); })()`);
  fs.writeFileSync(path.join(out, 'share-story.jpg'), Buffer.from(card.split(',')[1], 'base64'));
  console.log('wrote share-story.jpg');

  // A routine check-in, as it appears above the composer.
  await js(`(() => { const st = JSON.parse(localStorage.getItem('cashglome.v1')); const tr = st.memories.find((m) => m.label === 'Train'); const d = new Date(); const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); st.routineLog[tr.id + '@' + iso] = 'pending'; localStorage.setItem('cashglome.v1', JSON.stringify(st)); })()`);
  await win.loadURL(base);
  await wait(4500);
  const ci = await js(`(() => { const b = document.querySelector('.checkin').getBoundingClientRect(); return { x: Math.round(b.x - 30), y: Math.round(b.y - 30), width: Math.round(b.width + 60), height: Math.round(b.height + 110) }; })()`);
  await shot('checkin.jpg', ci);

  app.quit();
});
