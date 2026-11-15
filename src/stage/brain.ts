// The hybrid brain: Firebase AI Logic, Gemini Nano on the device when the browser has it, Gemini in the
// cloud when it doesn't. Two rules shape every call:
//   1. No model ever does arithmetic. Models read and write words; the device counts.
//   2. What may leave the device is decided here, not left to the SDK. A request that carries the
//      person's own line goes to the on-device model first; the cloud gets it only when the device can't
//      read it, and the seal on the result always says where it was read.
import type { GenerativeModel } from 'firebase/ai';
import { CATEGORIES } from '../lib/categories';
import type { Parsed } from '../lib/types';
import { todayISO } from '../lib/format';

export type Where = 'device' | 'cloud' | 'rules';

const env = import.meta.env as Record<string, string | undefined>;
const CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const RECAPTCHA = env.VITE_RECAPTCHA_SITE_KEY;
/** Firebase is set up for this build. Without it, the rules and the sitters' own lines carry on. */
export const brainConfigured = !!(CONFIG.apiKey && CONFIG.projectId && CONFIG.appId);
const CLOUD_MODEL = env.VITE_GEMINI_MODEL || 'gemini-3.5-flash-lite';

interface Models { prefer: GenerativeModel; device: GenerativeModel; cloud: GenerativeModel; json: { device: GenerativeModel; cloud: GenerativeModel } }
let models: Promise<Models | null> | null = null;
let deviceState: 'unknown' | 'downloading' | 'ready' | 'none' = 'unknown';
let progress = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export const onBrain = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const brainStatus = () => ({ configured: brainConfigured, device: deviceState, progress });

/** Is there a model on this device at all? Chrome on desktop exposes LanguageModel when it can run Gemini Nano. */
async function deviceAvailability(): Promise<string> {
  const LM = (globalThis as unknown as { LanguageModel?: { availability: (o?: unknown) => Promise<string> } }).LanguageModel;
  if (!LM) return 'unavailable';
  try { return await LM.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }] }); } catch { return 'unavailable'; }
}

const ENTRY_SCHEMA_IDS = CATEGORIES.map((c) => c.id);

function load(): Promise<Models | null> {
  if (!brainConfigured) return Promise.resolve(null);
  return (models ??= (async () => {
    const [{ initializeApp }, ai, check] = await Promise.all([import('firebase/app'), import('firebase/ai'), import('firebase/app-check')]);
    const app = initializeApp(CONFIG as Record<string, string>);
    // App Check keeps the Gemini API for this app only. Local builds use a debug token registered in the console.
    if (import.meta.env.DEV) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || true;
    if (RECAPTCHA || import.meta.env.DEV) check.initializeAppCheck(app, { provider: new check.ReCaptchaEnterpriseProvider(RECAPTCHA || 'debug'), isTokenAutoRefreshEnabled: true });
    const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
    const { Schema, InferenceMode } = ai;
    const entries = Schema.array({
      items: Schema.object({
        properties: {
          label: Schema.string({ description: 'Two or three words naming what it was, in the writer’s own language and script.' }),
          amount: Schema.number({ description: 'The sum as written, expanded: 4.5k is 4500, 2m is 2000000. Never add sums together.' }),
          dir: Schema.enumString({ enum: ['in', 'out'] }),
          category: Schema.enumString({ enum: ENTRY_SCHEMA_IDS }),
        },
      }),
    });
    const jsonCfg = { responseMimeType: 'application/json', responseSchema: entries, temperature: 0 };
    const mk = (mode: (typeof InferenceMode)[keyof typeof InferenceMode], json = false) => ai.getGenerativeModel(backend, {
      mode,
      inCloudParams: { model: CLOUD_MODEL, generationConfig: json ? jsonCfg : { temperature: 0.9, maxOutputTokens: 80 } },
      onDeviceParams: { promptOptions: json ? { responseConstraint: entries } : undefined, createOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] } } as never,
    });
    return {
      prefer: mk(InferenceMode.PREFER_ON_DEVICE),
      device: mk(InferenceMode.ONLY_ON_DEVICE),
      cloud: mk(InferenceMode.ONLY_IN_CLOUD),
      json: { device: mk(InferenceMode.ONLY_ON_DEVICE, true), cloud: mk(InferenceMode.ONLY_IN_CLOUD, true) },
    };
  })().catch((e) => { console.warn('[brain]', e); return null; }));
}

/**
 * Call on a person's tap or keypress (Chrome only lets a page start the model download after a user
 * gesture). Starts the on-device model if this browser has one; otherwise the cloud carries on.
 */
export async function warmUp() {
  if (!brainConfigured || deviceState === 'downloading' || deviceState === 'ready') return;
  const m = await load();
  if (!m) return;
  const a = await deviceAvailability();
  if (a === 'unavailable') { deviceState = 'none'; emit(); return; }
  deviceState = a === 'available' ? 'ready' : 'downloading'; emit();
  m.prefer.initializeDeviceModel((p) => { progress = p; emit(); })
    .then(() => { deviceState = 'ready'; progress = 1; emit(); })
    .catch(() => { deviceState = 'none'; emit(); });
}

const whereOf = (src?: string): Where => (src === 'on_device' ? 'device' : 'cloud');
const deviceUsable = () => deviceState === 'ready';

/**
 * Reads a line the rules couldn't: another language or script, unusual wording. The device model gets the
 * line first. Only if this device has no model does the line go to the cloud.
 */
export async function readLine(text: string, currency: string): Promise<{ read: Parsed[]; where: Where } | null> {
  const m = await load();
  if (!m) return null;
  const prompt = `Read this money diary line into entries. Currency: ${currency}. Each sum stays as written, expanded (4.5k = 4500). Money received is "in"; money spent, sent or paid is "out". Write each label in the same language and script as the line.\n\nLine: ${text}`;
  const tryModel = async (model: GenerativeModel) => {
    const r = await model.generateContent(prompt);
    const rows = JSON.parse(r.response.text()) as { label: string; amount: number; dir: 'in' | 'out'; category: string }[];
    const read: Parsed[] = rows.filter((x) => x && x.amount > 0 && Number.isFinite(x.amount)).map((x) => ({
      amount: Math.round(x.amount * 100) / 100, dir: x.dir === 'in' ? 'in' : 'out', category: ENTRY_SCHEMA_IDS.includes(x.category) ? x.category : (x.dir === 'in' ? 'windfall' : 'other'),
      label: String(x.label || '').slice(0, 40) || 'Entry', date: todayISO(), confidence: 0.75, text, source: 'muse',
    }));
    return { read, where: whereOf(r.response.inferenceSource) };
  };
  try {
    if (deviceUsable()) return await tryModel(m.json.device);
  } catch (e) { console.warn('[brain] device read', e); }
  try { return await tryModel(m.json.cloud); } catch (e) { console.warn('[brain] cloud read', e); return null; }
}

export interface Persona { name: string; role: string; painting: string; artist: string; year: string }

/**
 * A line from a sitter in the painting. On the device it may see the person's own words; the cloud only
 * ever sees the kinds of things bought (never sums, never the line itself).
 */
export async function sitterSays(p: Persona, line: string, kinds: string[], hint: string): Promise<{ text: string; where: Where } | null> {
  const m = await load();
  if (!m) return null;
  const voice = `You are ${p.name}, ${p.role}, a figure in "${p.painting}" by ${p.artist} (${p.year}). The person in front of your painting keeps a money diary and just wrote a line. Answer with ONE short line, at most 18 words, in character: dry, warm and a little funny, the way a friend teases. Never scold, never give financial advice, never mention prices or sums, no emoji, no exclamation marks. Answer in the language the person wrote in. Mood of their week: ${hint}.`;
  const clean = (s: string) => s.replace(/^["“'\s]+|["”'\s]+$/g, '').replace(/!/g, '.').split('\n')[0].slice(0, 160);
  try {
    if (deviceUsable()) {
      const r = await m.device.generateContent(`${voice}\n\nThey wrote: "${line}"\nYour line:`);
      const t = clean(r.response.text());
      if (t) return { text: t, where: 'device' };
    }
  } catch (e) { console.warn('[brain] device voice', e); }
  try {
    const r = await m.cloud.generateContent(`${voice}\n\nThey wrote about: ${kinds.join(', ')}.\nYour line:`);
    const t = clean(r.response.text());
    return t ? { text: t, where: 'cloud' } : null;
  } catch (e) { console.warn('[brain] cloud voice', e); return null; }
}

/** The museum label for today. Only categories go in, so the SDK may choose where it runs. */
export async function museumLabel(kinds: string[], weekday: string, paintingTitle: string): Promise<{ text: string; where: Where } | null> {
  const m = await load();
  if (!m) return null;
  try {
    const r = await m.prefer.generateContent(`Write a museum wall label, one sentence of at most 16 words, for an imaginary still life painted in the manner of "${paintingTitle}", showing a day that included: ${kinds.join(', ')}. Format: Title. Medium. Workshop of You, ${weekday}. Dry wit, no sums, no emoji, no exclamation marks.`);
    const t = r.response.text().trim().split('\n')[0].replace(/^["“]|["”]$/g, '');
    return t ? { text: t, where: whereOf(r.response.inferenceSource) } : null;
  } catch (e) { console.warn('[brain] label', e); return null; }
}
