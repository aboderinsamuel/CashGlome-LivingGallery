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

/** The counting house: what is safe to spend, who owes whom, the circles, prices, and the income record. */
export function Accounts({ state, dispatch, onToday }: { state: State; dispatch: Dispatch<Action>; onToday: () => void }) {
  const cur = state.profile.currency;
  const m = (n: number) => money(n, cur);
  const today = todayISO();
  const safe = useMemo(() => safeToSpend(state, today), [state, today]);
  const people = useMemo(() => peopleOf(state.entries), [state.entries]);
  const circles = useMemo(() => (state.circles ?? []).map((c) => circleStatus(c, state.entries, today)), [state.circles, state.entries, today]);
  const prices = useMemo(() => pricesOf(state.entries, today), [state.entries, today]);
  const record = useMemo(() => incomeRecord(state.entries, 6, today), [state.entries, today]);
  const [circleLine, setCircleLine] = useState('');
  const [circleErr, setCircleErr] = useState('');
  const [showWork, setShowWork] = useState(false);

  const addCircle = () => {
    const c = readCircle(circleLine, today);
    if (!c) { setCircleErr('I need the name, how many people, and what each pays. For example: “Ajo of 10 people, 20k monthly, my turn is 4th”.'); return; }
    dispatch({ type: 'circle', circle: c }); setCircleLine(''); setCircleErr('');
  };
  const owedToYou = people.reduce((a, p) => a + p.owesYou, 0), youOwe = people.reduce((a, p) => a + p.youOwe, 0);
  const recordTotal = record.reduce((a, r) => a + r.total, 0);
  const recordMonths = record.filter((r) => r.total > 0).length;

  return (
    <div className="page acc">
      <header className="acc-head">
        <div className="kicker">{dateInWords()}</div>
        <h1>The <i>accounts</i></h1>
        <p>Counted on this device from what you have written. Nothing here needs a form.</p>
      </header>

      {/* I. Safe to spend */}
      <section className="acc-folio">
        <Vignette id="moneylender" focus="50% 62%" />
        <div className="acc-body">
          <div className="numeral">I</div>
          <h2>Safe to <i>spend</i></h2>
          {safe ? (
            <>
              <div className="acc-big">{m(safe.perDay)}<span> a day</span></div>
              <p className="acc-note">{safe.until ? `Until payday ${relDay(safe.until)}, after every routine you've told me about.` : 'For the rest of this month, after the bills that usually still come.'} About {m(safe.free)} is free in all.</p>
              <button className="acc-link" onClick={() => setShowWork((v) => !v)}>{showWork ? 'Hide the working' : 'Show the working'}</button>
              {showWork && <p className="acc-work">{safe.basis === 'balance' ? 'Your remembered balance, moved on by every entry since, minus each routine due before your next pay, at its lowest point, spread over the days until pay.' : 'Money in this month, minus spending and savings so far, minus the bills your month usually still has, spread over the days left.'}</p>}
            </>
          ) : (
            <p className="acc-empty">Write what came in this month, or tell the painting what you have (“I have 40k”), and I’ll count what is safe each day.</p>
          )}
        </div>
      </section>

      {/* II. People */}
      <section className="acc-folio">
        <Vignette id="taxcollectors" focus="50% 45%" />
        <div className="acc-body">
          <div className="numeral">II</div>
          <h2>Who owes <i>whom</i></h2>
          {people.length ? (
            <>
              <p className="acc-note">{owedToYou > 0 && <>Owed to you: <b>{m(owedToYou)}</b>. </>}{youOwe > 0 && <>You owe: <b>{m(youOwe)}</b>.</>}{!owedToYou && !youOwe && 'Everyone is square.'}</p>
              <ul className="acc-rows">
                {people.map((p) => (
                  <li key={p.name}>
                    <span className="initial" aria-hidden>{p.name[0]}</span>
                    <span className="who">{p.name}<small>{p.lines[p.lines.length - 1].text}</small></span>
                    <span className={`amt ${p.net > 0 ? 'owed' : p.net < 0 ? 'owe' : ''}`}>{p.net === 0 ? 'Square' : p.net > 0 ? `owes you ${m(p.net)}` : `you owe ${m(-p.net)}`}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="acc-empty">Write it as you’d say it: “lent Ada 5k”, “borrowed 10k from Tunde”, “split dinner 12k with Mei”, “Ada paid back 2k”. The book keeps itself.</p>
          )}
        </div>
      </section>

      {/* III. Circles */}
      <section className="acc-folio">
        <Vignette id="jumak" focus="50% 50%" />
        <div className="acc-body">
          <div className="numeral">III</div>
          <h2>Savings <i>circles</i></h2>
          <p className="acc-note">Tontine, susu, tanda, hui, kye, chit fund, stokvel, arisan, partner: everyone pays in each round, and one takes the pot.</p>
          {circles.map((s) => (
            <div className="acc-circle" key={s.circle.id}>
              <div className="ring" aria-label={`Round ${s.round} of ${s.circle.members}`}>
                {s.schedule.map((r) => <span key={r.round} className={`dot ${r.mine ? 'mine' : ''} ${r.round <= s.round ? 'past' : ''}`} style={{ transform: `rotate(${(r.round - 1) * (360 / s.circle.members)}deg) translateY(-34px)` }} />)}
                <b>{s.round}<small>/{s.circle.members}</small></b>
              </div>
              <div className="info">
                <div className="name">{s.circle.name} <small>{m(s.circle.contribution)} a {s.circle.every}, {s.circle.members} people</small></div>
                <div className="line">{s.payoutDone ? `You took the pot of ${m(s.pot)} ${relDay(s.payoutDate)}.` : `Your turn: round ${s.circle.myTurn}, ${relDay(s.payoutDate)}. The pot will be ${m(s.pot)}.`}</div>
                <div className="line soft">{s.paidIn >= s.expected ? `Paid in ${m(s.paidIn)}, up to date.` : `Paid in ${m(s.paidIn)} of ${m(s.expected)} so far. Write “${s.circle.name.toLowerCase()} ${m(s.circle.contribution)}” when you pay.`}</div>
              </div>
              <button className="acc-x" onClick={() => dispatch({ type: 'removeCircle', id: s.circle.id })} aria-label={`Remove ${s.circle.name}`}>×</button>
            </div>
          ))}
          <form className="acc-add" onSubmit={(e) => { e.preventDefault(); addCircle(); }}>
            <input value={circleLine} onChange={(e) => setCircleLine(e.target.value)} placeholder="Ajo of 10 people, 20k monthly, my turn is 4th" aria-label="Describe a savings circle" />
            <button type="submit" disabled={!circleLine.trim()}>Keep</button>
          </form>
          {circleErr && <p className="acc-err">{circleErr}</p>}
        </div>
      </section>

      {/* IV. Prices */}
      <section className="acc-folio">
        <Vignette id="market" focus="50% 55%" />
        <div className="acc-body">
          <div className="numeral">IV</div>
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
      </section>

      {/* V. Income record */}
      <section className="acc-folio acc-record">
        <Vignette id="balance" focus="50% 40%" />
        <div className="acc-body">
          <div className="numeral">V</div>
          <h2>The income <i>record</i></h2>
          <p className="acc-note">Up to six months of money in, set out for a landlord, a lender or a visa office. Printed from this device; nothing is uploaded.</p>
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

      <button className="acc-back" onClick={onToday}>Back to today’s painting</button>
    </div>
  );
}
