// Pictures live on this device only, in IndexedDB (localStorage is far too small for images).
// Each record keeps the photo as taken (downscaled) and, for things bought, its painted version.

export type PictureKind = 'thing' | 'receipt';
export interface Picture { id: string; kind: PictureKind; original: Blob; painted?: Blob; createdAt: number }

const DB = 'cashglome-pictures';
const STORE = 'pictures';
let dbp: Promise<IDBDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((res, rej) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

export const savePicture = (p: Picture) => tx('readwrite', (s) => s.put(p)).then(() => { urls.delete(p.id); emit(); return p.id; });
export const loadPicture = (id: string) => tx<Picture | undefined>('readonly', (s) => s.get(id));
export const deletePicture = (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => { const u = urls.get(id); if (u) URL.revokeObjectURL(u.url); urls.delete(id); emit(); });

export const pictureIds = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String)).catch(() => [] as string[]);

/** Removes pictures whose entry is gone (deleted, or an add that was undone). */
export async function prunePictures(keep: Set<string>, graceMs = 5 * 60000) {
  for (const id of await pictureIds()) {
    if (keep.has(id)) continue;
    const p = await loadPicture(id).catch(() => undefined);
    if (p && Date.now() - p.createdAt > graceMs) await deletePicture(id).catch(() => {});
  }
}

/* Object URLs, cached so lists of thumbnails don't re-read the database. */
const urls = new Map<string, { url: string; kind: PictureKind }>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export const onPicturesChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };

export async function pictureURL(id: string): Promise<{ url: string; kind: PictureKind } | null> {
  const hit = urls.get(id);
  if (hit) return hit;
  const p = await loadPicture(id).catch(() => undefined);
  if (!p) return null;
  const v = { url: URL.createObjectURL(p.painted ?? p.original), kind: p.kind };
  urls.set(id, v);
  return v;
}

/** Shrinks a photo so a whole year of them stays small: about 1200px on the long side. */
export async function downscale(file: Blob, max = 1200, quality = 0.84): Promise<{ blob: Blob; bitmap: ImageBitmap }> {
  const src = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.round(src.width * k), h = Math.round(src.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(src, 0, 0, w, h);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', quality));
  src.close();
  return { blob, bitmap: await createImageBitmap(blob) };
}

export const blobToDataURL = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
