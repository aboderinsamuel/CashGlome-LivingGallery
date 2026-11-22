// CashGlome desktop shell — frameless, macOS-styled on every platform.
const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require('electron');
const path = require('node:path');

// Screenshot runs get their own profile, so they never touch the data of an installed copy.
const SNAPSHOT = !app.isPackaged && process.env.CASHGLOME_SNAPSHOT;
if (SNAPSHOT) app.setPath('userData', path.join(app.getPath('temp'), 'cashglome-snapshot-profile'));

let win;
function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 26, y: 30 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14110D' : '#F6F2E8',
    show: false,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !SNAPSHOT,
    },
  });
  win.once('ready-to-show', () => win.show());
  // Dev aid (never in the installed app): CASHGLOME_SNAPSHOT=dir captures screenshots, then quits.
  // CASHGLOME_STEPS is a JSON array of { size?, js?, wait?, title?, out? } run in order after load.
  if (SNAPSHOT) {
    const fs = require('node:fs');
    const steps = JSON.parse(process.env.CASHGLOME_STEPS || '[{"wait":6000,"out":"shot.png"}]');
    win.webContents.once('did-finish-load', async () => {
      for (const st of steps) {
        if (st.size) { win.setMinimumSize(320, 480); win.setSize(st.size[0], st.size[1]); }
        if (st.js) { try { await win.webContents.executeJavaScript(st.js); } catch (e) { console.error(e); } }
        await new Promise((r) => setTimeout(r, st.wait ?? 1500));
        if (st.title) console.log('TITLE ' + win.webContents.getTitle());
        if (st.out) fs.writeFileSync(path.join(SNAPSHOT, st.out), (await win.webContents.capturePage()).toPNG());
      }
      app.quit();
    });
  }
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) win.loadURL(dev);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.on('maximize', () => win.webContents.send('win:state', 'max'));
  win.on('unmaximize', () => win.webContents.send('win:state', 'normal'));
  win.on('enter-full-screen', () => win.webContents.send('win:state', 'full'));
  win.on('leave-full-screen', () => win.webContents.send('win:state', 'normal'));
}

ipcMain.handle('win:close', () => win && win.close());
ipcMain.handle('win:minimize', () => win && win.minimize());
ipcMain.handle('win:zoom', () => {
  if (!win) return;
  if (process.platform === 'darwin') win.setFullScreen(!win.isFullScreen());
  else win.isMaximized() ? win.unmaximize() : win.maximize();
});

// Spotify sign-in (PKCE). The browser does the sign-in; this catches the redirect on a loopback port
// for a few minutes, then closes. Only Spotify's accounts site is ever opened, and only https.
let spotifyServer = null;
ipcMain.handle('spotify:auth', (_e, url) => new Promise((resolve) => {
  if (typeof url !== 'string' || !url.startsWith('https://accounts.spotify.com/authorize?')) return resolve({ error: 'Bad sign-in address' });
  if (spotifyServer) { try { spotifyServer.close(); } catch { /* already closed */ } }
  const http = require('node:http');
  let done = false;
  const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { spotifyServer.close(); } catch { /* fine */ } spotifyServer = null; resolve(r); };
  spotifyServer = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1:43821');
    if (u.pathname !== '/callback') { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><title>CashGlome</title><body style="font:16px system-ui;display:grid;place-items:center;height:90vh;color:#241a10;background:#f6f2e8"><p>Spotify is linked. You can close this tab and go back to CashGlome.</p>');
    finish({ code: u.searchParams.get('code'), state: u.searchParams.get('state'), error: u.searchParams.get('error') });
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  const timer = setTimeout(() => finish({ error: 'Sign-in timed out' }), 5 * 60000);
  spotifyServer.on('error', (err) => finish({ error: String(err.message || err) }));
  spotifyServer.listen(43821, '127.0.0.1', () => shell.openExternal(url));
}));
ipcMain.handle('spotify:token', async (_e, body) => {
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: String(body) });
    return await r.text();
  } catch (e) { return JSON.stringify({ error: String((e && e.message) || e) }); }
});

// Voice: offline dictation with the Windows recogniser (see speech.cjs).
const speech = require('./speech.cjs');
let stopListening = null;
ipcMain.handle('speech:start', (e) => {
  if (stopListening) stopListening();
  const send = (type, value) => { if (!e.sender.isDestroyed()) e.sender.send('speech:event', { type, value }); };
  stopListening = speech.listen(path.join(app.getPath('userData'), 'speech'), (type, value) => { if (type === 'end') stopListening = null; send(type, value); });
  return process.platform === 'win32';
});
ipcMain.handle('speech:stop', () => { if (stopListening) stopListening(); });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
