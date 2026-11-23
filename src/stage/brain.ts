// The hybrid brain: Firebase AI Logic, Gemini Nano on the device when the browser has it, Gemini in the
// cloud when it doesn't. Two rules shape every call:
//   1. No model ever does arithmetic. Models read and write words; the device counts.
//   2. What may leave the device is decided here, not left to the SDK. Online, the cloud answers, joined by
//      Nano on a device that passed a one-time speed check; offline, Nano alone. The seal on every result
//      says where it was read. Nano is never downloaded or loaded on a guess while online.
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
/** The cloud model's name for people: gemini-3.5-flash-lite reads "Gemini 3.5 Flash-Lite". */
export const cloudModelName = 'Gemini ' + CLOUD_MODEL.replace(/^gemini-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').replace(/ Lite$/, '-Lite');

interface Models {
  prefer: GenerativeModel; device: GenerativeModel; cloud: GenerativeModel;
  json: { device: GenerativeModel; cloud: GenerativeModel };
  plan: { device: GenerativeModel; cloud: GenerativeModel };
  ai: typeof import('firebase/ai'); backend: ReturnType<typeof import('firebase/ai').getAI>;
}
let models: Promise<Models | null> | null = null;
let deviceState: 'unknown' | 'downloading' | 'ready' | 'none' = 'unknown';
let progress = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export const onBrain = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const brainStatus = () => ({ configured: brainConfigured, device: deviceState, progress, quick: verdict?.v === 'quick' });

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
          amount: Schema.number({ description: 'The sum for this item, expanded: 4.5k is 4500, 2m is 2000000. If the line says it happened more than once ("twice", "x3", "three times"), multiply. Never add different items together.' }),
          dir: Schema.enumString({ enum: ['in', 'out'], description: 'From the writer’s side: in = money came to them; out = money left them.' }),
          moved: Schema.boolean({ description: 'false only when no money changed hands: a debt someone forgave, waived, cancelled or reduced; a price someone quoted; a plan for later. true otherwise.' }),
          category: Schema.enumString({ enum: ENTRY_SCHEMA_IDS }),
        },
      }),
    });
    // A question, planned as searches the device will run. The plan holds no numbers from the diary.
    const plan = Schema.object({
      properties: {
        kind: Schema.enumString({ enum: ['search', 'afford', 'free', 'other'], description: 'afford = can I buy/spend X; free = how much can I spend / is left until payday; search = anything answered by searching entries; other = not about their money' }),
        amount: Schema.number({ description: 'For afford: the price asked about, expanded (50k = 50000). 0 otherwise.' }),
        what: Schema.string({ description: 'For afford: the thing, in the asker’s words. Empty otherwise.' }),
        searches: Schema.array({
          description: 'For search: one to three searches over the entries. Each is summed exactly by the device.',
          items: Schema.object({
            properties: {
              from: Schema.string({ description: 'YYYY-MM-DD or empty' }),
              to: Schema.string({ description: 'YYYY-MM-DD or empty' }),
              dir: Schema.enumString({ enum: ['in', 'out', 'any'] }),
              categories: Schema.array({ items: Schema.enumString({ enum: ENTRY_SCHEMA_IDS }) }),
              search: Schema.array({ items: Schema.string(), description: 'Words to find in what they wrote, with variants and their own language' }),
              group_by: Schema.enumString({ enum: ['none', 'category', 'month', 'week', 'day', 'weekday', 'label'] }),
              sort: Schema.enumString({ enum: ['newest', 'largest'] }),
              title: Schema.string({ description: 'Three to six words naming this search, e.g. "Food this month"' }),
            },
            optionalProperties: ['from', 'to', 'categories', 'search'],
          }),
        }),
      },
      optionalProperties: ['amount', 'what', 'searches'],
    });
    const cfg = (schema: unknown) => ({ responseMimeType: 'application/json', responseSchema: schema, temperature: 0 });
    const mk = (mode: (typeof InferenceMode)[keyof typeof InferenceMode], schema?: unknown) => ai.getGenerativeModel(backend, {
      mode,
      inCloudParams: { model: CLOUD_MODEL, generationConfig: schema ? cfg(schema) : { temperature: 0.9, maxOutputTokens: 120 } } as never,
      onDeviceParams: { promptOptions: schema ? { responseConstraint: schema } : undefined, createOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] } } as never,
    });
    return {
      prefer: mk(InferenceMode.PREFER_ON_DEVICE),
      device: mk(InferenceMode.ONLY_ON_DEVICE),
      cloud: mk(InferenceMode.ONLY_IN_CLOUD),
      json: { device: mk(InferenceMode.ONLY_ON_DEVICE, entries), cloud: mk(InferenceMode.ONLY_IN_CLOUD, entries) },
      plan: { device: mk(InferenceMode.ONLY_ON_DEVICE, plan), cloud: mk(InferenceMode.ONLY_IN_CLOUD, plan) },
      ai, backend,
    };
  })().catch((e) => { console.warn('[brain]', e); return null; }));
}

/**
 * Call on a person's tap or keypress (Chrome only lets a page start the model download after a user
 * gesture). Starts the on-device model if this browser has one; otherwise the cloud carries on.
 */
export async function warmUp() {
  if (!brainConfigured || deviceState === 'downloading') return;
  const m = await load();
  if (!m || deviceState === 'ready') return;
  const a = await deviceAvailability();
  if (a === 'unavailable') { deviceState = 'none'; emit(); return; }
  // Online, Nano is never downloaded and never loaded on a guess (on a small GPU loading it stalls the whole
  // page). If it is already on this device, a one-time speed check runs while the page is idle; only a device
  // that passes uses Nano online. Offline, it loads and takes over (see the 'offline' listener below).
  if (!offline()) { if (a === 'available') { deviceState = 'ready'; emit(); if (!verdict) later(checkSpeed); } return; }
  deviceState = a === 'available' ? 'ready' : 'downloading'; emit();
  m.prefer.initializeDeviceModel((p) => { progress = p; emit(); })
    .then(() => { deviceState = 'ready'; progress = 1; emit(); })
    .catch(() => { deviceState = 'none'; emit(); });
}
if (typeof window !== 'undefined') window.addEventListener('offline', () => { void warmUp(); });

const whereOf = (src?: string): Where => (src === 'on_device' ? 'device' : 'cloud');
/** Some Chromium builds expose LanguageModel with no model behind it and only echo the prompt back. */
export const isEcho = (t: string) => /on-device model is not available|just echoing back/i.test(t);
const deviceUsable = () => deviceState === 'ready';
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
/** Offline, or when the caller must stay on the device: Nano alone. */
const deviceFirst = (onlyHere = false) => deviceUsable() && (onlyHere || offline());
/** Online on a device that passed the speed check: Nano and the cloud together, see `hybrid`. */
const quickOnline = () => deviceUsable() && !offline() && verdict?.v === 'quick';

/* ---- Is Nano quick on this device? Checked once, kept per Chrome version. ----
   Nothing about this check may slow the app down: it never downloads the model, it is skipped outright on
   graphics known to be too small (Intel's integrated GPUs took a minute or more per answer in our tests and
   starved the page), it waits until the page has been idle, and it gives up after a few seconds. */
const SPEED_KEY = 'cg.nano-speed.v1';
const QUICK_MS = 1500; // a one-word reply, after loading, must come back this fast
const CHECK_LIMIT = 8000; // loading plus the reply; past this the check is abandoned and the device counted slow
interface Verdict { v: 'quick' | 'slow'; ms: number; chrome: string }
const chromeVersion = () => (typeof navigator !== 'undefined' ? navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? '' : '');
function readVerdict(): Verdict | null {
  try { const x = JSON.parse(localStorage.getItem(SPEED_KEY) || 'null') as Verdict | null; return x && x.chrome === chromeVersion() ? x : null; } catch { return null; }
}
let verdict: Verdict | null = typeof window !== 'undefined' ? readVerdict() : null;
function keepVerdict(v: Verdict['v'], ms: number) {
  verdict = { v, ms: Math.round(ms), chrome: chromeVersion() };
  try { localStorage.setItem(SPEED_KEY, JSON.stringify(verdict)); } catch { /* kept for this visit only */ }
  emit();
}
/** Runs `f` once the page has had a few quiet seconds. */
function later(f: () => void) {
  setTimeout(() => ('requestIdleCallback' in window ? window.requestIdleCallback(() => f(), { timeout: 4000 }) : f()), 8000);
}
async function gpuCanCarryNano(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: (o?: unknown) => Promise<{ info?: { vendor?: string; architecture?: string; isFallbackAdapter?: boolean } } | null> } }).gpu;
  if (!gpu) return false;
  try {
    const a = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!a || a.info?.isFallbackAdapter) return false;
    return !(a.info?.vendor === 'intel' && /^gen-/.test(a.info?.architecture || ''));
  } catch { return false; }
}
let checking = false;
async function checkSpeed() {
  if (checking || verdict || offline()) return;
  if (document.visibilityState !== 'visible') { document.addEventListener('visibilitychange', () => later(checkSpeed), { once: true }); return; }
  checking = true;
  const LM = (globalThis as unknown as { LanguageModel?: { create: (o: unknown) => Promise<{ prompt: (t: string, o: unknown) => Promise<string>; destroy: () => void }> } }).LanguageModel;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), CHECK_LIMIT);
  const t0 = performance.now();
  let s: { destroy: () => void } | undefined;
  try {
    if (!LM || !(await gpuCanCarryNano())) { keepVerdict('slow', 0); return; }
    const session = await LM.create({ signal: stop.signal, expectedInputs: [{ type: 'text', languages: ['en'] }] });
    s = session;
    const t1 = performance.now();
    const reply = await session.prompt('Reply with one word: ready', { signal: stop.signal });
    const ms = performance.now() - t1;
    keepVerdict(ms <= QUICK_MS && !isEcho(reply) ? 'quick' : 'slow', ms);
  } catch {
    keepVerdict('slow', performance.now() - t0);
  } finally {
    clearTimeout(timer); s?.destroy(); checking = false;
  }
}

/* ---- Online on a quick device: Nano and the cloud start together. ----
   Nano's answer is taken if it comes first, or within GRACE ms of the cloud's; otherwise the cloud's is. So an
   answer is never later than the cloud alone by more than GRACE. If the cloud has to answer three times in a
   row, Nano is counted slow on this device and the app goes back to the cloud alone. */
const GRACE = 400;
let misses = 0;
function hybrid<T>(device: () => Promise<T | null>, cloud: () => Promise<T | null>): Promise<T | null> {
  const safe = (f: () => Promise<T | null>, what: string) => f().then((v) => v, (e) => { console.warn('[brain]', what, e); return null; });
  const d = safe(device, 'device'), c = safe(cloud, 'cloud');
  return new Promise((resolve) => {
    let dv: T | null | undefined, cv: T | null | undefined, wait: ReturnType<typeof setTimeout> | undefined, done = false;
    const finish = (v: T | null, byDevice: boolean) => {
      if (done) return; done = true; clearTimeout(wait);
      if (byDevice) misses = 0; else if (++misses >= 3 && verdict?.v === 'quick') keepVerdict('slow', -1);
      resolve(v);
    };
    void d.then((v) => { dv = v; if (v) finish(v, true); else if (cv !== undefined) finish(cv, false); });
    void c.then((v) => {
      cv = v;
      if (dv !== undefined) finish(v, false);
      else wait = setTimeout(() => finish(v, false), v ? GRACE : CHECK_LIMIT);
    });
  });
}
/** If a Nano call is under way when the connection comes back, the cloud waits this long before answering instead. */
const NANO_BUDGET = 2500;
/** Gives Nano NANO_BUDGET ms while online; past that the caller falls to the cloud. */
function onDevice<T>(work: Promise<T>, onlyHere = false): Promise<T> {
  if (onlyHere || offline()) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((_, no) => {
    timer = setTimeout(() => no(new Error('Nano took too long; the cloud answers')), NANO_BUDGET);
  });
  work.catch(() => {}); // a late failure after the cloud took over shouldn't surface
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * Reads a line the rules couldn't: another language or script, unusual wording. Online, the cloud reads it,
 * with Nano alongside on a device quick enough (see `hybrid`); offline, Nano reads it alone.
 */
export interface LineRead { read: Parsed[]; where: Where; /** Items where no money changed hands (a debt forgiven, a quote). */ unmoved: { label: string; amount: number }[] }
/** Past this, the rules read the line instead, so sending never hangs. */
const READ_LIMIT = 6000;

export async function readLine(text: string, currency: string): Promise<LineRead | null> {
  const m = await load();
  if (!m) return null;
  const prompt = `Read this money diary line into entries, the way a careful friend would. Currency: ${currency}.
Decide each item's direction from the writer's side, by meaning, not by keywords:
- "in": money came to the writer (paid, salary, sold, received, a refund, a gift or transfer to them, someone paying them back).
- "out": money left the writer (bought, paid for, sent, gave, lent, repaid, a fee). A thing with a price, like lunch or a taxi, is "out".
- Repeats multiply: "gifted 160k twice" is one item of 320000.
- If no money changed hands, set moved to false: "a friend reduced my debt by 60k" or "she forgave the 20k I owed" are moved=false (what is owed changed, not the cash).
Write each label in the same language and script as the line.

Line: ${text}`;
  const tryModel = async (model: GenerativeModel): Promise<LineRead> => {
    const r = await model.generateContent(prompt);
    const raw = r.response.text();
    if (isEcho(raw)) throw new Error('echo');
    const rows = (JSON.parse(raw) as { label: string; amount: number; dir: 'in' | 'out'; moved?: boolean; category: string }[])
      .filter((x) => x && x.amount > 0 && Number.isFinite(x.amount));
    // A category that runs the other way ("debt repayment" on money that came back) gives way to one that fits.
    const fit = (x: { dir: string; category: string; label: string }) => {
      const dir = x.dir === 'in' ? 'in' : 'out';
      const c = CATEGORIES.find((k) => k.id === x.category);
      if (c && c.dir === dir) return c.id;
      return dir === 'in' ? (/back|repaid|return|refund/i.test(`${x.label} ${text}`) ? 'refund' : 'windfall') : 'other';
    };
    const read: Parsed[] = rows.filter((x) => x.moved !== false).map((x) => ({
      amount: Math.round(x.amount * 100) / 100, dir: x.dir === 'in' ? 'in' : 'out', category: fit(x),
      label: String(x.label || '').slice(0, 40) || 'Entry', date: todayISO(), confidence: 0.85, text, source: 'florin',
    }));
    const unmoved = rows.filter((x) => x.moved === false).map((x) => ({ label: String(x.label || '').slice(0, 40), amount: x.amount }));
    return { read, unmoved, where: whereOf(r.response.inferenceSource) };
  };
  const work = (async () => {
    if (quickOnline()) return hybrid(() => tryModel(m.json.device), () => tryModel(m.json.cloud));
    try {
      if (deviceFirst()) return await onDevice(tryModel(m.json.device));
    } catch (e) { console.warn('[brain] device read', e); }
    try { return await tryModel(m.json.cloud); } catch (e) { console.warn('[brain] cloud read', e); return null; }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((ok) => { timer = setTimeout(() => ok(null), READ_LIMIT); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
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
  const clean = (s: string) => isEcho(s) ? '' : s.replace(/^["“'\s]+|["”'\s]+$/g, '').replace(/!/g, '.').split('\n')[0].slice(0, 160);
  const here = async () => { const t = clean((await m.device.generateContent(`${voice}\n\nThey wrote: "${line}"\nYour line:`)).response.text()); return t ? { text: t, where: 'device' as Where } : null; };
  const there = async () => { const t = clean((await m.cloud.generateContent(`${voice}\n\nThey wrote about: ${kinds.join(', ')}.\nYour line:`)).response.text()); return t ? { text: t, where: 'cloud' as Where } : null; };
  if (quickOnline()) return hybrid(here, there);
  try {
    if (deviceFirst()) {
      const r = await onDevice(m.device.generateContent(`${voice}\n\nThey wrote: "${line}"\nYour line:`));
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

export interface PlannedSearch { from?: string; to?: string; dir?: 'in' | 'out' | 'any'; categories?: string[]; search?: string[]; group_by?: string; sort?: string; title?: string }
export interface Plan { kind: 'search' | 'afford' | 'free' | 'other'; amount?: number; what?: string; searches?: PlannedSearch[] }

/**
 * Turns a question into searches. The model sees the question, today's date and the category names; never
 * an entry, a total or a balance. The device runs the searches and does every sum.
 */
export async function planQuestion(question: string, today: string, weekday: string, allowCloud = true): Promise<{ plan: Plan; where: Where } | null> {
  const m = await load();
  if (!m) return null;
  const prompt = `You plan searches over a person's private money diary. You never see the diary; the device runs your searches and adds everything up exactly. Today is ${weekday} ${today}.
Category ids: ${ENTRY_SCHEMA_IDS.join(', ')}. "Spending" is money out; savings is money put aside.
Rules: resolve every period to dates ("this month" = first of this month to today, "last week" = the Monday-to-Sunday before this one). With no period, use this month for spending and budgets, all time for "ever" or "usually". Use search words for people, shops and things ("mum" -> ["mum","mom","mother","mama"]), in the asker's language too. Comparisons need two searches.
Question: ${question}`;
  const run = async (model: GenerativeModel) => {
    const r = await model.generateContent(prompt);
    return { plan: JSON.parse(r.response.text()) as Plan, where: whereOf(r.response.inferenceSource) };
  };
  if (allowCloud && quickOnline()) return hybrid(() => run(m.plan.device), () => run(m.plan.cloud));
  try { if (deviceFirst(!allowCloud)) return await onDevice(run(m.plan.device), !allowCloud); } catch (e) { console.warn('[brain] device plan', e); }
  if (!allowCloud) return null;
  try { return await run(m.plan.cloud); } catch (e) { console.warn('[brain] cloud plan', e); return null; }
}

/** On the device only: a sitter puts the device's exact figures into words. The cloud is never asked this. */
export async function phraseOnDevice(p: Persona, question: string, facts: string, onlyHere = false): Promise<string | null> {
  if (!deviceFirst(onlyHere)) return null;
  const m = await load();
  if (!m) return null;
  try {
    const r = await onDevice(m.device.generateContent(`You are ${p.name}, ${p.role}, in "${p.painting}" by ${p.artist}. Answer the person's question in two short sentences, warmly and a little dry, in their language. Use ONLY these exact figures, copied as written; never add or change a number. No advice, no emoji.\nQuestion: ${question}\nFigures: ${facts}\nAnswer:`), onlyHere);
    const t = r.response.text().trim();
    if (isEcho(t)) return null;
    return t || null;
  } catch (e) { console.warn('[brain] phrase', e); return null; }
}

/**
 * Florin's own models, for conversation. The cloud model may call the device's tools (searches, sums,
 * affordability); the device model gets the device's figures already counted, since it can't call tools.
 */
export async function florinModels() {
  const m = await load();
  if (!m) return null;
  return {
    cloud: m.ai.getGenerativeModel(m.backend, { model: CLOUD_MODEL, generationConfig: { temperature: 0.75, maxOutputTokens: 900 } }),
    device: deviceUsable() ? m.device : null,
  };
}
