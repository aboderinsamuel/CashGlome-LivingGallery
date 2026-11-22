// Production web server: serves the built app.
// Usage: npm run build && npm run serve   (PORT env optional)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.gz': 'application/gzip' };

http.createServer(async (req, res) => {
  let p = normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^[/\\]+/, '');
  let file = join(root, p);
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(root, 'index.html'); }
  try {
    const data = await readFile(file);
    res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(process.env.PORT || 4173, () => console.log('CashGlome on http://localhost:' + (process.env.PORT || 4173)));
