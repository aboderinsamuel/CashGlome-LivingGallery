// Florin: a conversation about anything, with the book open on the table.
// Gemini talks; this device counts. The model is given the shape of the book and a set of tools that run
// here (searches with exact sums, affordability). Any figure from the book it says comes from those, copied
// exactly; anything it guesses (what a dinner out costs, say) it must mark as an estimate.
// Offline, Ask sends nothing: Gemini Nano answers if the browser has it, the app's rules if not.
import type { Content, FunctionCall, FunctionDeclarationsTool, GenerativeModel, Part } from 'firebase/ai';
import { cleanQuery, runQuery, type Figure } from '../lib/ask';
import { computeStats, projection } from '../lib/analytics';
import { cat, CATEGORIES } from '../lib/categories';
import { ex, money, monthOf, todayISO } from '../lib/format';
import { affordability, memoryDigest, relDay } from '../lib/memory';
import type { Entry, State } from '../lib/types';
import { askPainting, safeToSpend, type PaintingAnswer } from './askPainting';
import { peopleOf } from './books';
import { brainConfigured, cloudModelName, florinModels, type Persona } from './brain';
import { STATEMENT_Q, statementAnswer, statementDigest, statementFigures } from './statements';

export interface FlorinAnswer extends PaintingAnswer {
  /** The answer holds a figure Florin guessed rather than one counted from the book. */
  estimate?: boolean;
  /** Why it was answered where it was (offline, kept on this device, Florin unreachable). */
  note?: string;
}
export interface FlorinHistory { q: string; a: { text: string } | null }

// Ask goes to Gemini in the cloud while online, so it is quick on any device; Gemini Nano answers offline.
// The old "Keep Ask on this device" switch is gone; its saved setting is cleared.
try { localStorage.removeItem('cg-ask-local'); } catch { /* private mode */ }

// Whole units for sums of a hundred or more: the model copies what it sees, and "34,251.51 shillings" reads like a till.
const r2 = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100);
const IDS = CATEGORIES.map((c) => c.id);

/** The book in a few lines: what the device has already counted, so most questions need no search. */
export function bookSummary(state: State) {
  const cur = state.profile.currency;
  const f = (n: number) => money(n, cur);
  const today = todayISO();
  const s = computeStats(state.entries, monthOf(today));
  const pj = projection(s);
  const free = safeToSpend(state, today);
  const people = peopleOf(state.entries).filter((p) => p.net !== 0).slice(0, 6);
  const dates = state.entries.map((e) => e.date).sort();
  const lines = [
    `Currency: ${cur}. ${state.entries.length} entries${dates.length ? ` from ${dates[0]} to ${dates[dates.length - 1]}` : ''}.`,
    `This month so far: came in ${f(s.inflow)}, spent ${f(s.spend)}, put aside ${f(s.vault)}, left ${f(s.inflow - s.outflow)}; day ${s.dayOfMonth} of ${s.monthDays}; likely spend by month end ${f(pj.projectedSpend)}.`,
    s.byCat.length ? `Spent by category this month: ${s.byCat.slice(0, 8).map((c) => `${cat(c.id).name} ${f(c.total)} (${c.count})`).join(', ')}.` : 'Nothing spent this month yet.',
    free ? `Free to spend: about ${f(free.free)} in all, ${f(free.perDay)} a day ${free.until ? `until payday on ${free.until}` : 'for the rest of the month'}.` : 'Not enough written yet to say what is free to spend.',
    people.length ? `People: ${people.map((p) => (p.net > 0 ? `${p.name} owes them ${f(p.net)}` : `they owe ${p.name} ${f(-p.net)}`)).join('; ')}.` : '',
    statementDigest(state),
    memoryDigest(state),
  ];
  return lines.filter(Boolean).join('\n');
}

/** The summary's figures, as the working, for an answer drawn from the summary rather than a search. */
function summaryFigures(state: State): Figure[] {
  const cur = state.profile.currency;
  const today = todayISO();
  const s = computeStats(state.entries, monthOf(today));
  const free = safeToSpend(state, today);
  if (!s.entries.length) return [];
  return [
    { label: 'Came in this month', value: money(s.inflow, cur) },
    { label: 'Spent this month', value: money(s.spend, cur) },
    { label: 'Put aside', value: money(s.vault, cur) },
    { label: 'Left now', value: money(s.inflow - s.outflow, cur) },
    ...(free ? [{ label: free.until ? 'Free a day until payday' : 'Free a day this month', value: money(free.perDay, cur) }] : []),
  ];
}

const S = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra }) as never;
const TOOLS: FunctionDeclarationsTool = {
  functionDeclarations: [
    {
      name: 'search_entries',
      description: 'Search the money diary and get exact totals, counts and matching entries, counted by the device. Use it for any figure that is not already in the summary. Call it more than once to compare.',
      parameters: S('OBJECT', {
        properties: {
          title: S('STRING', { description: 'Three to six words naming the search, e.g. "Food this month"' }),
          from: S('STRING', { description: 'First date, YYYY-MM-DD' }),
          to: S('STRING', { description: 'Last date, YYYY-MM-DD' }),
          dir: S('STRING', { enum: ['in', 'out', 'any'] }),
          categories: S('ARRAY', { items: S('STRING', { enum: IDS }) }),
          search: S('ARRAY', { items: S('STRING'), description: 'Words to find in what they wrote, with variants and in their own language' }),
          group_by: S('STRING', { enum: ['none', 'category', 'month', 'week', 'day', 'weekday', 'label'] }),
          sort: S('STRING', { enum: ['newest', 'largest'] }),
        },
        required: ['title'],
      }),
    },
    {
      name: 'can_afford',
      description: 'Whether a price fits, from their balance, routines, pay day and this month, counted by the device. Use it for "can I afford", "should I buy", and plans that cost money (a date, a trip, a gift). The amount may be your estimate.',
      parameters: S('OBJECT', { properties: { amount: S('NUMBER'), what: S('STRING') }, required: ['amount'] }),
    },
  ],
};

/** Can a price fit? From the balance, routines and pay day when they are known; from this month otherwise. */
function afford(state: State, amount: number, what: string): { text: string; figures: Figure[]; runway?: PaintingAnswer['runway'] } {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur);
  const plan = affordability(state, amount, what || 'this');
  if (plan) {
    return {
      text: plan.text, runway: plan,
      figures: [
        { label: 'Money now', value: m(plan.balance) },
        { label: plan.payday ? `Routines until ${relDay(plan.payday.date)}` : 'Routines this week', value: m(plan.committed) },
        { label: 'This', value: m(amount) },
        { label: 'Lowest point', value: `${m(plan.lowest)} · ${relDay(plan.lowestDate)}` },
      ],
    };
  }
  const s = computeStats(state.entries, monthOf(todayISO()));
  const pj = projection(s);
  const left = s.inflow - s.spend - s.vault;
  const endLeft = s.inflow - pj.projectedSpend - s.vault;
  const figures: Figure[] = [
    { label: 'Came in this month', value: m(s.inflow) },
    { label: 'Spent so far', value: m(s.spend) },
    { label: 'Put aside', value: m(s.vault) },
    { label: 'Left right now', value: m(left) },
    { label: 'Likely spend by month end', value: m(pj.projectedSpend) },
  ];
  if (!s.inflow) return { text: 'Unknown: nothing that came in this month is written down yet.', figures };
  const verdict = left < amount ? `does not fit: ${m(left)} is left, ${m(amount - left)} short`
    : endLeft - amount >= 0 ? `fits: ${m(left)} is left now, and about ${m(endLeft - amount)} would remain at month end`
      : `is tight: ${m(left)} is left now, but the month's likely spending would leave about ${m(amount - endLeft)} short`;
  return { text: `${m(amount)} ${verdict}.`, figures };
}

type Run = { figures: Figure[]; rows: Entry[]; runway?: PaintingAnswer['runway'] };

/** The tools, run here. The model gets the result; the person gets the same figures as the working. */
function runTool(state: State, call: FunctionCall, into: Run): object {
  const cur = state.profile.currency;
  const args = (call.args ?? {}) as Record<string, unknown>;
  if (call.name === 'search_entries') {
    const { result, rows, pool } = runQuery(state.entries, cleanQuery(args));
    const total = pool.reduce((a, e) => a + e.amount, 0);
    const title = String(args.title || 'Matching entries').replace(/\.$/, '');
    into.figures.push({ label: title, value: `${money(total, cur)} · ${pool.length} ${pool.length === 1 ? 'entry' : 'entries'}` });
    // Always the split by category too, counted here, so the model never has to add entries up itself.
    if (!result.groups) {
      const by = new Map<string, number>();
      pool.forEach((e) => by.set(cat(e.category).name, (by.get(cat(e.category).name) ?? 0) + e.amount));
      if (by.size > 1) result.by_category = [...by].sort((a, b) => b[1] - a[1]).map(([key, t]) => ({ key, total: r2(t) }));
    }
    ((result.groups ?? result.by_category) as { key: string; total: number }[] | undefined)?.slice(0, 4).forEach((g) => into.figures.push({ label: `  ${g.key}`, value: money(g.total, cur) }));
    if (!into.rows.length) into.rows = rows.slice(0, 8);
    return result;
  }
  if (call.name === 'can_afford') {
    const a = afford(state, Number(args.amount) || 0, String(args.what ?? ''));
    a.figures.forEach((f) => into.figures.push(f));
    if (a.runway) into.runway = a.runway;
    return { verdict: a.text, figures: a.figures };
  }
  return { error: 'No such tool' };
}

function system(state: State, sitter: Persona, summary: string, tools: boolean) {
  const weekday = new Date().toLocaleDateString('en', { weekday: 'long' });
  const name = state.profile.name?.trim();
  return `You are Florin, speaking as ${sitter.name} (${sitter.role}) in "${sitter.painting}" by ${sitter.artist}, ${sitter.year}: the painting on this month's page of ${name ? `${name}'s` : 'the person\'s'} money diary, CashGlome. Today is ${weekday} ${todayISO()}.
You can talk about anything: life, plans, dates, food, work, feelings, art. You also know their money, and you bring it in when it matters, the way a sharp, kind friend would.
How you speak: warm, dry, a little funny; plain words; at most 90 words unless they ask for more; in the language they write in. Never scold or guilt. No emoji, no exclamation marks, no markdown, no lists unless asked.
Numbers: never add, subtract or work out a figure yourself. Every figure from their book is copied exactly from the summary below${tools ? ' or from a tool result (search_entries, can_afford); call a tool whenever you need a figure the summary does not have, and for a combined figure (food and drink together, say) search for exactly that combination instead of adding results up' : ''}. If you guess a figure (what a dinner out usually costs, say), write it as "about X (my estimate)" and keep it apart from their own figures. Amounts are in ${state.profile.currency}; write them the way the summary does, with the currency and thousands separators.
You don't give investment, tax or legal advice; say so kindly if asked, and still help them think it through.
What you run on (true facts, for when they ask): this conversation is ${cloudModelName}, Google's Gemini in the cloud, reached through Firebase AI Logic. Gemini Nano, Chrome's model on their own device (only where their browser has it; desktop Chrome can), takes over when they are offline, and on a computer fast enough it also reads their lines and voices the painting while online. Their entries stay on their device and every figure is counted there. You are not ChatGPT or any other company's model.
If they ask what AI, model or engine you are, who made you, whether you are ChatGPT, or whether you run in the cloud or on their device, never dodge and never answer in riddles: step out of character and say those facts plainly, in the first person and in your own words, in one to three sentences. Then you may go back to being ${sitter.name}.
Their book:
${summary}`;
}

/** Gemini Nano is small: a short brief, the device's figures, and no room to wander. */
function deviceSystem(state: State, sitter: Persona, summary: string, facts: string) {
  const name = state.profile.name?.trim();
  return `You are ${sitter.name} (${sitter.role}) in "${sitter.painting}" by ${sitter.artist}.${name ? ` You are talking to ${name}.` : ''} Today is ${new Date().toLocaleDateString('en', { weekday: 'long' })}.
Answer their question in at most three short sentences, warm and a little dry, in the language they write in.
Use only the figures given here, copied exactly as written. Never add, total, change or work out a number. Never invent a purchase, a habit or a memory that is not in their book. Don't ask them a question back. No emoji, no exclamation marks, no markdown.
If they ask what AI or model you are, say plainly: Gemini Nano, running on their own device in Chrome through Firebase AI Logic, because they are offline, so nothing leaves the device.${facts ? `
Counted on the device for this question (answer from these first, each with its own label): ${facts}` : ''}
The rest of their book, for background:
${summary}`;
}

const numbersIn = (t: string) => new Set((t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => +n.replace(/,/g, '')));
/** Keeps only sentences whose figures were all counted on the device (small numbers such as days pass). */
const onlyCounted = (t: string, counted: Set<number>) => t.split(/(?<=[.?;])\s+/).filter((sentence) => [...numbersIn(sentence)].every((n) => n <= 31 || counted.has(n))).join(' ').trim();
const tidy = (t: string) => t.replace(/!/g, '.').replace(/\*\*?/g, '').trim();
const ESTIMATE = /\bestimate\b/i;

/** One turn of the conversation. onText receives the reply as it is written. */
export async function askFlorin(state: State, question: string, history: FlorinHistory[], sitter: Persona, onText: (t: string) => void): Promise<FlorinAnswer> {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const rules = async (note?: string): Promise<FlorinAnswer> => {
    // Who owes whom is the people ledger, counted here; the rules' search doesn't read it.
    if (/\bowe[sd]?\b|\bowing\b|\bdebts?\b/i.test(question)) {
      const cur = state.profile.currency;
      const ps = peopleOf(state.entries).filter((p) => p.net !== 0);
      const them = ps.filter((p) => p.net > 0), me = ps.filter((p) => p.net < 0);
      const list = (xs: typeof ps) => xs.map((p) => `${p.name} (${money(Math.abs(p.net), cur)})`).join(', ');
      const text = !ps.length ? `Nobody owes anybody in your book. Write it like “lent Sam ${ex(50, cur)}” or “owe Mei ${ex(20, cur)}” and I’ll keep count.`
        : [them.length ? `Owing you: ${list(them)}.` : 'Nobody owes you anything.', me.length ? `You owe ${list(me)}.` : ''].filter(Boolean).join(' ');
      return { text, figures: ps.map((p) => ({ label: p.net > 0 ? `${p.name} owes you` : `You owe ${p.name}`, value: money(Math.abs(p.net), cur) })), rows: [], planned: 'rules', wordsBy: 'app', note };
    }
    // A bank statement brought in: the device reads it out, every figure counted here.
    if (STATEMENT_Q.test(question)) return { ...statementAnswer(state), planned: 'rules', wordsBy: 'app', note };
    return { ...(await askPainting(state, question, sitter, !offline)), planned: 'rules', note };
  };
  if (!brainConfigured) return rules();
  const models = await florinModels().catch(() => null);
  if (!models) return rules(offline ? 'Offline. The book answered on this device.' : undefined);
  const summary = bookSummary(state);
  const past = history.filter((h) => h.a?.text).slice(-6);

  // On this device: Gemini Nano, with the device's figures already counted. Nothing leaves.
  if (offline) {
    if (!models.device) return rules('Offline. The book answered on this device.');
    try {
      const base = STATEMENT_Q.test(question) ? { ...statementAnswer(state), runway: undefined, wordsBy: 'app' as const, planned: 'rules' as const } : await askPainting(state, question, sitter, false);
      const facts = base.figures.map((f) => `${f.label.trim()}: ${f.value}`).join('; ');
      const convo = past.map((h) => `Them: ${h.q}\nYou: ${h.a!.text}`).join('\n');
      const res = await (models.device as GenerativeModel).generateContentStream(`${deviceSystem(state, sitter, summary, facts)}\n\n${convo}\nThem: ${question}\nYou:`);
      let text = '';
      // Nano may still try a sum of its own; any sentence with a figure the device didn't count is dropped.
      const counted = numbersIn(`${facts}
${summary}
${question}`);
      const keep = (t: string) => onlyCounted(tidy(t), counted);
      for await (const chunk of res.stream) { text += chunk.text(); onText(keep(text)); }
      text = keep(text);
      if (!text) return { ...base, planned: 'rules' };
      return { text, figures: base.figures, rows: base.rows, runway: base.runway, planned: 'device', wordsBy: 'device', estimate: ESTIMATE.test(text), note: offline ? 'Offline. Gemini Nano answered on this device.' : undefined };
    } catch (e) {
      console.warn('[florin] device', e);
      return rules();
    }
  }

  // In the cloud: Gemini, with the summary and the device's tools.
  const run: Run = { figures: [], rows: [] };
  try {
    const chat = models.cloud.startChat({
      systemInstruction: system(state, sitter, summary, true),
      tools: [TOOLS],
      history: past.flatMap((h): Content[] => [{ role: 'user', parts: [{ type: 'text', text: h.q }] }, { role: 'model', parts: [{ type: 'text', text: h.a!.text }] }]),
    });
    let text = '';
    let send: string | Part[] = question;
    for (let hop = 0; hop < 4; hop++) {
      const res = await chat.sendMessageStream(send);
      for await (const chunk of res.stream) {
        let t = '';
        try { t = chunk.text(); } catch { /* a tool call carries no words */ }
        if (t) { text += t; onText(tidy(text)); }
      }
      const calls = (await res.response).functionCalls();
      if (!calls?.length) break;
      send = calls.map((c) => ({ type: 'functionResponse', functionResponse: { name: c.name, ...(c.id ? { id: c.id } : {}), response: runTool(state, c, run) } }) as Part);
    }
    text = tidy(text);
    if (!text) return rules();
    return { text, figures: run.figures.length ? run.figures : STATEMENT_Q.test(question) ? statementFigures(state) : /\d/.test(text) ? summaryFigures(state) : [], rows: run.rows, runway: run.runway, planned: 'cloud', wordsBy: 'app', estimate: ESTIMATE.test(text) };
  } catch (e) {
    console.warn('[florin] cloud', e);
    return rules('Florin couldn’t be reached just now, so the book answered on its own.');
  }
}
