// The desktop bridge's type, and the one reader every line goes through. Florin lives in stage/florin.ts.
import { parseStory } from './parser';
import type { Parsed, Settings } from './types';

declare global {
  interface Window {
    glome?: {
      isDesktop: boolean;
      platform: string;
      close: () => void;
      minimize: () => void;
      zoom: () => void;
      onState: (cb: (s: string) => void) => void;
      spotifyAuth?: (url: string) => Promise<{ code?: string | null; state?: string | null; error?: string | null }>;
      spotifyToken?: (body: string) => Promise<string>;
      speech?: { start: () => Promise<boolean>; stop: () => Promise<void>; on: (cb: (e: { type: string; value?: string | number }) => void) => () => void };
    };
  }
}

/** Reads a line on this device. Always the rules; what the person saw under the box is what gets saved. */
export async function readMoney(_s: Settings, text: string, currency: string): Promise<{ items: Parsed[]; engine: 'oracle'; error?: string }> {
  return { items: parseStory(text, { home: currency }), engine: 'oracle' };
}
