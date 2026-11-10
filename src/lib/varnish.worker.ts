/// <reference lib="webworker" />
import { renderVarnish, type VarnishJob } from './varnish-render';

self.onmessage = async (e: MessageEvent<VarnishJob & { id: number; src: ImageBitmap }>) => {
  const { id, src, ...job } = e.data;
  try {
    const canvas = renderVarnish((w, h) => new OffscreenCanvas(w, h), src, job) as OffscreenCanvas;
    src.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
    (self as unknown as Worker).postMessage({ id, blob });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
