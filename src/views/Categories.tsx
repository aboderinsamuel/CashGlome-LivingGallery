// Your own words for money: add, rename, recolour, hide or remove the kinds of money in and money out.
import { useMemo, useState } from 'react';
import { CATEGORIES, PIGMENTS, type Category } from '../lib/categories';
import { money, monthOf, todayISO, uid } from '../lib/format';
import type { Action } from '../lib/store';
import type { Dir, State } from '../lib/types';
import { Icon } from '../components/Icons';

export function CategoriesPane({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const [dir, setDir] = useState<Dir>('out');
  return (
    <div className="cats">
      <div className="cats-seg" role="tablist">
        <button role="tab" aria-selected={dir === 'out'} className={dir === 'out' ? 'on' : ''} onClick={() => setDir('out')}>Money out</button>
        <button role="tab" aria-selected={dir === 'in'} className={dir === 'in' ? 'on' : ''} onClick={() => setDir('in')}>Money in</button>
      </div>
      <p className="cats-note">{dir === 'out' ? 'The kinds of spending you keep. Add your own, like “Church”, “Fuel for the shop” or “Kids”.' : 'Where your money comes from. Add your own sources, like “Shop sales”, “Tutoring” or “Rent from the flat”.'}</p>
      <CategoryList key={dir} dir={dir} state={state} dispatch={dispatch} />
    </div>
  );
}

function CategoryList({ dir, state, dispatch }: { dir: Dir; state: State; dispatch: (a: Action) => void }) {
  const cur = state.profile.currency;
  const month = monthOf(todayISO());
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const list = CATEGORIES.filter((c) => c.dir === dir);
  const use = useMemo(() => {
    const u: Record<string, { n: number; month: number }> = {};
    for (const e of state.entries) { const x = (u[e.category] ??= { n: 0, month: 0 }); x.n++; if (monthOf(e.date) === month) x.month += e.amount; }
    return u;
  }, [state.entries, month]);
  const catchAll = dir === 'out' ? 'other' : 'windfall';

  return (
    <>
      {adding
        ? <div className="cats-add"><CategoryForm dir={dir} onCancel={() => setAdding(false)} onSave={(next) => { dispatch({ type: 'category', category: next }); setAdding(false); }} /></div>
        : <button className="cats-new" onClick={() => setAdding(true)}><Icon.plus size={15} />{dir === 'out' ? 'Add a category' : 'Add a source of income'}</button>}
      <ul className="cats-list">
        {list.map((c) => (
          <li key={c.id} className={c.hidden ? 'hidden' : ''}>
            {editing === c.id ? (
              <CategoryForm initial={c} dir={dir} onCancel={() => setEditing(null)} onSave={(next) => { dispatch({ type: 'category', category: next }); setEditing(null); }} />
            ) : removing === c.id ? (
              <RemoveRow c={c} uses={use[c.id]?.n ?? 0} options={list.filter((x) => x.id !== c.id && !x.hidden)} fallback={catchAll}
                onCancel={() => setRemoving(null)} onRemove={(to) => { dispatch({ type: 'removeCategory', id: c.id, moveTo: to }); setRemoving(null); }} />
            ) : (
              <div className="cats-row">
                <span className="sw" style={{ background: c.color }} aria-hidden />
                <span className="nm">{c.name}{c.custom && <small>yours</small>}{c.hidden && <small>hidden</small>}<em>{use[c.id]?.month ? `${money(use[c.id].month, cur)} this month` : use[c.id]?.n ? `${use[c.id].n} entries` : 'Not used yet'}</em></span>
                {c.custom && <button onClick={() => setEditing(c.id)}>Edit</button>}
                {c.id !== catchAll && (c.hidden
                  ? <button onClick={() => dispatch({ type: 'hideCategory', id: c.id, hidden: false })}>Show</button>
                  : <button onClick={() => (use[c.id]?.n ? setRemoving(c.id) : c.custom ? dispatch({ type: 'removeCategory', id: c.id, moveTo: catchAll }) : dispatch({ type: 'hideCategory', id: c.id, hidden: true }))}>{c.custom ? 'Remove' : 'Hide'}</button>)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function CategoryForm({ initial, dir, onSave, onCancel }: { initial?: Category; dir: Dir; onSave: (c: Category) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [words, setWords] = useState(initial?.words.join(', ') ?? '');
  const [pig, setPig] = useState(() => PIGMENTS.find((p) => p.color === initial?.color) ?? PIGMENTS[0]);
  const ok = name.trim().length > 0;
  const save = () => {
    if (!ok) return;
    const n = name.trim();
    onSave({
      id: initial?.id ?? 'c-' + uid().slice(0, 8), name: n, short: n.length > 14 ? n.slice(0, 13) + '…' : n,
      color: pig.color, ink: pig.ink, dir, nature: dir === 'in' ? 'income' : 'want', sticker: 'star', custom: true,
      words: words.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean),
    });
  };
  return (
    <form className="cats-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={dir === 'out' ? 'Fuel for the shop' : 'Tutoring'} maxLength={40} /></label>
      <label>Words that mean it <small>(optional, separated by commas)</small><input value={words} onChange={(e) => setWords(e.target.value)} placeholder={dir === 'out' ? 'generator, diesel' : 'lesson, student'} /></label>
      <div className="cats-pigments" role="radiogroup" aria-label="Colour">
        {PIGMENTS.map((p) => <button type="button" key={p.name} role="radio" aria-checked={pig.name === p.name} title={p.name} className={pig.name === p.name ? 'on' : ''} style={{ background: p.color }} onClick={() => setPig(p)}><span className="sr">{p.name}</span></button>)}
        <span className="pig-name">{pig.name}</span>
      </div>
      <div className="cats-btns"><button type="button" onClick={onCancel}>Cancel</button><button type="submit" className="gilt" disabled={!ok}>{initial ? 'Save' : 'Add'}</button></div>
    </form>
  );
}

function RemoveRow({ c, uses, options, fallback, onCancel, onRemove }: { c: Category; uses: number; options: Category[]; fallback: string; onCancel: () => void; onRemove: (to: string) => void }) {
  const [to, setTo] = useState(fallback);
  return (
    <div className="cats-remove">
      <p>{uses} {uses === 1 ? 'entry is' : 'entries are'} in <b>{c.name}</b>. Move {uses === 1 ? 'it' : 'them'} to:</p>
      <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Move entries to">{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <div className="cats-btns"><button onClick={onCancel}>Keep it</button><button className="danger" onClick={() => onRemove(to)}>{c.custom ? 'Move and remove' : 'Move and hide'}</button></div>
    </div>
  );
}
