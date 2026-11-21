// Ask the painting. A question goes in; a sitter answers with exact figures and shows the working.
// The model only ever plans: which searches to run. Every sum is made here, on the device, by runQuery.
import { answerLocally, cleanQuery, runQuery, type Answer, type Figure } from '../lib/ask';
import { affordability } from '../lib/memory';
import { computeStats, projection } from '../lib/analytics';
import { ex, money, monthOf, todayISO } from '../lib/format';
import type { Entry, State } from '../lib/types';
import { brainConfigured, phraseOnDevice, planQuestion, type Persona, type Where } from './brain';

export interface PaintingAnswer {
  text: string;
  figures: Figure[];
  rows: Entry[];
  /** Who planned the question (device model, cloud model, or the app's own rules) and who counted (always the device). */
  planned: Where;
  /** The device model wrote the words from the figures; otherwise the app's own sentence. */
  wordsBy: 'device' | 'app';
  /** The days until payday, when the question was about affording something. */
  runway?: Answer['runway'];
}

const MONEY_Q = /\b(spen[dt]|cost|paid|pay|afford|buy|left|save|saved|income|earn|came in|owe|money|budget|how much|biggest|most|where did)\b/i;

/** The money free to spend each day until the next money comes in. Null until there's enough written to say. */
export function safeToSpend(state: State, today = todayISO()) {
  const plan = affordability(state, 0, 'this', today);
  if (plan) {
    const days = Math.max(1, plan.days.filter((d) => !d.payday).length);
    return { perDay: Math.max(0, Math.floor(plan.lowest / days)), until: plan.payday?.date ?? null, basis: 'balance' as const, free: Math.max(0, plan.lowest) };
  }
  const s = computeStats(state.entries, monthOf(today));
  if (!s.inflow) return null;
  const left = s.inflow - s.spend - s.vault;
  const pj = projection(s);
  const daysLeft = Math.max(1, s.monthDays - s.dayOfMonth + 1);
  // Leave room for the bills that usually still come this month, then spread the rest over the days left.
  const ahead = Math.max(0, pj.projectedSpend - s.spend - pj.dailyBurn * (daysLeft - 1));
  return { perDay: Math.max(0, Math.floor((left - ahead) / daysLeft)), until: null, basis: 'month' as const, free: Math.max(0, left - ahead) };
}

/** With allowCloud false (offline), the question never leaves the device. */
export async function askPainting(state: State, question: string, sitter: Persona, allowCloud = true): Promise<PaintingAnswer> {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur);
  const today = todayISO();
  const weekday = new Date().toLocaleDateString('en', { weekday: 'long' });
  const local = () => answerLocally(state, question);
  const fromLocal = (a: Answer): PaintingAnswer => ({ text: a.text, figures: a.figures ?? [], rows: a.rows ?? [], planned: 'rules', wordsBy: 'app', runway: a.runway });

  // The model plans when there is one; the rules plan when there isn't, or when the model can't.
  const planned = brainConfigured ? await Promise.race([planQuestion(question, today, weekday, allowCloud), new Promise<null>((r) => setTimeout(() => r(null), 9000))]) : null;
  if (!planned || planned.plan.kind === 'other') {
    const a = local();
    if (a) return fromLocal(a);
    return {
      text: planned?.plan.kind === 'other' && !MONEY_Q.test(question)
        ? 'I only keep accounts here. Ask me about what came in, what went out, or what you can afford.'
        : `I can’t count that from what is written yet. Try “Where did my money go this month?” or “Can I afford ${ex(50, cur)}?”`,
      figures: [], rows: [], planned: planned?.where ?? 'rules', wordsBy: 'app',
    };
  }
  const { plan, where } = planned;
  let text = '', figures: Figure[] = [], rows: Entry[] = [];
  let runway: Answer['runway'];

  if (plan.kind === 'afford' || plan.kind === 'free') {
    // Affordability is the app's own arithmetic; the rules phrase it. The model only read the price.
    const a = local();
    if (a && (a.runway || a.figures?.length)) { text = a.text; figures = a.figures ?? []; runway = a.runway; }
    else {
      const free = safeToSpend(state, today);
      text = free ? `About ${m(free.free)} is free, around ${m(free.perDay)} a day${free.until ? ' until payday' : ' for the rest of the month'}.` : 'Tell me what you have first, like “I have 40k”, and I can answer that exactly.';
    }
    if (plan.kind === 'afford' && plan.amount && !affordability(state, 0)) {
      const s = computeStats(state.entries, monthOf(today));
      const left = s.inflow - s.spend - s.vault;
      if (s.inflow) {
        text = left >= plan.amount ? `Yes. About ${m(left)} is left this month, so ${m(plan.amount)}${plan.what ? ` on ${plan.what}` : ''} fits with ${m(left - plan.amount)} to spare.` : `Not this month. About ${m(left)} is left, ${m(plan.amount - left)} short of ${m(plan.amount)}.`;
        figures = [{ label: 'Came in this month', value: m(s.inflow) }, { label: 'Spent so far', value: m(s.spend) }, { label: 'Put aside', value: m(s.vault) }, { label: 'Left now', value: m(left) }];
      }
    }
  } else {
    const parts: string[] = [];
    for (const raw of (plan.searches ?? []).slice(0, 3)) {
      const q = cleanQuery(raw as Record<string, unknown>);
      const { pool, rows: found, result } = runQuery(state.entries, q);
      const total = pool.reduce((a, e) => a + e.amount, 0);
      const title = (raw.title || 'Matching entries').replace(/\.$/, '');
      figures.push({ label: title, value: `${m(total)} · ${pool.length} ${pool.length === 1 ? 'entry' : 'entries'}` });
      const groups = (result.groups as { key: string; total: number }[] | undefined)?.slice(0, 3);
      if (groups?.length) groups.forEach((g) => figures.push({ label: `  ${g.key}`, value: m(g.total) }));
      parts.push(pool.length ? `${title}: ${m(total)} across ${pool.length} ${pool.length === 1 ? 'entry' : 'entries'}${groups?.length ? `, most in ${groups[0].key} (${m(groups[0].total)})` : ''}.` : `${title}: nothing written down.`);
      if (!rows.length) rows = found.slice(0, 8);
    }
    text = parts.join(' ') || 'Nothing written down matches that yet.';
  }
  // The device model may put the device's figures into the sitter's words. The cloud never sees them.
  const said = figures.length ? await Promise.race([phraseOnDevice(sitter, question, figures.map((f) => `${f.label.trim()}: ${f.value}`).join('; '), !allowCloud), new Promise<null>((r) => setTimeout(() => r(null), 6000))]) : null;
  return { text: said ?? text, figures, rows, planned: where, wordsBy: said ? 'device' : 'app', runway };
}
