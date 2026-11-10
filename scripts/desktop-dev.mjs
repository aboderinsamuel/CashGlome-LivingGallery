// Runs Vite and Electron together for desktop development.
import { spawn } from 'node:child_process';
const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'inherit', shell: true });
setTimeout(() => {
  const el = spawn('npx', ['electron', '.'], { stdio: 'inherit', shell: true, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
  el.on('exit', () => { vite.kill(); process.exit(0); });
}, 2500);
