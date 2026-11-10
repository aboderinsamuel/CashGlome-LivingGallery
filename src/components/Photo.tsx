import { useEffect, useState, type CSSProperties } from 'react';
import { onPicturesChange, pictureURL, type PictureKind } from '../lib/images';

/** The painted picture of an entry, loaded from this device. */
export function usePicture(id?: string) {
  const [v, setV] = useState<{ url: string; kind: PictureKind } | null>(null);
  useEffect(() => {
    if (!id) { setV(null); return; }
    let live = true;
    const load = () => pictureURL(id).then((x) => { if (live) setV(x); });
    load();
    const off = onPicturesChange(load);
    return () => { live = false; off(); };
  }, [id]);
  return v;
}

export function Photo({ id, className, style, alt = '' }: { id?: string; className?: string; style?: CSSProperties; alt?: string }) {
  const p = usePicture(id);
  if (!p) return null;
  return <img src={p.url} alt={alt} className={className} style={{ objectFit: 'cover', display: 'block', ...style }} draggable={false} />;
}
