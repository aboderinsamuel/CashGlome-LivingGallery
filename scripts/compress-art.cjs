// Resizes source paintings into public/art as compact JPEGs. Run: npx electron scripts/compress-art.cjs <srcDir>
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(() => {
  const src = process.argv[process.argv.length - 1];
  const out = path.join(__dirname, '..', 'public', 'art');
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.jpg'))) {
    const img = nativeImage.createFromPath(path.join(src, f));
    const { width, height } = img.getSize();
    const scale = Math.min(1, 1800 / Math.max(width, height));
    const r = scale < 1 ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' }) : img;
    const buf = r.toJPEG(76);
    fs.writeFileSync(path.join(out, f), buf);
    console.log(f, `${width}x${height}`, '->', JSON.stringify(r.getSize()), Math.round(buf.length / 1024) + 'KB');
  }
  app.quit();
});
