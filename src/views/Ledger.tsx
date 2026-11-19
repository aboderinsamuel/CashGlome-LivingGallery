import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CATEGORIES, cat } from '../lib/categories';
import { learn } from '../lib/learn';
import { computeStats } from '../lib/analytics';
import { dayLabel, money, monthLabel } from '../lib/format';
import type { Entry, Feeling, State } from '../lib/types';
import type { Action } from '../lib/store';
import { Icon } from '../components/Icons';
import { Sticker } from '../components/Stickers';
import { Photo } from '../components/Photo';
import { Pigment } from '../components/Mark';

interface Props { state: State; dispatch: (a: Action) => void; filter: string | null; setFilter: (f: string | null) => void; query: string; onAttach: (e: Entry) => void }

export function Ledger({ state, dispatch, filter, setFilter, query, onAttach }: Props) {
  const cur = state.profile.currency;
  const s = useMemo(() => computeStats(state.entries, state.month), [state.entries, state.month]);
  const [sel, setSel] = useState<string | null>(null);
  const [dir, setDir] = useState<'all' | 'in' | 'out'>('all');
  const q = query.trim().toLowerCase();
  const list = useMemo(() => s.entries
    .filter((e) => (!filter || e.category === filter) && (dir === 'all' || e.dir === dir) && (!q || `${e.label} ${e.text} ${cat(e.category).name}`.toLowerCase().includes(q)))
    .sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date))), [s.entries, filter, dir, q]);
  const groups = useMemo(() => {
    const g = new Map<string, Entry[]>();
    for (const e of list) g.set(e.date, [...(g.get(e.date) ?? []), e]);
    return [...g.entries()];
  }, [list]);
  const selected = state.entries.find((e) => e.id === sel) ?? null;
  const sumIn = list.filter((e) => e.dir === 'in').reduce((a, e) => a + e.amount, 0);
  const sumOut = list.filter((e) => e.dir === 'out').reduce((a, e) => a + e.amount, 0);

  return (
    <div className="page" style={{ maxWidth: 1120 }}>
      <div className="kicker"><span style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold)' }}>The ledger</span>, {monthLabel(state.month)}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 22 }}>
        <h1 className="display" style={{ fontSize: 'clamp(46px, 5vw, 76px)' }}>{filter ? <>Every <em>{cat(filter).name.toLowerCase()}</em></> : <>Every <em>line</em></>}</h1>
        <div style={{ display: 'flex', gap: 28 }}>
          <div><div className="small">In</div><div className="stat-num num" style={{ fontSize: 24, color: 'var(--green)' }}>{money(sumIn, cur)}</div></div>
          <div><div className="small">Out</div><div className="stat-num num" style={{ fontSize: 24 }}>{money(sumOut, cur)}</div></div>
        </div>
      </div>
      <p className="purpose">Everything you wrote this month, day by day, with what came in and went out. Tap any line to correct it.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '34px 0 18px', flexWrap: 'wrap' }}>
        <div className="seg">
          {(['all', 'out', 'in'] as const).map((d) => <button key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>{d === 'all' ? 'All' : d === 'in' ? 'Money in' : 'Money out'}</button>)}
        </div>
        {filter && <button className="pillbtn" onClick={() => setFilter(null)} style={{ height: 30, borderRadius: 15, padding: '0 12px' }}><span style={{ width: 10, height: 10, borderRadius: 5, background: cat(filter).color }} />{cat(filter).name}<Icon.close size={12} /></button>}
        <span className="small" style={{ marginLeft: 'auto' }}>{list.length} {list.length === 1 ? 'entry' : 'entries'}{q ? ` matching “${query}”` : ''}</span>
      </div>
      <div className="ledger">
        <div>
          {!groups.length && (
            <div className="card" style={{ padding: '60px 30px', textAlign: 'center', display: 'grid', placeItems: 'center', gap: 14 }}>
              <Sticker name="box" size={110} rotate={-6} />
              <div className="h3">Nothing here yet</div>
              <div className="body-serif" style={{ fontSize: 16 }}>{document.documentElement.dataset.phone !== undefined ? 'Write on the Chapter page, in your own words. It lands here.' : 'Write below, in your own words. “Lunch 14, Uber 9” works.'}</div>
            </div>
          )}
          {groups.map(([date, items]) => {
            const dayOut = items.filter((e) => e.dir === 'out').reduce((a, e) => a + e.amount, 0);
            return (
              <section key={date} className="day-group" style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 10px 8px', borderBottom: '1px solid var(--ink)' }}>
                  <span style={{ font: '400 20px var(--serif)', letterSpacing: '-0.015em' }}>{dayLabel(date)}</span>
                  <span className="small num">{dayOut ? `−${money(dayOut, cur)}` : ''}</span>
                </div>
                <div style={{ paddingTop: 4 }}>
                  {items.map((e) => {
                    const c = cat(e.category);
                    return (
                      <button key={e.id} className={'row' + (sel === e.id ? ' on' : '')} onClick={() => setSel(sel === e.id ? null : e.id)}>
                        {e.photo
                          ? <Photo id={e.photo} className="row-photo" />
                          : <Pigment category={e.category} size={38} />}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</span>
                          <span className="small" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}{e.feeling === 'joy' ? ' · worth it' : e.feeling === 'regret' ? ' · regret' : ''}{e.text && e.text.toLowerCase() !== e.label.toLowerCase() ? ` · “${e.text}”` : ''}</span>
                        </span>
                        <span className="num" style={{ fontWeight: 600, fontSize: 14, color: e.dir === 'in' ? 'var(--green)' : undefined }}>{e.dir === 'in' ? '+' : '−'}{money(e.amount, cur)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          {selected ? (
            <Inspector key={selected.id} e={selected} cur={cur} dispatch={dispatch} close={() => setSel(null)} onAttach={() => onAttach(selected)} />
          ) : (
            <motion.aside key="none" className="inspector card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: 22 }}>
              <div className="label">Categories this month</div>
              <div style={{ display: 'grid', gap: 4, marginTop: 12 }}>
                {s.byCat.map((c) => (
                  <button key={c.id} className={'row' + (filter === c.id ? ' on' : '')} onClick={() => setFilter(filter === c.id ? null : c.id)} style={{ padding: '6px 8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: cat(c.id).color }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{cat(c.id).name}</span>
                    <span className="small num">{money(c.total, cur, { compact: c.total >= 1e6 })}</span>
                  </button>
                ))}
                {!s.byCat.length && <div className="small">Nothing spent yet.</div>}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Inspector({ e, cur, dispatch, close, onAttach }: { e: Entry; cur: string; dispatch: (a: Action) => void; close: () => void; onAttach: () => void }) {
  const up = (patch: Partial<Entry>) => dispatch({ type: 'update', id: e.id, patch });
  const c = cat(e.category);
  return (
    <motion.aside className="inspector glass" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="label">Entry</span>
        <button className="tbtn" onClick={close} aria-label="Close"><Icon.close size={14} /></button>
      </div>
      {e.photo ? (
        <div className="insp-art">
          <div className="artwork"><div className="artwork-inner"><Photo id={e.photo} style={{ width: '100%', maxHeight: 220 }} /></div></div>
          <button className="tbtn" onClick={() => up({ photo: undefined })}><Icon.trash size={13} /> Take down</button>
        </div>
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', gap: 6, padding: '8px 0 4px' }}>
          <Pigment category={c.id} size={72} key={c.id} />
          <button className="tbtn" onClick={onAttach}><Icon.camera size={15} /> Add a photo</button>
        </div>
      )}
      <input className="field" value={e.label} onChange={(ev) => up({ label: ev.target.value })} style={{ font: '400 20px var(--serif)', height: 42, textAlign: 'center', background: 'transparent', border: '1px solid transparent' }} aria-label="Title" />
      {e.text && <div className="small" style={{ textAlign: 'center', marginTop: 4 }}>You wrote “{e.text}”</div>}
      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        <div className="seg" style={{ width: '100%' }}>
          {(['out', 'in'] as const).map((d) => <button key={d} style={{ flex: 1 }} className={e.dir === d ? 'on' : ''} onClick={() => up({ dir: d, category: d === e.dir ? e.category : d === 'in' ? 'windfall' : 'other' })}>{d === 'in' ? 'Money in' : 'Money out'}</button>)}
        </div>
        <Field label="Amount"><input className="field num" type="number" value={e.amount} min={0} onChange={(ev) => up({ amount: Math.max(0, Number(ev.target.value) || 0) })} /></Field>
        <Field label="Category">
          <select className="field" value={e.category} onChange={(ev) => { up({ category: ev.target.value }); learn(e.label, ev.target.value); }}>
            {CATEGORIES.filter((x) => x.dir === e.dir).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input className="field" type="date" value={e.date} onChange={(ev) => ev.target.value && up({ date: ev.target.value })} /></Field>
        {e.dir === 'out' && (
          <Field label="How did it feel?">
            <div className="seg" style={{ width: '100%' }}>
              {([['joy', 'Worth it'], ['meh', 'Neutral'], ['regret', 'Regret']] as [Feeling, string][]).map(([f, l]) => (
                <button key={f} style={{ flex: 1 }} className={(e.feeling ?? 'meh') === f ? 'on' : ''} onClick={() => up({ feeling: f === 'meh' ? undefined : f })}>{l}</button>
              ))}
            </div>
          </Field>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span className="small">{e.source === 'muse' ? 'Read by Muse' : e.source === 'manual' ? 'Edited by you' : 'Read on this device'} · {money(e.amount, cur)}</span>
          <button className="btn danger" onClick={() => { dispatch({ type: 'remove', id: e.id }); close(); }}><Icon.trash size={14} /> Delete</button>
        </div>
      </div>
    </motion.aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 6 }}><span className="small" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>{children}</label>;
}
