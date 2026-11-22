// What a bank statement says, counted on this device. Florin gets these lines in the book's summary and copies
// the figures; without Florin (offline, or no AI in this build) the device says it itself.
import type { Figure } from '../lib/ask';
import { cat } from '../lib/categories';
import { money, spanInWords } from '../lib/format';
import type { Entry, State } from '../lib/types';

export const STATEMENT_Q = /\b(statements?|imported|bank (?:lines|export)|my bank)\b/i;

interface Reading {
  source: string; from: string; to: string; lines: Entry[];
  came: number; went: number; saved: number; spent: number;
  byCat: { id: string; total: number; count: number }[];
  incomes: { id: string; total: number; count: number }[];
  biggest: Entry[];
  often: { label: string; count: number; total: number }[];
}

/** The statements in the book, newest first, each counted. */
export function statementsIn(entries: Entry[]): Reading[] {
  const by = new Map<string, Entry[]>();
  for (const e of entries) if (e.statement) by.set(e.statement, [...(by.get(e.statement) ?? []), e]);
  return [...by.entries()].map(([source, lines]) => {
    const dates = lines.map((e) => e.date).sort();
    const outs = lines.filter((e) => e.dir === 'out'), ins = lines.filter((e) => e.dir === 'in');
    const sum = (l: Entry[]) => Math.round(l.reduce((a, e) => a + e.amount, 0) * 100) / 100;
    const group = (l: Entry[]) => {
      const g = new Map<string, { id: string; total: number; count: number }>();
      for (const e of l) { const x = g.get(e.category) ?? { id: e.category, total: 0, count: 0 }; x.total = Math.round((x.total + e.amount) * 100) / 100; x.count++; g.set(e.category, x); }
      return [...g.values()].sort((a, b) => b.total - a.total);
    };
    const saving = outs.filter((e) => cat(e.category).nature === 'save');
    const spending = outs.filter((e) => cat(e.category).nature !== 'save');
    const names = new Map<string, { label: string; count: number; total: number }>();
    for (const e of spending) { const k = e.label.toLowerCase(); const x = names.get(k) ?? { label: e.label, count: 0, total: 0 }; x.count++; x.total = Math.round((x.total + e.amount) * 100) / 100; names.set(k, x); }
    return {
      source, from: dates[0], to: dates[dates.length - 1], lines,
      came: sum(ins), went: sum(outs), saved: sum(saving), spent: sum(spending),
      byCat: group(spending), incomes: group(ins),
      biggest: [...spending].sort((a, b) => b.amount - a.amount).slice(0, 3),
      often: [...names.values()].filter((x) => x.count > 1).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 3),
    };
  }).sort((a, b) => (a.to < b.to ? 1 : -1));
}

const day = (iso: string) => { const d = new Date(iso + 'T12:00'); return `${d.getDate()} ${d.toLocaleDateString('en', { month: 'long' })}`; };
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Lines for Florin's summary of the book: every figure already counted. */
export function statementDigest(state: State): string {
  const f = (n: number) => money(n, state.profile.currency);
  return statementsIn(state.entries).slice(0, 3).map((r) => [
    `Brought in from a bank statement (${r.source}): ${r.lines.length} lines from ${r.from} to ${r.to}. Came in ${f(r.came)}${r.incomes[0] ? `, mostly ${cat(r.incomes[0].id).name} (${f(r.incomes[0].total)})` : ''}; went out ${f(r.went)}: spent ${f(r.spent)}, put aside ${f(r.saved)}; ${r.came >= r.went ? `more came in than went out, by ${f(Math.round((r.came - r.went) * 100) / 100)}` : `more went out than came in, by ${f(Math.round((r.went - r.came) * 100) / 100)}`} (this is not the account balance).`,
    r.byCat.length ? `Statement spending by category: ${r.byCat.slice(0, 6).map((c) => `${cat(c.id).name} ${f(c.total)} (${c.count} lines, ${pct(c.total, r.spent)}% of spending)`).join(', ')}.` : '',
    r.biggest.length ? `Largest payments on the statement: ${r.biggest.map((e) => `${e.label} ${f(e.amount)} on ${e.date}`).join('; ')}.` : '',
    r.often.length ? `Paid most often on the statement: ${r.often.map((x) => `${x.label} ${x.count} times, ${f(x.total)} in all`).join('; ')}.` : '',
  ].filter(Boolean).join('\n')).join('\n');
}

/** The figures behind a statement answer: the working shown under it. */
export function statementFigures(state: State): Figure[] {
  const r = statementsIn(state.entries)[0];
  if (!r) return [];
  const f = (n: number) => money(n, state.profile.currency);
  return [
    { label: 'Lines on the statement', value: String(r.lines.length) },
    { label: 'Came in', value: f(r.came) },
    { label: 'Spent', value: f(r.spent) },
    { label: 'Put aside', value: f(r.saved) },
    ...(r.byCat[0] ? [{ label: `Most went to ${cat(r.byCat[0].id).name}`, value: `${f(r.byCat[0].total)} · ${pct(r.byCat[0].total, r.spent)}%` }] : []),
  ];
}

/** The device's own reading of the newest statement, in plain words, for when Florin isn't asked. */
export function statementAnswer(state: State): { text: string; figures: Figure[]; rows: Entry[] } {
  const r = statementsIn(state.entries)[0];
  if (!r) return { text: 'No statement has been brought in yet. Choose “Import a statement” by the writing box or in the Ledger, and I’ll read it with you.', figures: [], rows: [] };
  const f = (n: number) => money(n, state.profile.currency);
  const top = r.byCat.slice(0, 3);
  const parts = [
    `Your ${r.source} statement runs from ${spanInWords(r.from, r.to)}: ${r.lines.length} lines.`,
    r.came ? `${f(r.came)} came in${r.incomes[0] ? `, mostly ${cat(r.incomes[0].id).name.toLowerCase()} (${f(r.incomes[0].total)})` : ''}.` : 'Nothing came in on it.',
    `${f(r.spent)} was spent${r.saved ? ` and ${f(r.saved)} put aside, which is a habit worth keeping` : ''}.`,
    top.length ? `The biggest share of your spending went to ${cat(top[0].id).name.toLowerCase()} (${f(top[0].total)}, ${pct(top[0].total, r.spent)}%)${top.length > 1 ? `, then ${top.slice(1).map((c) => `${cat(c.id).name.toLowerCase()} (${f(c.total)})`).join(' and ')}` : ''}.` : '',
    r.often[0] ? `You come back to ${r.often[0].label} most often: ${r.often[0].count} times, ${f(r.often[0].total)} in all.` : '',
    r.biggest[0] ? `Your largest single payment was ${r.biggest[0].label}, ${f(r.biggest[0].amount)} on ${day(r.biggest[0].date)}.` : '',
    r.came - r.went >= 0 ? `Over the statement, ${f(Math.round((r.came - r.went) * 100) / 100)} more came in than went out.` : `Over the statement, ${f(Math.round((r.went - r.came) * 100) / 100)} more went out than came in.`,
  ];
  return { text: parts.filter(Boolean).join(' '), figures: statementFigures(state), rows: r.biggest };
}
