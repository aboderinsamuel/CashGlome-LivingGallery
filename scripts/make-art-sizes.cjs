// Makes smaller copies of the paintings so the app never decodes an 1800px file to show a 34px thumbnail.
//   public/art/<id>.jpg     1800px  full-bleed (wallpaper, Edition, welcome) and retina screens
//   public/art/md/<id>.jpg   960px  plates, cards, heroes on ordinary screens
//   public/art/sm/<id>.jpg   320px  thumbnails, dock icons, book covers, the blurred sidebar wall
// Usage: npx electron scripts/make-art-sizes.cjs
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'art');
const sizes = { md: [960, 82], sm: [320, 80] };

app.whenReady().then(() => {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jpg'))) {
    const img = nativeImage.createFromPath(path.join(dir, f));
    const { width, height } = img.getSize();
    for (const [name, [long, q]] of Object.entries(sizes)) {
      const k = Math.min(1, long / Math.max(width, height));
      const out = img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' }).toJPEG(q);
      fs.mkdirSync(path.join(dir, name), { recursive: true });
      fs.writeFileSync(path.join(dir, name, f), out);
    }
    console.log('sized', f);
  }
  app.quit();
});
