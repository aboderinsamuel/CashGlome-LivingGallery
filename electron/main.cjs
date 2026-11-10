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

// AI calls go through the main process: no CORS, key never leaves the machine except to the API.
ipcMain.handle('ai:chat', async (_e, { base, key, body }) => {
  const url = String(base || 'https://api.meta.ai/v1').replace(/\/+$/, '') + '/chat/completions';
  if (!/^https:\/\//.test(url)) return { ok: false, status: 400, text: 'Base URL must be https' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, text: await r.text() };
  } catch (e) {
    return { ok: false, status: 0, text: String((e && e.message) || e) };
  }
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
