// What is left of the old cloud chat client, which Florin (stage/brain.ts) replaced: the message shapes
// lib/ask.ts still names, the desktop bridge's type, and the one reader every line goes through.
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

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export type Msg =
  | { role: 'system' | 'user'; content: string | Part[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export interface Tool { type: 'function'; function: { name: string; description: string; parameters: unknown } }

/** The old cloud chat is gone; nothing calls this. Florin answers through stage/brain.ts. */
export async function chatTools(_s: Settings, _model: string, _messages: Msg[], _tools: Tool[], _opts: { max_tokens?: number; timeoutMs?: number } = {}): Promise<{ content: string; tool_calls: ToolCall[] }> {
  throw new Error('The old cloud chat has been removed. Florin answers questions now.');
}

/** Reads a line on this device. Always the rules; what the person saw under the box is what gets saved. */
export async function readMoney(_s: Settings, text: string, currency: string): Promise<{ items: Parsed[]; engine: 'oracle'; error?: string }> {
  return { items: parseStory(text, { home: currency }), engine: 'oracle' };
}
