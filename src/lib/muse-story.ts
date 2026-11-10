import { chat, extractJSON } from './ai';
import { computeStats, projection, statsDigest, type Seg } from './analytics';
import { findAmounts } from './parser';
import { money } from './format';
import type { State } from './types';

const VOICE = `Write like a thoughtful editor at a design magazine who also understands money: warm, specific, observant, never preachy. Short sentences. Use the person's real numbers and currency. No emojis, no exclamation marks, no clichés like "journey" or "unlock". No markdown.`;

export interface MuseChapter { title: Seg[]; lede: string; notes: string[] }

/** Muse Wonder writes the chapter heading and lede; the numbers are computed locally. */
export async function museChapter(state: State, month: string): Promise<MuseChapter> {
  const sys = `You title and introduce one month in a person's money story inside the app CashGlome. ${VOICE}
Return ONLY JSON: {"title": {"before": string, "emphasis": string, "after": string}, "lede": string, "notes": string[]}.
title: a short magazine-style headline about this month (max 8 words in total). "emphasis" is the 1-3 word phrase that will be set in italics; "after" is usually ".".
lede: 2-3 sentences, max 55 words, that tell the month as a story using the real figures.
notes: 3 surprising, specific observations a bank app would never make (max 20 words each).`;
  const out = await chat(state.settings, state.settings.ai.storyModel, [
    { role: 'system', content: sys },
    { role: 'user', content: JSON.stringify(statsDigest(state, month)) },
  ], { temperature: 0.7, max_tokens: 700, timeoutMs: 40000 });
  const j = extractJSON<{ title?: { before?: string; emphasis?: string; after?: string }; lede?: string; notes?: string[] }>(out);
  if (!j.title?.emphasis || !j.lede) throw new Error('Muse returned an incomplete chapter');
  return {
    title: [{ t: j.title.before ?? '' }, { t: j.title.emphasis, em: true }, { t: j.title.after ?? '.' }],
    lede: j.lede,
    notes: (j.notes ?? []).map(String).slice(0, 3),
  };
}

export async function museAsk(state: State, question: string): Promise<string> {
  const sys = `You answer questions inside CashGlome, a personal money app. ${VOICE} Start with a clear answer ("Yes, if…" / "Not yet."), then 2-4 short sentences with numbers in ${state.profile.currency}. You are not a licensed financial adviser: for investment questions give general education, not personal buy or sell picks.\nDATA: ${JSON.stringify(statsDigest(state))}`;
  return (await chat(state.settings, state.settings.ai.storyModel, [{ role: 'system', content: sys }, { role: 'user', content: question }], { temperature: 0.5, max_tokens: 400, timeoutMs: 35000 })).trim();
}

/** Offline answers: affordability maths and simple pattern hints. */
export function localAsk(state: State, q: string): string {
  const cur = state.profile.currency;
  const s = computeStats(state.entries, state.month);
  const spare = Math.max(0, s.inflow - projection(s).projectedSpend);
  const amt = findAmounts(q).sort((a, b) => b.value - a.value)[0]?.value;
  if (amt) {
    if (!s.inflow) return `I can't tell yet. Write down this month's income first and I'll weigh ${money(amt, cur)} against it.`;
    if (amt <= spare * 0.5) return `Yes. At your current pace you'll have about ${money(spare, cur)} left this month, and ${money(amt, cur)} is ${Math.round((amt / spare) * 100)}% of that.`;
    if (amt <= spare) return `Yes, but it's tight. ${money(amt, cur)} would use most of the ${money(spare, cur)} you're on track to keep this month. Waiting a week would give you more room.`;
    const monthly = Math.max(spare, s.inflow * 0.1);
    return `Not yet. You're on track to keep about ${money(spare, cur)} this month. Put aside ${money(monthly, cur)} a month and you'll have ${money(amt, cur)} in about ${Math.ceil(amt / monthly)} months. Add it as a goal and it will be tracked here.`;
  }
  if (/save|saving/i.test(q)) return `You're keeping ${Math.round(Math.max(0, s.savingsRate) * 100)}% of what comes in. A good target is 20%. The fastest way there is your largest flexible category: cut it by a third and see the difference in Plans.`;
  return `This month: ${money(s.inflow, cur)} in, ${money(s.spend, cur)} spent. Try asking "Can I afford a 300k phone?" or "How do I save more?". Connect Meta Muse in Settings for fuller answers.`;
}

/* ——— Remembering chapters, so Muse is asked rarely ———
   A month's story is rewritten only when its entry count reaches a new doubling (4, 8, 16, 32…),
   or, for the current month, at most once a day and only if entries changed since, or after a deletion. Stories are kept
   on this device between launches. `first` (the month's oldest entry id) ties a story to the data it
   was written from, so a reset or an import never shows a stale story. */
export interface SavedChapter { step: string; day: string; count: number; first: string; ch: MuseChapter }
const CACHE = 'cg-muse';

export function loadChapters(): Record<string, SavedChapter> {
  try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { return {}; }
}
export function saveChapters(all: Record<string, SavedChapter>) {
  const keep = Object.keys(all).sort().slice(-24); // two years is plenty
  try { localStorage.setItem(CACHE, JSON.stringify(Object.fromEntries(keep.map((m) => [m, all[m]])))); } catch { /* storage full or blocked */ }
}

export const chapterStep = (month: string, count: number, model: string) => `${month}:${Math.floor(Math.log2(Math.max(4, count)))}:${model}`;

/** The saved story if it still belongs to this month's data (same entries, none deleted since). */
export const validChapter = (saved: SavedChapter | undefined, first: string | undefined, count: number) =>
  (saved && first && saved.first === first && count >= saved.count ? saved.ch : null);

export function chapterIsStale(saved: SavedChapter | undefined, o: { month: string; count: number; first: string; model: string; today: string; current: boolean }) {
  if (!saved || saved.first !== o.first || o.count < saved.count) return true;
  if (saved.step !== chapterStep(o.month, o.count, o.model)) return true;
  return o.current && saved.day !== o.today && saved.count !== o.count;
}
