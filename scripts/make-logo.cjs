// Renders the CashGlome logo (a gold florin in a wreath of painted flowers) with Electron's canvas.
// Run: npx electron scripts/make-logo.cjs [--sheet out.png]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
app.disableHardwareAcceleration();
setTimeout(() => { console.log('timeout'); app.exit(1); }, 40000);
app.whenReady().then(async () => {
  const debug = process.argv.indexOf('--sheet');
  const win = new BrowserWindow({ width: 1100, height: 1400, show: false, transparent: true, frame: false, webPreferences: { offscreen: true, webSecurity: false } });
  const src = 'file:///' + path.join(root, 'build', 'source', 'bosschaert-1618.jpg').split(path.sep).join('/');
  const page = 'file:///' + path.join(__dirname, 'logo.html').split(path.sep).join('/');
  const go = async (qs) => {
    await win.loadURL(`${page}?src=${encodeURIComponent(src)}&${qs}`);
    for (let i = 0; i < 100 && (await win.webContents.executeJavaScript('document.title')) !== 'ready'; i++) await new Promise((r) => setTimeout(r, 100));
    return win.webContents.executeJavaScript("document.getElementById('c').toDataURL('image/png')");
  };
  const save = (file, dataURL) => fs.writeFileSync(file, Buffer.from(dataURL.split(',')[1], 'base64'));
  if (debug > 0) save(process.argv[debug + 1], await go('debug=1'));
  else {
    save(path.join(root, 'build', 'icon.png'), await go('size=1024'));
    save(path.join(root, 'public', 'icon.png'), await go('size=512'));
    save(path.join(root, 'public', 'icon-64.png'), await go('size=64'));
    console.log('logo written');
  }
  app.quit();
});
