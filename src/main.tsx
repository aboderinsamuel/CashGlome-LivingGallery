import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/inter';
import './styles.css';
import './art.css';
import './mac.css';
import './phone/phone.css';
import './shell.css';
import App from './App';
// Folio, the design language, goes last so it sits over every view's own styles.
import './folio.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Installed or not, the app should open with no signal. Only on the built site, never in the desktop app.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.glome?.isDesktop) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* the app works without it */ }); });
}
