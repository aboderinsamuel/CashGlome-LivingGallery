// Meta Muse client (Meta Model API, OpenAI-compatible Chat Completions).
// Desktop: routed through Electron main (no CORS). Web: routed through the /__ai proxy.
import { CATEGORIES } from './categories';
import { parseStory } from './parser';
import { todayISO } from './format';
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
      aiChat: (p: { base: string; key: string; body: unknown }) => Promise<{ ok: boolean; status: number; text: string }>;
      spotifyAuth?: (url: string) => Promise<{ code?: string | null; state?: string | null; error?: string | null }>;
      spotifyToken?: (body: string) => Promise<string>;
      speech?: { start: () => Promise<boolean>; stop: () => Promise<void>; on: (cb: (e: { type: string; value?: string | number }) => void) => () => void };
    };
  }
}

export const DEFAULT_BASE = 'https://api.meta.ai/v1';
export const MUSE_MODELS = [
  { id: 'muse-spark-1.3', name: 'Muse Spark 1.3', note: 'newest Spark — fast, reads entries well' },
  { id: 'muse-spark-1.1', name: 'Muse Spark 1.1', note: 'fast & cheap — great for reading entries' },
  { id: 'muse-wonder-1.0', name: 'Muse Wonder 1.0', note: 'frontier — deep stories & advice' },
];

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export type Msg =
  | { role: 'system' | 'user'; content: string | Part[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export interface Tool { type: 'function'; function: { name: string; description: string; parameters: unknown } }

export const aiEnabled = (s: Settings) => s.ai.provider === 'meta' && s.ai.key.trim().length > 8;

/** One request to Muse. Desktop goes through Electron main (no CORS); the web goes through the /__ai proxy. */
// Muse models think before they answer, and that thinking counts against max_tokens. Left at its default it
// can use the whole budget and return nothing (and take 10-15 s), so every call asks for light thinking and
// leaves room for it on top of the answer.
const THINKING_ROOM = 1500;

async function send(s: Settings, body: Record<string, unknown>, timeoutMs: number): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  try { return await sendOnce(s, { ...body, reasoning_effort: 'low' }, timeoutMs); } catch (e) {
    // An endpoint that doesn't know reasoning_effort: ask again without it.
    if (/Muse error 400/.test((e as Error).message) && /reasoning/i.test((e as Error).message)) return sendOnce(s, body, timeoutMs);
    throw e;
  }
}

async function sendOnce(s: Settings, body: unknown, timeoutMs: number): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const base = s.ai.base || DEFAULT_BASE;
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Muse took too long to answer')), timeoutMs));
  const call = (async () => {
    let status = 0, text = '';
    if (window.glome?.aiChat) {
      const r = await window.glome.aiChat({ base, key: s.ai.key.trim(), body });
      status = r.status; text = r.text;
      if (!r.ok) throw new Error(`Muse error ${status}: ${text.slice(0, 160)}`);
    } else {
      const r = await fetch('./__ai/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.ai.key.trim(), 'x-ai-base': base },
        body: JSON.stringify(body),
      });
      status = r.status; text = await r.text();
      if (!r.ok) throw new Error(`Muse error ${status}: ${text.slice(0, 160)}`);
    }
    const json = JSON.parse(text);
    return json?.choices?.[0]?.message ?? { content: json?.output_text ?? json?.content?.[0]?.text ?? '' };
  })();
  return Promise.race([call, timeout]);
}

export async function chat(s: Settings, model: string, messages: Msg[], opts: { temperature?: number; max_tokens?: number; timeoutMs?: number } = {}) {
  const m = await send(s, { model, messages, temperature: opts.temperature ?? 0.2, max_tokens: (opts.max_tokens ?? 900) + THINKING_ROOM }, opts.timeoutMs ?? 25000);
  if (!m.content) throw new Error('Muse returned an empty answer');
  return m.content;
}

/** A turn that may call tools: returns the text and any tool calls Muse wants made. */
export async function chatTools(s: Settings, model: string, messages: Msg[], tools: Tool[], opts: { max_tokens?: number; timeoutMs?: number } = {}) {
  const m = await send(s, { model, messages, tools, tool_choice: 'auto', temperature: 0.1, max_tokens: (opts.max_tokens ?? 1200) + THINKING_ROOM }, opts.timeoutMs ?? 30000);
  return { content: m.content ?? '', tool_calls: m.tool_calls ?? [] };
}

export function extractJSON<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[[{]/);
  const endObj = cleaned.lastIndexOf('}');
  const endArr = cleaned.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  if (start < 0 || end < start) throw new Error('No JSON in answer');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

const catList = CATEGORIES.map((c) => `${c.id} (${c.dir === 'in' ? 'INFLOW' : 'OUTFLOW'}: ${c.name})`).join('\n');

export async function museParse(s: Settings, text: string, currency: string): Promise<Parsed[]> {
  const sys = `You are the money-reading engine of CashGlome, a personal finance app. The user describes money that came IN (credit) or went OUT (debit) in casual language, slang, pidgin, emojis or several items in one sentence.
Today is ${todayISO()}. Currency: ${currency}. "k" = thousand, "m" = million.
Return ONLY JSON: {"items":[{"amount":number,"dir":"in"|"out","category":string,"label":string,"feeling":"joy"|"meh"|"regret"|null,"date":"YYYY-MM-DD","confidence":0..1}]}
Rules: one item per distinct money movement. "dir" is "in" when the user received money, "out" when they spent, paid, gave, saved or invested it. Saving or investing is "out" with category "savings". label is a short 2-5 word title in the user's words. feeling is only set when the user expresses it. Resolve relative dates. Pick category ids ONLY from:\n${catList}`;
  const out = await chat(s, s.ai.parseModel, [{ role: 'system', content: sys }, { role: 'user', content: text }], { temperature: 0, max_tokens: 700 });
  const data = extractJSON<{ items?: unknown[] } | unknown[]>(out);
  const items = (Array.isArray(data) ? data : data.items ?? []) as Record<string, unknown>[];
  const valid = new Set(CATEGORIES.map((c) => c.id));
  const res: Parsed[] = [];
  for (const it of items) {
    const amount = Number(it.amount);
    if (!isFinite(amount) || amount <= 0) continue;
    const dir = it.dir === 'in' ? 'in' : 'out';
    let category = String(it.category ?? '');
    const c = CATEGORIES.find((x) => x.id === category);
    if (!valid.has(category) || (c && c.dir !== dir)) category = dir === 'in' ? 'windfall' : 'other';
    const feeling = it.feeling === 'joy' || it.feeling === 'regret' || it.feeling === 'meh' ? it.feeling : undefined;
    const date = typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : todayISO();
    res.push({ amount, dir, category, label: String(it.label ?? '').slice(0, 48) || 'Entry', feeling, date, confidence: Number(it.confidence) || 0.9, text, source: 'muse' });
  }
  if (!res.length) throw new Error('Muse found no money in that');
  return res;
}

/** Best available reading: Muse when connected, the offline Oracle otherwise or on failure. */
export async function readMoney(s: Settings, text: string, currency: string): Promise<{ items: Parsed[]; engine: 'muse' | 'oracle'; error?: string }> {
  if (aiEnabled(s)) {
    try {
      return { items: await museParse(s, text, currency), engine: 'muse' };
    } catch (e) {
      return { items: parseStory(text), engine: 'oracle', error: (e as Error).message };
    }
  }
  return { items: parseStory(text), engine: 'oracle' };
}

export async function testConnection(s: Settings) {
  const out = await chat(s, s.ai.parseModel, [{ role: 'user', content: 'Reply with exactly: CashGlome online' }], { max_tokens: 20, timeoutMs: 15000 });
  return out.trim();
}
