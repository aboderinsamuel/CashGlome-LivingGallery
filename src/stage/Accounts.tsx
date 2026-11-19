import { useMemo, useState, type Dispatch } from 'react';
import { artSrc, PAINTINGS } from '../lib/art';
import { money, monthLabel, todayISO } from '../lib/format';
import { relDay } from '../lib/memory';
import type { Action } from '../lib/store';
import type { State } from '../lib/types';
import { circleStatus, incomeRecord, peopleOf, pricesOf, readCircle } from './books';
import { safeToSpend } from './askPainting';
import { dateInWords } from './words';
import './accounts.css';

/** A painting at the head of each folio, labelled like a museum wall. */
function Vignette({ id, focus = '50% 40%' }: { id: string; focus?: string }) {
  const p = PAINTINGS[id];
  return (
    <figure className="acc-vig">
      <img src={artSrc(id, 'md')} alt="" style={{ objectPosition: focus }} loading="lazy" />
      {p && <figcaption><i>{p.title}</i> · {p.artist}, {p.year}</figcaption>}
    </figure>
  );
}

const DEBT_EXAMPLES = ['lent Ada 5k', 'borrowed 10k from Tunde', 'split dinner 12k with Mei', 'Ada paid back 2k'];

/** A line you can tap: it goes into the writing bar, ready to change and send. */
function Example({ text, onFill }: { text: string; onFill: (t: string) => void }) {
  return <button type="button" className="acc-ex" onMouseDown={(e) => e.preventDefault()} onClick={() => onFill(text)}>“{text}”</button>;
}

/** People: who owes whom, and the savings circles you belong to. Nothing here is a form: every change is a line
 *  in the book, written in the bar below. The buttons only start the line for you. */
export function PeoplePage({ state, dispatch, onFill }: { state: State; dispatch: Dispatch<Action>; onFill: (t: string) => void }) {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur);
  const today = todayISO();
  const people = useMemo(() => peopleOf(state.entries), [state.entries]);
  const circles = useMemo(() => (state.circles ?? []).map((c) => circleStatus(c, state.entries, today)), [state.circles, state.entries, today]);
  const [circleLine, setCircleLine] = useState('');
  const [circleErr, setCircleErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const addCircle = () => {
    const c = readCircle(circleLine, today);
    if (!c) { setCircleErr('I need the name, how many people, and what each pays. For example: “Ajo of 10 people, 20k monthly, my turn is 4th”.'); return; }
    dispatch({ type: 'circle', circle: c }); setCircleLine(''); setCircleErr('');
  };
  const owedToYou = people.reduce((a, p) => a + p.owesYou, 0), youOwe = people.reduce((a, p) => a + p.youOwe, 0);

  return (
    <div className="page acc">
      <header className="acc-head">
        <div className="kicker">{dateInWords()}</div>
        <h1>People <i>&amp; circles</i></h1>
        <p>Write it in the bar below, the way you’d say it. This page keeps itself: who owes whom, and the circles you save with.</p>
      </header>
      {/* II. People */}
      <section className="acc-folio">
        <Vignette id="taxcollectors" focus="50% 45%" />
        <div className="acc-body">
          <div className="numeral">Debts and loans <span>· I</span></div>
          <h2>Who owes <i>whom</i></h2>
          {people.length ? (
            <>
              <p className="acc-note">{owedToYou > 0 && <>Owed to you: <b>{m(owedToYou)}</b>. </>}{youOwe > 0 && <>You owe: <b>{m(youOwe)}</b>.</>}{!owedToYou && !youOwe && 'Everyone is square.'}</p>
              <ul className="acc-rows">
                {people.map((p) => {
                  const isOpen = open === p.name;
                  return (
                    <li key={p.name} className={'acc-person' + (isOpen ? ' open' : '')}>
                      <button type="button" className="acc-person-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.name)}>
                        <span className="initial" aria-hidden>{p.name[0]}</span>
                        <span className="who">{p.name}<small>{p.lines[p.lines.length - 1].text}</small></span>
                        <span className={`amt ${p.net > 0 ? 'owed' : p.net < 0 ? 'owe' : ''}`}>{p.net === 0 ? 'Square' : p.net > 0 ? `owes you ${m(p.net)}` : `you owe ${m(-p.net)}`}</span>
                        <span className="acc-chev" aria-hidden>›</span>
                      </button>
                      {isOpen && (
                        <div className="acc-person-more">
                          <ol className="acc-history" aria-label={`Everything with ${p.name}`}>
                            {[...p.lines].reverse().map((l, i) => (
                              <li key={i}><span className="d">{relDay(l.date)}</span><span className="t">{l.text}</span><span className="v">{l.delta > 0 ? `+${m(l.delta)}` : `−${m(-l.delta)}`}</span></li>
                            ))}
                          </ol>
                          <div className="acc-acts">
                            {p.net > 0 && <button type="button" className="btn primary" onClick={() => onFill(`${p.name} paid back `)}>{p.name} paid me back…</button>}
                            {p.net < 0 && <button type="button" className="btn primary" onClick={() => onFill(`paid ${p.name} back `)}>I paid {p.name} back…</button>}
                            {p.net >= 0 && <button type="button" className="btn" onClick={() => onFill(`lent ${p.name} `)}>Lent {p.name} more…</button>}
                            {p.net <= 0 && <button type="button" className="btn" onClick={() => onFill(`borrowed from ${p.name} `)}>Borrowed from {p.name}…</button>}
                          </div>
                          <p className="acc-hint">The line goes into the bar below. Add the amount and send it.</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="acc-hint">Someone new? Write it in the bar below, for example {DEBT_EXAMPLES.slice(0, 2).map((x, i) => <span key={x}>{i ? ' or ' : ''}<Example text={x} onFill={onFill} /></span>)}.</p>
            </>
          ) : (
            <>
              <p className="acc-empty">Nobody owes anybody yet. Write a loan in the bar below, or tap one:</p>
              <div className="acc-exs">{DEBT_EXAMPLES.map((x) => <Example key={x} text={x} onFill={onFill} />)}</div>
            </>
          )}
        </div>
      </section>

      {/* III. Circles */}
      <section className="acc-folio">
        <Vignette id="jumak" focus="50% 50%" />
        <div className="acc-body">
          <div className="numeral">Savings circles <span>· II</span></div>
          <h2>Savings <i>circles</i></h2>
          <p className="acc-note">Ajo, susu, tanda, hui, chit fund, stokvel: everyone pays in, one takes the pot.</p>
          {circles.map((s) => (
            <div className="acc-circle" key={s.circle.id}>
              <div className="ring" aria-label={`Round ${s.round} of ${s.circle.members}`}>
                {s.schedule.map((r) => <span key={r.round} className={`dot ${r.mine ? 'mine' : ''} ${r.round <= s.round ? 'past' : ''}`} style={{ transform: `rotate(${(r.round - 1) * (360 / s.circle.members)}deg) translateY(-34px)` }} />)}
                <b>{s.round}<small>/{s.circle.members}</small></b>
              </div>
              <div className="info">
                <div className="name">{s.circle.name} <small>{m(s.circle.contribution)} a {s.circle.every}, {s.circle.members} people</small></div>
                <div className="line">{s.payoutDone ? `You took the pot of ${m(s.pot)} ${relDay(s.payoutDate)}.` : `Your turn: round ${s.circle.myTurn}, ${relDay(s.payoutDate)}. The pot will be ${m(s.pot)}.`}</div>
                <div className="line soft">{s.paidIn >= s.expected ? `Paid in ${m(s.paidIn)}, up to date.` : `Paid in ${m(s.paidIn)} of ${m(s.expected)} so far.`}</div>
                <button type="button" className="btn acc-paid" onClick={() => onFill(`${s.circle.name.toLowerCase()} ${m(s.circle.contribution)}`)}>Paid this round…</button>
              </div>
              <button className="acc-x" onClick={() => dispatch({ type: 'removeCircle', id: s.circle.id })} aria-label={`Remove ${s.circle.name}`}>×</button>
            </div>
          ))}
          {!circles.length && <p className="acc-hint">Describe your circle once. Then tap Paid this round each time you pay in.</p>}
          <form className="acc-add" onSubmit={(e) => { e.preventDefault(); addCircle(); }}>
            <input value={circleLine} onChange={(e) => setCircleLine(e.target.value)} placeholder="Ajo of 10 people, 20k monthly, my turn is 4th" aria-label="Describe a savings circle" />
            <button type="submit" disabled={!circleLine.trim()}>Keep</button>
          </form>
          {circleErr && <p className="acc-err">{circleErr}</p>}
        </div>
      </section>

    </div>
  );
}

/** Beneath the ledger: your own prices over time, and the income record to print. */
export function LedgerReports({ state }: { state: State }) {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur);
  const today = todayISO();
  const prices = useMemo(() => pricesOf(state.entries, today), [state.entries, today]);
  const record = useMemo(() => incomeRecord(state.entries, 6, today), [state.entries, today]);
  const recordTotal = record.reduce((a, r) => a + r.total, 0);
  const recordMonths = record.filter((r) => r.total > 0).length;

  return (
    <div className="page acc acc-reports">
      {/* IV. Prices: only once something has been bought twice */}
      {prices.rate !== null && <section className="acc-folio">
        <Vignette id="market" focus="50% 55%" />
        <div className="acc-body">
          <div className="numeral">Your inflation <span>· I</span></div>
          <h2>Your own <i>prices</i></h2>
          {prices.rate !== null ? (
            <>
              <div className="acc-big">{prices.rate >= 0 ? '+' : '−'}{Math.abs(Math.round(prices.rate * 1000) / 10)}%<span> on the things you buy again</span></div>
              <ul className="acc-rows prices">
                {prices.moves.map((x) => (
                  <li key={x.label}><span className="who">{x.label}<small>{monthLabel(x.thenMonth)} → {monthLabel(x.nowMonth)}</small></span><span className="amt">{m(x.then)} → {m(x.now)} <em>{x.change >= 0 ? '+' : '−'}{Math.abs(Math.round(x.change * 100))}%</em></span></li>
                ))}
              </ul>
              <p className="acc-note">Weighted by how much of your money each one takes. Your rate, not the country’s.</p>
            </>
          ) : (
            <p className="acc-empty">When you buy the same thing in two different months (bread, fuel, data, the bus), your own inflation rate appears here.</p>
          )}
        </div>
      </section>}

      {/* V. Income record */}
      <section className="acc-folio acc-record">
        <Vignette id="balance" focus="50% 40%" />
        <div className="acc-body">
          <div className="numeral">Proof of income <span>· II</span></div>
          <h2>The income <i>record</i></h2>
          <p className="acc-note">Six months of money in, for a landlord, lender or visa office. Printed from this device.</p>
          <table className="acc-table">
            <thead><tr><th>Month</th><th>Sources</th><th className="r">Came in</th></tr></thead>
            <tbody>
              {record.map((r) => (
                <tr key={r.month}><td>{monthLabel(r.month)}</td><td>{r.byCat.map((c) => `${c.name} ${m(c.total)}`).join(' · ') || '—'}</td><td className="r">{m(r.total)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>Average</td><td>{recordMonths} {recordMonths === 1 ? 'month' : 'months'} with income</td><td className="r">{m(recordMonths ? recordTotal / recordMonths : 0)}</td></tr></tfoot>
          </table>
          <button className="acc-print" onClick={() => { document.body.classList.add('printing-record'); window.print(); setTimeout(() => document.body.classList.remove('printing-record'), 500); }}>Print the record</button>
        </div>
      </section>

    </div>
  );
}
