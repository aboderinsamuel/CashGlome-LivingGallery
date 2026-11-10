// One IntersectionObserver for the whole app. Sections ask once whether they have scrolled into view,
// then hand the animation to CSS (which runs on the compositor) instead of a JS spring per element.
import { useEffect, useRef, useState } from 'react';

const callbacks = new WeakMap<Element, () => void>();
let io: IntersectionObserver | null = null;
function observer() {
  if (!io) io = new IntersectionObserver((list) => {
    for (const e of list) if (e.isIntersecting) { callbacks.get(e.target)?.(); callbacks.delete(e.target); io!.unobserve(e.target); }
  }, { rootMargin: '0px 0px 80px 0px' });
  return io;
}

/** True from the moment the element first comes (nearly) into view. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    callbacks.set(el, () => setSeen(true));
    observer().observe(el);
    return () => { callbacks.delete(el); io?.unobserve(el); };
  }, [seen]);
  return [ref, seen] as const;
}

/**
 * Renders a long page in stages: stage 0 on the first frame (what you see), then one more stage
 * per painted frame. The first screen appears at once; the rest arrives below the fold unseen.
 */
export function useStages(last: number) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= last) return;
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setStage((x) => x + 1)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [stage, last]);
  return stage;
}
