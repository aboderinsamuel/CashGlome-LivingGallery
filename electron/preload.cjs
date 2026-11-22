const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('glome', {
  isDesktop: true,
  platform: process.platform,
  close: () => ipcRenderer.invoke('win:close'),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  zoom: () => ipcRenderer.invoke('win:zoom'),
  onState: (cb) => ipcRenderer.on('win:state', (_e, s) => cb(s)),
  spotifyAuth: (url) => ipcRenderer.invoke('spotify:auth', url),
  spotifyToken: (body) => ipcRenderer.invoke('spotify:token', body),
  speech: process.platform === 'win32' ? {
    start: () => ipcRenderer.invoke('speech:start'),
    stop: () => ipcRenderer.invoke('speech:stop'),
    on: (cb) => { const h = (_e, ev) => cb(ev); ipcRenderer.on('speech:event', h); return () => ipcRenderer.removeListener('speech:event', h); },
  } : undefined,
});
