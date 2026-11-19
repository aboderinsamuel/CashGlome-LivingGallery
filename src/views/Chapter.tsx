import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cat } from '../lib/categories';
import { chapterOf, computeStats, momentsOf, projection, recurringOf, spaceSegs, type Chapter as Ch, type Stats } from '../lib/analytics';
import { dayCardOf, paintingOf, restorationOf, PATCHES, type Restoration } from '../lib/art';
import { money, monthLabel, shiftMonth, todayISO } from '../lib/format';
import { useInView, useStages } from '../lib/inview';
import type { State } from '../lib/types';
import type { Action } from '../lib/store';
import { Sticker } from '../components/Stickers';
import { Icon } from '../components/Icons';
import { LivingArt } from '../components/LivingArt';
import { PlateLabel, RestorationPlate, revealTime, warmPlate } from '../components/Restoration';
import { WhatIf } from './WhatIf';
import { Coins } from '../components/Coins';
import { voiceSupport } from '../lib/speech';
import { Photo } from '../components/Photo';

interface Props {
  state: State;
  dispatch: (a: Action) => void;
  museChapter?: { title: Ch['title']; lede: string; notes: string[] } | null;
  onOpenCategory: (id: string) => void;
  onEdition: () => void;
  onWrite: (hint?: string) => void;
  onPlans: () => void;
  onGallery: () => void;
  onSay: () => void;
  onSnap: () => void;
  onShare: () => void;
}

const ease = [0.2, 0.8, 0.2, 1] as const;
const reveal = { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '0px 0px 120px 0px' }, transition: { duration: 0.4, ease } };

export function Chapter({ state, dispatch, museChapter, onOpenCategory, onEdition, onWrite, onPlans, onGallery, onSay, onSnap, onShare }: Props) {
  const canSay = useMemo(() => voiceSupport() !== null, []);
  const cur = state.profile.currency;
  const calm = state.settings.calm;
  const s = useMemo(() => computeStats(state.entries, state.month), [state.entries, state.month]);
  const prev = useMemo(() => computeStats(state.entries, shiftMonth(state.month, -1)), [state.entries, state.month]);
  const local = chapterOf(state, s);
  const ch = museChapter ? { ...local, title: spaceSegs(museChapter.title), lede: museChapter.lede } : local;
  const pageRef = useRef<HTMLDivElement>(null);
  const empty = !s.entries.length;
  const top = s.byCat.filter((c) => c.id !== 'savings');
  const pj = projection(s);
  const mon = monthLabel(state.month).split(' ')[0];
  const painting = paintingOf(s);
  const r = useMemo(() => restorationOf(state.entries, state.month, state.quiet), [state.entries, state.quiet, state.month]);
  const stage = useStages(2);
  // Once this page is drawn, quietly prepare last month's painting: the usual next tap.
  useEffect(() => {
    if (stage < 2) return;
    const t = setTimeout(() => warmPlate(paintingOf(prev)), 600);
    return () => clearTimeout(t);
  }, [stage, prev]);

  // Patches cleaned since you last looked are shown being cleaned, then remembered.
  const seen = state.seenRestored[state.month] ?? 0;
  const [shownSeen] = useState(seen);
  useEffect(() => {
    if (r.restored <= seen) return;
    const t = setTimeout(() => dispatch({ type: 'seenRestored', month: state.month, n: r.restored }), revealTime(r.restored - shownSeen) * 1000 + 300);
    return () => clearTimeout(t);
  }, [r.restored, seen, shownSeen, state.month, dispatch]);

  return (
    <div className="page" ref={pageRef}>
      {/* ——— Opening: the month's painting, cleaned as you write ——— */}
      <header className="hero">
        <div className="hero-text">
          <motion.div className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '6px 12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold)' }}>Chapter {ch.numeral}</span>
            <span>{monthLabel(state.month)}</span>
            {s.isCurrent && <span>· Day {s.dayOfMonth} of {s.monthDays}</span>}
          </motion.div>
          <motion.h1 className="display hero-title" key={ch.title.map((x) => x.t).join('')}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            {ch.title.map((seg, i) => seg.em ? <em key={i}>{seg.t}</em> : <span key={i}>{seg.t}</span>)}
          </motion.h1>
          <motion.p className="lede" style={{ marginTop: 26 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.4, ease }}>
            {ch.lede}
          </motion.p>
          <p className="purpose">Each month of your book is a chapter: a story of where the money went, and a painting under old varnish. Every line you write cleans one of its 30 patches.</p>
          {empty && s.isCurrent && (
            <motion.div className="starts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }}>
              <button className="start" onClick={() => onWrite(cur === 'NGN' ? 'Lunch 3,500' : 'Lunch 14')}><Icon.list size={22} /><b>Type</b><span>{cur === 'NGN' ? '“Lunch 3,500”' : '“Lunch 14”'}</span></button>
              {canSay && <button className="start" onClick={onSay}><Icon.mic size={22} /><b>Say</b><span>“Got paid {cur === 'NGN' ? '350k' : '3,200'}”</span></button>}
              <button className="start" onClick={onSnap}><Icon.camera size={22} /><b>Snap</b><span>A receipt or a thing</span></button>
            </motion.div>
          )}
        </div>
        <motion.figure className="hero-art" initial={{ opacity: 0, y: 16, rotate: 0.8 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.5, ease, delay: 0.04 }}>
          <button onClick={onGallery} aria-label="Open the gallery" style={{ display: 'block', width: '100%', cursor: 'pointer' }}>
            <RestorationPlate painting={painting} r={r} seen={shownSeen} calm={calm} />
          </button>
          <PlateLabel painting={painting} r={r} reason={r.complete ? 'Fully restored. It hangs in your gallery.' : s.isCurrent ? 'Cleaned a patch at a time as you write.' : undefined} />
          {!empty && (
            <button className="btn" onClick={onShare} style={{ marginTop: 14 }}>
              <Icon.share size={15} /> {r.complete ? 'Share the restored painting' : 'Share this chapter'}
            </button>
          )}
        </motion.figure>
      </header>

      {stage >= 1 && <>
      {/* ——— The month in 100 coins: where the money went, at a glance ——— */}
      {!empty && <Coins s={s} entries={state.entries} cur={cur} calm={calm} onOpen={onOpenCategory} />}
      {s.entries.some((e) => e.photo) && (
        <motion.div {...reveal} className="painted-row">
          <span className="kicker">Painted this month</span>
          <div className="painted-strip">
            {s.entries.filter((e) => e.photo).slice(-8).reverse().map((e) => (
              <button key={e.id} onClick={onGallery} title={`${e.label} · ${money(e.amount, cur)}`} className="mini-frame"><Photo id={e.photo} style={{ width: '100%', height: '100%' }} /></button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ——— Today ——— */}
      {s.isCurrent && <Today state={state} r={r} calm={calm} onWrite={onWrite} />}

      {/* ——— Figures ——— */}
      {!empty && (
        <motion.div {...reveal} className="figures">
          <Figure label="Came in" value={money(s.inflow, cur, { compact: s.inflow >= 1e7 })} note={prev.inflow ? delta(s.inflow, prev.inflow * (s.isCurrent ? s.dayOfMonth / s.monthDays : 1), 'on last month so far') : s.inByCat[0] ? `Mostly ${cat(s.inByCat[0].id).name.toLowerCase()}` : 'Nothing written yet'} tone="in" />
          <Figure label="Went out" value={money(s.spend, cur, { compact: s.spend >= 1e7 })} note={`${s.entries.filter((e) => e.dir === 'out').length} entries`} />
          <Figure label="Put aside" value={money(s.vault, cur, { compact: s.vault >= 1e7 })} note={s.inflow ? `${Math.round(Math.max(0, s.savingsRate) * 100)}% of income kept` : 'Savings and investing'} />
          <Figure label="Daily pace" value={money(pj.dailyBurn, cur, { compact: pj.dailyBurn >= 1e6 })} note={s.isCurrent ? `About ${money(pj.projectedSpend, cur, { compact: true })} by month end` : 'Average per day'} />
        </motion.div>
      )}

      {!empty && <Strip s={s} state={state} />}
      </>}

      {stage >= 2 && <>

      {/* ——— Where it went ——— */}
      {top.length > 0 && (
        <section className="section">
          <motion.div className="section-head" {...reveal}>
            <h2 className="h2">Where it <em>went</em></h2>
            <p className="body-serif">Each block is sized by what it took. Open one to see every entry behind it.</p>
          </motion.div>
          <div className="tiles">
            {top.slice(0, 7).map((c, i) => <Tile key={c.id} c={c} i={i} cur={cur} spend={s.spend} bounds={pageRef} onClick={() => onOpenCategory(c.id)} />)}
          </div>
        </section>
      )}

      {/* ——— Character ——— */}
      {!empty && (
        <section className="section two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 56, alignItems: 'center' }}>
          <motion.div {...reveal}>
            <div className="kicker">Who you were this month</div>
            <h2 className="h2" style={{ marginTop: 14, fontSize: 'clamp(44px, 5vw, 64px)' }}>{ch.character.name}</h2>
            <p className="body-serif" style={{ marginTop: 14, maxWidth: 460 }}>{ch.character.line} Your painting this month is <em>{painting.title}</em>: {painting.why.charAt(0).toLowerCase() + painting.why.slice(1)}</p>
            {museChapter?.notes?.length ? (
              <ul style={{ margin: '22px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10, maxWidth: 520 }}>
                {museChapter.notes.map((n, i) => <li key={i} style={{ display: 'flex', gap: 12, fontSize: 15 }}><span style={{ font: 'italic 400 16px var(--serif)', color: 'var(--gold)' }}>{['i.', 'ii.', 'iii.'][i]}</span>{n}</li>)}
              </ul>
            ) : null}
          </motion.div>
          <CharacterCard name={ch.character.name} line={ch.character.line} paintingId={painting.id} month={monthLabel(state.month)} owner={state.profile.name} calm={calm} />
        </section>
      )}

      {!empty && <Moments state={state} s={s} />}
      {!empty && <Feelings s={s} cur={cur} calm={calm} />}

      {!empty && s.inflow > 0 && (
        <section className="section">
          <WhatIf state={state} s={s} />
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}><button className="pillbtn" onClick={onPlans}>Set a goal in Plans <Icon.arrowUR size={11} /></button></div>
        </section>
      )}

      {!empty && <Recurring state={state} />}

      {/* ——— The Edition, bound like a book ——— */}
      {!empty && (
        <motion.section className="section" {...reveal}>
          <button onClick={onEdition} className="edition-cta">
            <LivingArt id="hunters" dust light calm={calm} shade="linear-gradient(90deg, rgba(14,10,6,.86) 0%, rgba(14,10,6,.55) 45%, rgba(14,10,6,.05) 80%)" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'relative', padding: 'clamp(30px, 5vw, 56px)', maxWidth: 680 }}>
              <div style={{ font: 'italic 400 17px var(--serif)', color: 'var(--gold-2)' }}>The Edition, in seven parts</div>
              <div style={{ marginTop: 14, font: '360 clamp(46px, 6vw, 78px)/0.92 var(--serif)', letterSpacing: '-0.04em' }}>The {mon} <em>Edition</em></div>
              <p style={{ font: '400 18px/1.45 var(--serif)', color: 'rgba(246,238,220,.75)', marginTop: 16 }}>Your month told as a short illustrated book, one painting to a page. Made to be watched, and shared if you like.</p>
              <span className="btn" style={{ marginTop: 24, background: '#F6EEDC', color: '#1A140D', borderColor: 'transparent' }}><Icon.play size={12} /> Open the book</span>
            </div>
          </button>
        </motion.section>
      )}
      </>}
    </div>
  );
}

/* ——— Today: the day's card and today's cleaning ——— */
/** One key holds the date the card was last turned over (older versions kept a key per day). */
const CARD_KEY = 'cg-card';
function cardFlippedToday() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith('cg-card-')) continue;
      if (k === 'cg-card-' + todayISO() && localStorage.getItem(k) === '1') localStorage.setItem(CARD_KEY, todayISO());
      localStorage.removeItem(k);
    }
    return localStorage.getItem(CARD_KEY) === todayISO();
  } catch { return false; }
}
function Today({ state, r, calm, onWrite }: { state: State; r: Restoration; calm: boolean; onWrite: (h?: string) => void }) {
  const card = useMemo(() => dayCardOf(state), [state]);
  const [flipped, setFlipped] = useState(cardFlippedToday);
  const flip = () => { setFlipped(true); try { localStorage.setItem(CARD_KEY, todayISO()); } catch { /* fine */ } };
  const left = Math.max(0, r.todayCap - Math.min(r.todayCap, r.today));
  return (
    <motion.section className="today" {...reveal}>
      <div className={'flip tcard' + (flipped ? ' on' : '')} style={{ padding: 0, border: 0, background: 'transparent' }}>
        <div className="flip-inner" style={{ minHeight: 230 }}>
          <button className="flip-face" onClick={flip} disabled={!card} style={{ cursor: card ? 'pointer' : 'default', textAlign: 'left' }}>
            <LivingArt id={card?.painting.id ?? 'goldsmith'} focus={card?.focus} calm={calm} light shade="linear-gradient(transparent 35%, rgba(14,10,6,.78))" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', left: 22, right: 22, bottom: 20, color: '#F6EEDC' }}>
              <div style={{ font: 'italic 400 15px var(--serif)', color: 'var(--gold-2)' }}>Today's card{card ? `, ${card.numeral}` : ''}</div>
              <div style={{ font: '500 15px var(--grot)', marginTop: 6 }}>{card ? 'Turn it over' : 'Write three lines to draw your first card'}</div>
            </div>
          </button>
          <div className="flip-face flip-back" style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: 24, display: 'flex', flexDirection: 'column' }}>
            {card && <>
              <div className="kicker" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Today's card</span><span style={{ font: 'italic 400 15px var(--serif)', color: 'var(--gold)' }}>{card.numeral}</span></div>
              <div style={{ font: '360 32px/1.05 var(--serif)', letterSpacing: '-0.025em', marginTop: 16 }}>{card.title}</div>
              <p className="small" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 12, color: 'var(--ink-2)' }}>{card.line}</p>
              <div className="small" style={{ marginTop: 'auto', paddingTop: 12 }}>A new card tomorrow. Detail from <em>{card.painting.title}</em>.</div>
            </>}
          </div>
        </div>
      </div>

      <div className="tcard" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="kicker">Today's cleaning</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {Array.from({ length: r.todayCap }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 44, borderRadius: 6, background: i < r.today ? 'linear-gradient(135deg, #F3D98B, #B08A3A)' : 'var(--fill)', boxShadow: i < r.today ? 'inset 0 0 0 1px rgba(255,255,255,.4)' : 'inset 0 0 0 1px var(--line)' }} />
          ))}
        </div>
        <div style={{ font: '360 22px/1.2 var(--serif)', marginTop: 16, letterSpacing: '-0.015em' }}>
          {r.complete ? 'This month is fully restored.' : left ? <>{left} more {left === 1 ? 'line cleans' : 'lines clean'} a patch today</> : 'Today’s patches are clean.'}
        </div>
        <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>
          {r.gilded.length ? `${r.gilded.length} gilded ${r.gilded.length === 1 ? 'entry' : 'entries'} this month cleaned an extra patch. ` : 'Now and then an entry is gilded and cleans an extra patch. '}
          {PATCHES - r.restored > 0 && `${PATCHES - r.restored} patches left.`}
        </div>
        {left > 0 && !r.complete && <button className="pillbtn" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => onWrite()}>Write a line</button>}
      </div>
    </motion.section>
  );
}

function delta(now: number, before: number, suffix: string) {
  if (!before) return suffix;
  const d = (now - before) / before;
  return `${d >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(d * 100))}% ${suffix}`;
}

function Figure({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'in' }) {
  return (
    <div style={{ borderTop: '1px solid var(--ink)', paddingTop: 12 }}>
      <div className="label" style={{ color: 'var(--ink-2)' }}>{label}</div>
      <div className="stat-num" style={{ marginTop: 10, color: tone === 'in' ? 'var(--green)' : undefined }}>{value}</div>
      <div className="small" style={{ marginTop: 8 }}>{note}</div>
    </div>
  );
}

/* The month, day by day: stacked category strokes per day, income marks above. */
function Strip({ s, state }: { s: Stats; state: State }) {
  const cur = state.profile.currency;
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.sqrt(Math.max(1, ...s.days.map((d) => d.out)));
  const H = 150;
  const today = s.isCurrent ? s.dayOfMonth : s.monthDays;
  const byDay = useMemo(() => s.days.map((d) => s.entries.filter((e) => e.date === d.date)), [s]);
  const [chart, shown] = useInView<HTMLDivElement>();
  return (
    <motion.section className="section" style={{ marginTop: 84 }} {...reveal}>
      <div className="section-head">
        <h2 className="h2">The month, <em>day by day</em></h2>
        <p className="body-serif">Each column is a day, coloured by what the money went on. Green dots are money in. Hover a day to read it.</p>
      </div>
      <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
        <div ref={chart} className={'days' + (shown ? ' in' : '') + (state.settings.calm ? ' still' : '')} style={{ display: 'grid', gridTemplateColumns: `repeat(${s.monthDays}, 1fr)`, gap: 4, alignItems: 'end', height: H + 40 }}>
          {s.days.map((d, i) => {
            const items = byDay[i].filter((e) => e.dir === 'out' && cat(e.category).nature !== 'save');
            const future = i + 1 > today;
            const h = (Math.sqrt(d.out) / max) * H;
            return (
              <div key={d.date} onMouseEnter={() => setHover(i)} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', position: 'relative' }}>
                {d.in > 0 && <div className="dot" style={{ ['--i' as string]: i, position: 'absolute', top: Math.max(0, H - h - 26), left: '50%', marginLeft: -4, width: 8, height: 8, borderRadius: 4, background: 'var(--green)' }} />}
                {future ? (
                  <div style={{ height: 22, borderRadius: 5, background: 'var(--fill)' }} />
                ) : d.out === 0 ? (
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--ink-4)' }} />
                ) : (
                  <div className="bar"
                    style={{ ['--i' as string]: i, height: Math.max(4, h), borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', outline: hover === i ? '1.5px solid var(--ink)' : undefined, outlineOffset: 2 }}>
                    {items.map((e) => <div key={e.id} style={{ flex: e.amount, background: cat(e.category).color, borderTop: '1px solid rgba(36,31,23,.18)' }} />)}
                  </div>
                )}
                <div className="num" style={{ height: 22, paddingTop: 8, textAlign: 'center', font: '500 10px/1 var(--grot)', color: i + 1 === today && s.isCurrent ? 'var(--accent)' : 'var(--ink-3)' }}>{(i + 1) % 5 === 0 || i === 0 || (i + 1 === today && s.isCurrent) ? i + 1 : ''}</div>
              </div>
            );
          })}
        </div>
        {hover !== null && byDay[hover].length > 0 && (
          <div className="glass" style={{ position: 'absolute', bottom: H + 48, left: `clamp(0px, calc(${((hover + 0.5) / s.monthDays) * 100}% - 130px), calc(100% - 260px))`, width: 260, borderRadius: 14, padding: 14, zIndex: 5, pointerEvents: 'none' }}>
            <div className="label">{new Date(s.days[hover].date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {byDay[hover].slice(0, 6).map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: cat(e.category).color, flex: 'none' }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                  <span className="num" style={{ color: e.dir === 'in' ? 'var(--green)' : undefined, fontWeight: 600 }}>{e.dir === 'in' ? '+' : ''}{money(e.amount, cur)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function Tile({ c, i, cur, spend, bounds, onClick }: { c: Stats['byCat'][number]; i: number; cur: string; spend: number; bounds: React.RefObject<HTMLElement>; onClick: () => void }) {
  const C = cat(c.id);
  const span = i === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : i === 1 ? { gridColumn: 'span 2' } : {};
  const big = i === 0;
  const share = Math.round((c.total / Math.max(1, spend)) * 100);
  return (
    <motion.div {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }} style={{ ...span, position: 'relative' }}>
      <motion.button onClick={onClick} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        style={{ width: '100%', height: '100%', textAlign: 'left', borderRadius: 20, background: C.color, color: C.ink, padding: big ? 26 : 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(36,31,23,.14), 0 18px 30px -22px rgba(36,31,23,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ font: `600 ${big ? 15 : 13}px/1.2 var(--grot)`, letterSpacing: '-0.01em' }}>{C.name}</span>
          <span style={{ font: `600 ${big ? 13 : 12}px var(--grot)`, opacity: 0.7 }} className="num">{share}%</span>
        </div>
        <div>
          <div className="num" style={{ font: `360 ${big ? 64 : 34}px/0.95 var(--serif)`, letterSpacing: '-0.035em' }}>{money(c.total, cur, { compact: c.total >= (big ? 1e7 : 1e5) })}</div>
          <div style={{ font: '500 12.5px/1.3 var(--grot)', opacity: 0.72, marginTop: 8 }}>{c.count} {c.count === 1 ? 'time' : 'times'}{c.count > 1 ? `, about ${money(c.avg, cur, { compact: c.avg >= 1e5 })} each` : ''}</div>
        </div>
      </motion.button>
      {big && <Sticker name={C.sticker} size={132} rotate={-8} peel bounds={bounds} style={{ position: 'absolute', right: 18, top: 70, zIndex: 3 }} delay={0.2} />}
    </motion.div>
  );
}

/* A collectible card: the month's character, painted. */
function CharacterCard({ name, line, paintingId, month, owner, calm }: { name: string; line: string; paintingId: string; month: string; owner: string; calm: boolean }) {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-11, 11]), { stiffness: 150, damping: 15 });
  const shine = useTransform(mx, [-0.5, 0.5], ['0%', '100%']);
  return (
    <motion.div {...reveal} style={{ perspective: 900 }}>
      <motion.div
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
        onMouseLeave={() => { mx.set(0); my.set(0); }}
        className="frame"
        style={{ rotateX: rx, rotateY: ry, rotate: -2, width: 300, transformStyle: 'preserve-3d', position: 'relative' }}
      >
        <div className="frame-inner" style={{ color: '#241F17' }}>
          <LivingArt id={paintingId} calm={calm} style={{ height: 250, borderRadius: 1 }} />
          <div style={{ padding: '14px 6px 6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11.5px var(--grot)', color: 'rgba(36,31,23,.6)' }}><span>{month}</span><span>{owner || 'You'}</span></div>
            <div style={{ font: '400 32px/0.95 var(--serif)', letterSpacing: '-0.03em', marginTop: 8 }}>{name}</div>
            <div style={{ font: '400 14px/1.35 var(--serif)', color: 'rgba(36,31,23,.72)', marginTop: 6 }}>{line}</div>
          </div>
        </div>
        <motion.div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light', backgroundImage: 'linear-gradient(105deg, transparent 30%, rgba(255,240,200,.75) 48%, transparent 62%)', backgroundSize: '250% 100%', backgroundPositionX: shine }} />
      </motion.div>
    </motion.div>
  );
}

function Moments({ state, s }: { state: State; s: Stats }) {
  const ms = momentsOf(state, s);
  if (!ms.length) return null;
  return (
    <section className="section">
      <motion.div className="section-head" {...reveal}>
        <h2 className="h2">Moments <em>worth noting</em></h2>
        <p className="body-serif">The things a bank statement shows but never points out.</p>
      </motion.div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {ms.map((m, i) => (
          <motion.div key={m.kicker} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="card" style={{ padding: 22, position: 'relative', minHeight: 210, display: 'flex', flexDirection: 'column' }}>
            <div className="kicker">{m.kicker}</div>
            <div style={{ font: '360 34px/1 var(--serif)', letterSpacing: '-0.03em', marginTop: 18, maxWidth: '80%' }}>{m.big}</div>
            <div className="small" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 'auto', paddingTop: 16, lineHeight: 1.45 }}>{m.line}</div>
            <Sticker name={m.sticker} size={54} rotate={i % 2 ? -10 : 10} style={{ position: 'absolute', right: -8, top: -14 }} delay={0.1 * i} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Feelings({ s, cur, calm }: { s: Stats; cur: string; calm: boolean }) {
  const joyItems = s.entries.filter((e) => e.feeling === 'joy').sort((a, b) => b.amount - a.amount).slice(0, 3);
  const regretItems = s.entries.filter((e) => e.feeling === 'regret').sort((a, b) => b.amount - a.amount).slice(0, 3);
  const neutral = Math.max(0, s.spend - s.joy - s.regret);
  const tot = Math.max(1, s.spend);
  return (
    <section className="section">
      <motion.div {...reveal} style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', height: 'clamp(200px, 26vw, 300px)', marginBottom: 30 }}>
        <LivingArt id="carnival" light calm={calm} shade="linear-gradient(rgba(14,10,6,.0) 30%, rgba(14,10,6,.7))" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, color: '#F6EEDC' }}>
          <h2 className="h2" style={{ color: '#F6EEDC' }}>How it <em>felt</em></h2>
          <span className="hide-sm" style={{ font: 'italic 400 14px var(--serif)', opacity: 0.8, textAlign: 'right' }}>The Fight Between Carnival and Lent<br />Pieter Bruegel the Elder, 1559</span>
        </div>
      </motion.div>
      <p className="body-serif" style={{ maxWidth: 560, marginBottom: 22 }}>Feast on one side, restraint on the other. Add “worth it” or “regret” when you write an entry, or mark it later in the Ledger.</p>
      <motion.div {...reveal} style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--fill)' }}>
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${(s.joy / tot) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1 }} style={{ background: 'var(--gold)' }} />
        <div style={{ flex: neutral, background: 'var(--fill-2)' }} />
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${(s.regret / tot) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1 }} style={{ background: 'var(--vermilion)' }} />
      </motion.div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 28, marginTop: 26 }}>
        {[{ t: 'Worth it', v: s.joy, list: joyItems, c: 'var(--gold)' }, { t: 'Would take back', v: s.regret, list: regretItems, c: 'var(--vermilion)' }].map((g) => (
          <motion.div key={g.t} {...reveal} style={{ borderTop: '1px solid var(--ink)', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: g.c }} />{g.t}</span>
              <span className="stat-num" style={{ fontSize: 24 }}>{money(g.v, cur)}</span>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              {g.list.length ? g.list.map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', font: '400 16px/1.3 var(--serif)', color: 'var(--ink-2)' }}><span>{e.label}</span><span className="num" style={{ font: '500 13px var(--ui)' }}>{money(e.amount, cur)}</span></div>
              )) : <div className="small">Nothing marked yet.</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Recurring({ state }: { state: State }) {
  const list = recurringOf(state.entries);
  if (!list.length) return null;
  const cur = state.profile.currency;
  const monthly = list.reduce((a, r) => a + r.amount, 0);
  return (
    <section className="section">
      <motion.div className="section-head" {...reveal}>
        <h2 className="h2">Comes back <em>every month</em></h2>
        <p className="body-serif">{money(monthly, cur)} a month in repeat payments, or {money(monthly * 12, cur, { compact: true })} a year. Worth a look now and then.</p>
      </motion.div>
      <div className="card" style={{ padding: 6 }}>
        {list.map((r, i) => (
          <div key={r.label + i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderTop: i ? '1px solid var(--line)' : undefined }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: cat(r.category).color, flex: 'none' }} />
            <span style={{ flex: 1, font: '400 18px var(--serif)' }}>{r.label}</span>
            <span className="small hide-sm">{cat(r.category).name}{r.months > 1 ? `, ${r.months} months running` : ''}</span>
            <span className="num" style={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>{money(r.amount, cur)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

