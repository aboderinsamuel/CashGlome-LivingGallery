// Ask about your money. Answers are worked out on this device from your own entries whenever the question
// is one we can count (totals, top categories, comparisons, "can I afford"), so the numbers are exact and
// you can see every entry behind them. Only questions we can't count go to Meta Muse, and only if you agree.
import { CATEGORIES, cat } from './categories';
import { computeStats, projection } from './analytics';
import { chat } from './ai';
import { dayLabel, money, monthLabel, monthOf, shiftMonth, todayISO } from './format';
import { parseOne } from './parser';
import type { Entry, State } from './types';

export interface Figure { label: string; value: string }
export interface Answer {
  text: string;
  figures?: Figure[];
  rows?: Entry[];
  by: 'device' | 'muse' | 'help';
  error?: string;
}
export interface Turn { q: string; a: Answer }

const QWORDS = /^(how|what|what's|whats|when|where|why|which|who|did|do|does|am|is|are|was|were|can|could|should|will|would|have|has|show|compare|tell|list|give)\b/i;
/** A question rather than an entry: ends with "?" or starts like one. */
export const isQuestion = (t: string) => { const s = t.trim(); return s.length > 3 && (/\?\s*$/.test(s) || QWORDS.test(s)); };

/* ——— Periods ——— */
interface Period { from: string; to: string; name: string; month?: string }
const iso = (d: Date) => todayISO(d);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function periodOf(q: string): Period | null {
  const now = new Date(), today = iso(now);
  const t = q.toLowerCase();
  const monthP = (m: string, name: string): Period => ({ from: m + '-01', to: m + '-31', name, month: m });
  if (/\btoday\b|\btonight\b/.test(t)) return { from: today, to: today, name: 'today' };
  if (/\byesterday\b|\blast night\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() - 1); return { from: iso(d), to: iso(d), name: 'yesterday' }; }
  const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  if (/\bthis week\b/.test(t)) return { from: iso(monday(now)), to: today, name: 'this week' };
  if (/\blast week\b/.test(t)) { const m = monday(now); m.setDate(m.getDate() - 7); const e = new Date(m); e.setDate(e.getDate() + 6); return { from: iso(m), to: iso(e), name: 'last week' }; }
  if (/\blast month\b/.test(t)) { const m = shiftMonth(monthOf(today), -1); return monthP(m, 'last month'); }
  if (/\bthis month\b/.test(t)) return monthP(monthOf(today), 'this month');
  if (/\bthis year\b/.test(t)) return { from: today.slice(0, 4) + '-01-01', to: today, name: 'this year' };
  if (/\b(ever|all time|altogether|in total|so far|since i started)\b/.test(t)) return { from: '0000', to: '9999', name: 'since you started' };
  const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b|\\b${m.slice(0, 3)}\\b`).test(t) && !(m === 'may' && /\bmay i\b/.test(t)));
  if (mi >= 0) {
    let y = now.getFullYear();
    if (mi > now.getMonth()) y -= 1; // "in December" asked in March means last December
    const m = `${y}-${String(mi + 1).padStart(2, '0')}`;
    return monthP(m, `in ${monthLabel(m).split(' ')[0]}`);
  }
  return null;
}
const inPeriod = (e: Entry, p: Period) => e.date >= p.from && e.date <= p.to;
/** Months named in the question, in the order they're written ("October than September"). */
function monthsIn(q: string) {
  const t = q.toLowerCase(), now = new Date();
  return MONTHS.map((name, i) => ({ i, at: t.search(new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`)) }))
    .filter((x) => x.at >= 0 && !(x.i === 4 && /\bmay i\b/.test(t)))
    .sort((a, b) => a.at - b.at)
    .map(({ i }) => `${i > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear()}-${String(i + 1).padStart(2, '0')}`);
}

/* ——— Topics: categories or words from your own labels ——— */
const STOP = new Set('how much many did do does i my me on in for at the a an of to and or what whats what\'s when where which who is was were am are can could should will would have has spend spent spending money this last month week year today yesterday ever all time total so far most more less than compared vs versus get got make made earn earned paid pay buy bought afford left over average day per usually times did about tell show give list there it that these those be been being with from by take took taking go went going getting thing things stuff purchase purchases item items expense expenses cost costs first times often im its like need want really just also some any way your you we our much money'.split(' '));
const SYNONYMS: Record<string, string[]> = {
  food: ['dining', 'groceries'], eating: ['dining'], restaurants: ['dining'], takeout: ['dining'], drinks: ['dining'],
  transport: ['transport'], transportation: ['transport'], rides: ['transport'], fuel: ['transport'],
  bills: ['bills'], utilities: ['bills'], rent: ['rent'], home: ['rent'], house: ['rent'],
  subscriptions: ['subscriptions'], subs: ['subscriptions'], shopping: ['shopping'], clothes: ['shopping'],
  gadgets: ['tech'], tech: ['tech'], fun: ['fun'], entertainment: ['fun'], outings: ['fun'],
  betting: ['betting'], gambling: ['betting'], health: ['health'], medical: ['health'],
  selfcare: ['selfcare'], beauty: ['selfcare'], hair: ['selfcare'], education: ['education'], school: ['education'], learning: ['education'],
  family: ['giving'], giving: ['giving'], gifts: ['giving'], charity: ['giving'], church: ['giving'],
  savings: ['savings'], saving: ['savings'], investing: ['savings'], investments: ['savings'], debt: ['debt'], loans: ['debt'],
  business: ['business'], travel: ['travel'], trips: ['travel'], groceries: ['groceries'],
  salary: ['salary'], sales: ['trade'], freelance: ['craft'],
};

/** guess: the word you asked about when no entry says it and we counted its category instead. */
interface Topic { cats: Set<string>; words: string[]; name: string; guess?: string }
/** Words in the question that look like a thing you bought but appear in none of your entries. */
function missingWords(q: string, entries: Entry[]) {
  const t = q.toLowerCase().replace(/[?.!,]/g, ' ');
  const words = t.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d/.test(w) && !MONTHS.some((m) => m.startsWith(w)));
  return words.filter((w) => !Object.keys(SYNONYMS).includes(w) && !CATEGORIES.some((c) => c.name.toLowerCase().includes(w)) && !entries.some((e) => e.label.toLowerCase().includes(w) || e.text.toLowerCase().includes(w)));
}
function topicOf(q: string, entries: Entry[]): Topic | null {
  const t = q.toLowerCase().replace(/[?.!,]/g, ' ');
  const cats = new Set<string>();
  for (const [w, ids] of Object.entries(SYNONYMS)) if (new RegExp(`\\b${w}\\b`).test(t)) ids.forEach((i) => cats.add(i));
  for (const c of CATEGORIES) {
    if (new RegExp(`\\b${c.name.toLowerCase().replace(/[&]/g, '.')}\\b`).test(t)) cats.add(c.id);
  }
  // Words that appear in your own entries ("suya", "uber", "netflix") beat category guesses.
  const words = t.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d/.test(w));
  const hits = words.filter((w) => entries.some((e) => e.label.toLowerCase().includes(w) || e.text.toLowerCase().includes(w)));
  // "uber" with no entry that says uber: count its category (getting around) and say so.
  let guess: string | undefined;
  if (!cats.size && !hits.length) for (const w of words) { const c = CATEGORIES.find((x) => x.words.includes(w)); if (c) { cats.add(c.id); guess = w; break; } }
  if (!cats.size && !hits.length) return null;
  if (hits.length && !cats.size) return { cats, words: hits, name: hits.join(' ') };
  return { cats, words: [], name: [...cats].map((c) => cat(c).name.toLowerCase()).join(' and '), guess };
}
const matches = (e: Entry, t: Topic | null) => !t || t.cats.has(e.category) || t.words.some((w) => e.label.toLowerCase().includes(w) || e.text.toLowerCase().includes(w));

/* ——— The local answerer ——— */
const sum = (l: Entry[]) => l.reduce((a, e) => a + e.amount, 0);
const newestFirst = (l: Entry[]) => [...l].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
const count = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function answerLocally(state: State, q: string): Answer | null {
  const a = answerInner(state, q);
  const guess = a?.by === 'device' ? topicOf(q, state.entries)?.guess : undefined;
  if (a && guess) a.text = `No entry says “${guess}”, so I counted ${topicOf(q, state.entries)!.name}. ${a.text}`;
  return a;
}

function answerInner(state: State, q: string): Answer | null {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur);
  const t = q.toLowerCase();
  const all = state.entries;
  if (!all.length) return { text: 'There is nothing written down yet. Add a few things you bought or got paid, then ask again.', by: 'help' };
  const today = todayISO(), thisMonth = monthOf(today);
  const asked = periodOf(q);
  const p: Period = asked ?? { from: thisMonth + '-01', to: thisMonth + '-31', name: 'this month', month: thisMonth };
  const topic = topicOf(q, all);
  const missing = topic ? [] : missingWords(q, all);
  const when = (d: string) => { const l = dayLabel(d); return /^(Today|Yesterday)$/.test(l) ? l.toLowerCase() : `on ${l}`; };
  // Advice ("should I invest…") is not something we can count.
  if (/^should i\b/.test(t) && !/\bafford\b|\b(buy|get)\b/.test(t)) return null;
  const notFound = (): Answer => ({ text: `I can't find ${missing.join(' ')} in anything you've written down.`, by: 'device' });
  const inP = all.filter((e) => inPeriod(e, p));
  const outs = inP.filter((e) => e.dir === 'out');
  const ins = inP.filter((e) => e.dir === 'in');

  // Can I afford X?
  if (/\bafford\b|\bcan i (buy|get|spend)\b|\bshould i (buy|get)\b/.test(t)) {
    const amount = parseOne(q)?.amount;
    const s = computeStats(all, thisMonth);
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
    if (!s.inflow) return { text: `I can't tell yet: nothing that came in this month is written down. Add your income (for example "Got paid ${cur === 'NGN' ? '350k' : '3,200'}") and ask again.`, figures, by: 'device' };
    const ending = endLeft >= 0 ? `should have about ${m(endLeft)} left at month end` : `are on course to be about ${m(-endLeft)} short by month end`;
    if (!amount) return { text: `Right now you have about ${m(left)} left this month and ${ending}. Tell me the price and I'll check it.`, figures, by: 'device' };
    const after = endLeft - amount;
    const text = left < amount
      ? `Not this month. You have ${m(left)} left, which is ${m(amount - left)} less than ${m(amount)}.`
      : after >= 0
        ? `Yes, it fits. You have ${m(left)} left now and ${ending}, so after ${m(amount)} about ${m(after)} would remain.`
        : `It's tight. You have ${m(left)} left now, but you ${ending}${endLeft >= 0 ? `, so ${m(amount)} would leave you ${m(-after)} short` : `, and ${m(amount)} would make that ${m(-after)}`}.`;
    return { text: text + ' This is from what you have written down, not financial advice.', figures, by: 'device' };
  }

  // How much is left?
  if (/\b(left|remaining|balance)\b/.test(t) && !topic) {
    const s = computeStats(all, p.month ?? thisMonth);
    const left = s.inflow - s.spend - s.vault;
    return { text: `${s.inflow ? `About ${m(left)} is left ${p.name}: ${m(s.inflow)} came in, ${m(s.spend)} went out and ${m(s.vault)} was put aside.` : `Nothing that came in ${p.name} is written down, so I can't say what's left.`}`, figures: [{ label: 'Came in', value: m(s.inflow) }, { label: 'Went out', value: m(s.spend) }, { label: 'Put aside', value: m(s.vault) }], by: 'device' };
  }

  // Where did it go / what do I spend most on?
  if (/where (did|does|do).*(go|went)|spend (the )?most|most of my money|biggest (category|expense category)|top (categories|category|spending)/.test(t)) {
    const byCat = new Map<string, number>();
    outs.filter((e) => cat(e.category).nature !== 'save').forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    const top = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (!top.length) return { text: `No spending written down ${p.name}.`, by: 'device' };
    const pct = (v: number) => Math.round((v / total) * 100);
    return {
      text: `${p.name.charAt(0).toUpperCase() + p.name.slice(1)}, most went on ${cat(top[0][0]).name.toLowerCase()}: ${m(top[0][1])}, ${pct(top[0][1])}% of everything you spent.${top[1] ? ` Then ${cat(top[1][0]).name.toLowerCase()} (${m(top[1][1])})${top[2] ? ` and ${cat(top[2][0]).name.toLowerCase()} (${m(top[2][1])})` : ''}.` : ''}`,
      figures: top.map(([id, v]) => ({ label: cat(id).name, value: `${m(v)} · ${pct(v)}%` })),
      by: 'device',
    };
  }

  // Biggest purchase
  if (/(biggest|largest|most expensive|priciest|highest)\b.*(purchase|expense|thing|buy|spend|payment|item)?/.test(t) && !/category/.test(t)) {
    const pool = outs.filter((e) => matches(e, topic) && cat(e.category).nature !== 'save');
    if (!pool.length) return { text: `Nothing ${topic ? `on ${topic.name} ` : ''}spent ${p.name}.`, by: 'device' };
    const big = [...pool].sort((a, b) => b.amount - a.amount);
    return { text: `Your biggest ${topic ? topic.name + ' ' : ''}spend ${p.name} was ${big[0].label}: ${m(big[0].amount)} ${when(big[0].date)}.`, rows: big.slice(0, 5), by: 'device' };
  }

  // When did I last …? / How many times …?
  if (/\bwhen did i (last|first)\b|\blast time\b/.test(t)) {
    if (!topic) return missing.length ? notFound() : null;
    const hits = newestFirst(all.filter((e) => matches(e, topic)));
    if (!hits.length) return { text: `I can't find ${topic.name} in your entries.`, by: 'device' };
    const first = /\bfirst\b/.test(t);
    const e = first ? hits[hits.length - 1] : hits[0];
    return { text: `The ${first ? 'first' : 'last'} time was ${when(e.date)}: ${e.label}, ${m(e.amount)}.`, rows: hits.slice(0, 5), by: 'device' };
  }
  if (/\bhow (many|often)\b|\bhow many times\b/.test(t)) {
    if (!topic) return missing.length ? notFound() : null;
    const hits = inP.filter((e) => matches(e, topic));
    return { text: `${count(hits.length, 'time')} ${p.name}, ${m(sum(hits))} in all.`, rows: newestFirst(hits).slice(0, 8), by: 'device' };
  }

  // Compared with last month, or two named months
  const named = monthsIn(q);
  if (named.length >= 2 || /\b(more|less|compare|compared|than last|vs|versus|up|down)\b.*\b(last|previous|before)\b|\bcompared?\b/.test(t)) {
    // "more than last month" compares this month with last; "October than September" compares those two.
    const cm = named.length >= 2 ? named[0] : asked?.month && asked.name !== 'last month' ? asked.month : thisMonth;
    const pm = named.length >= 2 ? named[1] : shiftMonth(cm, -1);
    const pick = (mm: string) => all.filter((e) => monthOf(e.date) === mm && e.dir === 'out' && matches(e, topic) && (topic || cat(e.category).nature !== 'save'));
    const a = sum(pick(cm)), b = sum(pick(pm));
    const isNow = cm === thisMonth;
    const sofar = isNow ? Number(today.slice(8, 10)) : 31;
    const bSame = isNow ? sum(pick(pm).filter((e) => Number(e.date.slice(8, 10)) <= sofar)) : b;
    const what = topic ? `on ${topic.name}` : '';
    const diff = a - bSame;
    const text = !b ? `You spent ${m(a)} ${what} ${isNow ? 'so far this month' : `in ${monthLabel(cm)}`}, and nothing ${what} is written down for ${monthLabel(pm)}.`
      : `${isNow ? `So far this month you've spent ${m(a)} ${what}; by this day last month it was ${m(bSame)}` : `${monthLabel(cm)}: ${m(a)} ${what}; ${monthLabel(pm)}: ${m(b)}`}. That's ${Math.abs(diff) < 1 ? 'the same' : `${m(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}${isNow ? '' : ` in ${monthLabel(cm).split(' ')[0]}`}`}.`;
    return { text: text.replace(/\s+/g, ' ').replace(' .', '.').replace(' ;', ';'), figures: [{ label: monthLabel(cm), value: m(a) }, { label: `${monthLabel(pm)}${isNow ? ' (same days)' : ''}`, value: m(bSame) }], by: 'device' };
  }

  // Average per day
  if (/\b(per day|a day|each day|daily|average)\b/.test(t)) {
    const s = computeStats(all, p.month ?? thisMonth);
    const pj = projection(s);
    return { text: `You spend about ${m(pj.dailyBurn)} a day on everyday things ${p.month === thisMonth || !p.month ? 'this month' : `in ${monthLabel(p.month)}`}, not counting rent, bills and renewals.`, figures: [{ label: 'Everyday spending per day', value: m(pj.dailyBurn) }, { label: 'Days counted', value: String(s.dayOfMonth || s.monthDays) }], by: 'device' };
  }

  // Income
  if (/\b(earn|earned|make|made|income|got paid|get paid|came in|come in|receive|received|salary|paid me)\b/.test(t)) {
    const pool = ins.filter((e) => matches(e, topic && [...topic.cats].some((c) => cat(c).dir === 'in') ? topic : null));
    return { text: pool.length ? `${m(sum(pool))} came in ${p.name}, from ${count(pool.length, 'entry').replace('entrys', 'entries')}.` : `No money coming in is written down ${p.name}.`, rows: newestFirst(pool).slice(0, 8), by: 'device' };
  }

  // Saved
  if (/\b(save|saved|saving|savings|invest|invested|put aside)\b/.test(t)) {
    const pool = outs.filter((e) => cat(e.category).nature === 'save');
    const s = p.month ? computeStats(all, p.month) : null;
    return { text: pool.length ? `You put aside ${m(sum(pool))} ${p.name}${s?.inflow ? `, ${Math.round((sum(pool) / s.inflow) * 100)}% of what came in` : ''}.` : `Nothing put aside ${p.name} yet.`, rows: newestFirst(pool).slice(0, 8), by: 'device' };
  }

  // Spending: on a topic, or in a period
  if (/\b(spend|spent|spending|cost|pay|paid|buy|bought|went out|go out|use|used)\b/.test(t) || topic || asked) {
    if (!topic && missing.length) return notFound();
    const pool = outs.filter((e) => matches(e, topic) && (topic?.cats.has('savings') || cat(e.category).nature !== 'save'));
    const total = sum(outs.filter((e) => cat(e.category).nature !== 'save'));
    if (!pool.length) return { text: `Nothing ${topic ? `on ${topic.name} ` : ''}written down ${p.name}.`, by: 'device' };
    const share = topic && total ? ` That's ${Math.round((sum(pool) / total) * 100)}% of your spending.` : '';
    const listy = /\bwhat did i\b|\blist\b|\bshow\b/.test(t) && !topic;
    return {
      text: listy
        ? `${p.name.charAt(0).toUpperCase() + p.name.slice(1)} you spent ${m(sum(pool))} across ${count(pool.length, 'thing')}.`
        : `You spent ${m(sum(pool))}${topic ? ` on ${topic.name}` : ''} ${p.name}, across ${count(pool.length, 'entry').replace('entrys', 'entries')}.${share}`,
      rows: newestFirst(pool).slice(0, 8),
      by: 'device',
    };
  }
  return null;
}

/* ——— Muse, for everything else ——— */
function factsFor(state: State) {
  const cur = state.profile.currency;
  const now = monthOf(todayISO());
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(now, -i));
  const monthly = months.map((mm) => {
    const s = computeStats(state.entries, mm);
    return `${monthLabel(mm)}: in ${Math.round(s.inflow)}, out ${Math.round(s.spend)}, put aside ${Math.round(s.vault)}; by category: ${s.byCat.map((c) => `${cat(c.id).name} ${Math.round(c.total)}`).join(', ') || 'none'}`;
  });
  const recent = newestFirst(state.entries.filter((e) => e.date >= shiftMonth(now, -1) + '-01')).slice(0, 220)
    .map((e) => `${e.date} ${e.dir === 'in' ? '+' : '-'}${Math.round(e.amount * 100) / 100} "${e.label}" [${cat(e.category).name}${e.feeling ? ', ' + e.feeling : ''}]`);
  return `Today is ${todayISO()}. Currency ${cur}. Name ${state.profile.name || 'not given'}.
Monthly totals (computed exactly by the app):\n${monthly.join('\n')}
Goals: ${state.goals.map((g) => `${g.name} ${g.amount}`).join('; ') || 'none'}
Entries this month and last month (newest first):\n${recent.join('\n')}`;
}

export async function askMuse(state: State, q: string, history: Turn[]): Promise<Answer> {
  const sys = `You answer questions about one person's money inside CashGlome, a money diary. Use ONLY the facts below; they come from what the person wrote down. Prefer the app's monthly totals over adding things up yourself. If the facts don't contain the answer, say so plainly and suggest what to write down. Answer in 1 to 4 short sentences, in plain words a 12-year-old understands, with amounts formatted in ${state.profile.currency}. Never invent entries or numbers. For investment or legal questions, give only general ideas and say it isn't financial advice.\n\n${factsFor(state)}`;
  const msgs = [
    { role: 'system' as const, content: sys },
    ...history.slice(-4).flatMap((h) => [{ role: 'user' as const, content: h.q }, { role: 'assistant' as const, content: h.a.text }]),
    { role: 'user' as const, content: q },
  ];
  const text = await chat(state.settings, state.settings.ai.storyModel || state.settings.ai.parseModel, msgs, { temperature: 0.2, max_tokens: 400 });
  return { text: text.trim(), by: 'muse' };
}

export const SUGGESTED = (cur: string) => [
  'Where did my money go this month?',
  'How much did I spend on food this month?',
  'Am I spending more than last month?',
  `Can I afford something for ${cur === 'NGN' ? '50k' : '200'}?`,
  'What was my biggest purchase this month?',
  'How much is left this month?',
];

export const HELP: Answer = {
  by: 'help',
  text: 'I can count things like "How much did I spend on transport last week?", "Where did my money go in October?", "When did I last buy suya?" or "Can I afford 40k?". Connect Meta Muse in Settings to ask anything else.',
};
