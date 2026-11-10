import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { aiProxy } from './scripts/ai-proxy.mjs';

// Dev-time proxy so the browser can reach Meta's Model API without CORS issues.
const metaProxy = (): Plugin => ({
  name: 'cashglome-ai-proxy',
  configureServer(server) {
    server.middlewares.use('/__ai', aiProxy);
  },
  configurePreviewServer(server) {
    server.middlewares.use('/__ai', aiProxy);
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), metaProxy()],
  server: { port: 5173 },
});
