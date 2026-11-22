// CashGlome cloud: an account, and every entry, goal, memory and setting synced between your devices.
// Local-first: the device always has the whole world and works offline. When signed in, changes go up
// and come down in the background; the newest edit of each thing wins (checked again on the server).
// Never uploaded: the Meta Florin key, Spotify tokens, photos.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Remote } from './store';
import type { Entry, Memory, State } from './types';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
export const cloudConfigured = !!(URL && KEY);

// Loaded only when this build has a backend, so people who never sign in don't download it.
let client: Promise<SupabaseClient> | null = null;
export function cloud(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error('Sync is not set up in this build'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cashglome.auth', detectSessionInUrl: true } }));
  return client;
}

/* ——— Account ——— */
export async function signUp(email: string, password: string) {
  const { data, error } = await (await cloud()).auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw new Error(friendly(error.message));
  return { needsConfirm: !data.session };
}
export async function signIn(email: string, password: string) {
  const { error } = await (await cloud()).auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}
export async function resetPassword(email: string) {
  const { error } = await (await cloud()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw new Error(friendly(error.message));
}
export async function signOut() {
  if (cloudConfigured) await (await cloud()).auth.signOut();
  clearMeta();
}
/** Erases the account and, through the database's foreign keys, every row it owns. */
export async function deleteAccount() {
  const { error } = await (await cloud()).rpc('delete_my_account');
  if (error) throw new Error(friendly(error.message));
  await signOut();
}
export async function updatePassword(password: string) {
  const { error } = await (await cloud()).auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
}
export function onSession(cb: (s: Session | null, recovering: boolean) => void) {
  if (!cloudConfigured) return () => {};
  let stop = () => {}, gone = false;
  cloud().then((c) => {
    if (gone) return;
    c.auth.getSession().then(({ data }) => cb(data.session, false));
    const { data } = c.auth.onAuthStateChange((e, s) => cb(s, e === 'PASSWORD_RECOVERY'));
    stop = () => data.subscription.unsubscribe();
  }).catch(() => {});
  return () => { gone = true; stop(); };
}
function friendly(m: string) {
  if (/invalid login/i.test(m)) return 'That email and password don’t match.';
  if (/already registered|already exists/i.test(m)) return 'There’s already an account with that email. Sign in instead.';
  if (/password should be|weak/i.test(m)) return 'Choose a longer password (at least 8 characters).';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: the link is in your inbox.';
  if (/failed to fetch|network/i.test(m)) return 'Can’t reach the server. Check your connection.';
  return m;
}

/* ——— Sync bookkeeping (per device, per account) ——— */
interface Meta { user: string; pulledAt: string; pushedMs: number; profileSig: string; profileMs: number }
const META = 'cashglome.sync';
function readMeta(user: string): Meta {
  try { const m = JSON.parse(localStorage.getItem(META) || 'null') as Meta | null; if (m?.user === user) return m; } catch { /* fresh */ }
  return { user, pulledAt: '1970-01-01T00:00:00Z', pushedMs: 0, profileSig: '', profileMs: 0 };
}
const writeMeta = (m: Meta) => { try { localStorage.setItem(META, JSON.stringify(m)); } catch { /* next time */ } };
const clearMeta = () => { try { localStorage.removeItem(META); } catch { /* fine */ } };
export const lastSynced = () => { try { const m = JSON.parse(localStorage.getItem(META) || 'null') as (Meta & { at?: number }) | null; return m?.at ?? null; } catch { return null; } };

/* ——— Rows ——— */
const entryRow = (u: string, e: Entry) => ({
  user_id: u, id: e.id, date: e.date, amount: e.amount, dir: e.dir, category: e.category, label: e.label, text: e.text,
  feeling: e.feeling ?? null, source: e.source, confidence: e.confidence, routine_id: e.routine ?? null,
  created_ms: e.createdAt, updated_ms: e.updatedAt ?? e.createdAt, deleted: false,
});
type EntryRow = ReturnType<typeof entryRow>;
const rowEntry = (r: EntryRow): Entry => ({
  id: r.id, date: r.date, amount: Number(r.amount), dir: r.dir, category: r.category, label: r.label ?? '', text: r.text ?? '',
  feeling: r.feeling ?? undefined, source: r.source as Entry['source'], confidence: r.confidence ?? 1, routine: r.routine_id ?? undefined,
  createdAt: Number(r.created_ms ?? r.updated_ms), updatedAt: Number(r.updated_ms),
});
const profileOf = (s: State) => ({
  name: s.profile.name, currency: s.profile.currency,
  settings: { ...s.settings, ai: { ...s.settings.ai, key: '' } },
  extras: { seenBadges: s.seenBadges, seenRestored: s.seenRestored, routineLog: s.routineLog },
});

/** One round: pull what changed elsewhere, then push what changed here. Returns what to merge. */
export async function syncOnce(state: State, session: Session, given?: SupabaseClient): Promise<{ remote: Remote | null; pushed: number; pulled: number }> {
  const c = given ?? await cloud();
  const u = session.user.id;
  const meta = readMeta(u);
  const started = Date.now();

  // 1. Pull everything the server has seen since last time.
  const since = meta.pulledAt;
  const [pe, pg, pm, pp] = await Promise.all([
    c.from('entries').select('*').gt('synced_at', since).order('synced_at').limit(5000),
    c.from('goals').select('*').gt('synced_at', since).order('synced_at').limit(1000),
    c.from('memories').select('*').gt('synced_at', since).order('synced_at').limit(2000),
    c.from('profiles').select('*').eq('user_id', u).maybeSingle(),
  ]);
  for (const r of [pe, pg, pm, pp]) if (r.error) throw new Error(friendly(r.error.message));
  let maxAt = since;
  const seen = (at: string) => { if (at > maxAt) maxAt = at; };
  const remote: Remote = { entries: [], goals: [], memories: [], dropEntries: [], dropGoals: [] };
  for (const r of pe.data ?? []) { seen(r.synced_at); if (r.deleted) remote.dropEntries.push(r.id); else remote.entries.push(rowEntry(r)); }
  for (const r of pg.data ?? []) { seen(r.synced_at); if (r.deleted) remote.dropGoals.push(r.id); else remote.goals.push({ id: r.id, name: r.name ?? '', amount: Number(r.amount), emoji: r.emoji ?? 'star', updatedAt: Number(r.updated_ms) }); }
  for (const r of pm.data ?? []) {
    seen(r.synced_at);
    remote.memories.push(r.deleted ? { id: r.id, kind: r.kind, text: '', createdAt: 0, updatedAt: Number(r.updated_ms), deletedAt: -1 } : { ...(r.data as Memory), id: r.id, updatedAt: Number(r.updated_ms) });
  }
  const p = pp.data;
  if (p && Number(p.updated_ms) > meta.profileMs) {
    remote.profile = {
      profile: { name: p.name, currency: p.currency },
      settings: p.settings ?? {},
      seenBadges: p.extras?.seenBadges, seenRestored: p.extras?.seenRestored, routineLog: p.extras?.routineLog,
    };
    meta.profileMs = Number(p.updated_ms);
  }
  // Our own pushes come back on the next pull: keep only what is actually new to this device.
  const eBy = new Map(state.entries.map((e) => [e.id, e.updatedAt ?? e.createdAt]));
  const gBy = new Map(state.goals.map((g) => [g.id, g.updatedAt ?? 0]));
  const mBy = new Map(state.memories.map((m) => [m.id, m.updatedAt]));
  remote.entries = remote.entries.filter((e) => !eBy.has(e.id) || (e.updatedAt ?? 0) > eBy.get(e.id)!);
  remote.dropEntries = remote.dropEntries.filter((id) => eBy.has(id));
  remote.goals = remote.goals.filter((g) => !gBy.has(g.id) || (g.updatedAt ?? 0) > gBy.get(g.id)!);
  remote.dropGoals = remote.dropGoals.filter((id) => gBy.has(id));
  remote.memories = remote.memories.filter((m) => !mBy.has(m.id) ? m.deletedAt !== -1 : m.updatedAt > mBy.get(m.id)!);
  const pulled = remote.entries.length + remote.goals.length + remote.memories.length + remote.dropEntries.length + remote.dropGoals.length + (remote.profile ? 1 : 0);

  // 2. Push what changed on this device since the last push.
  const after = meta.pushedMs;
  const entries = state.entries.filter((e) => (e.updatedAt ?? e.createdAt) > after).map((e) => entryRow(u, e));
  const goneE = state.gone.filter((g) => g.kind === 'entry' && g.at > after).map((g) => ({ user_id: u, id: g.id, updated_ms: g.at, deleted: true }));
  const goals = state.goals.filter((g) => (g.updatedAt ?? 0) > after || after === 0).map((g) => ({ user_id: u, id: g.id, name: g.name, amount: g.amount, emoji: g.emoji, updated_ms: g.updatedAt ?? started, deleted: false }));
  const goneG = state.gone.filter((g) => g.kind === 'goal' && g.at > after).map((g) => ({ user_id: u, id: g.id, updated_ms: g.at, deleted: true }));
  const memories = state.memories.filter((m) => m.updatedAt > after).map((m) => ({ user_id: u, id: m.id, kind: m.kind, data: m.deletedAt === -1 ? {} : m, updated_ms: m.updatedAt, deleted: m.deletedAt === -1 }));
  const prof = profileOf(state);
  const sig = JSON.stringify(prof);
  const profileChanged = sig !== meta.profileSig && !remote.profile;

  const chunks = <T,>(l: T[], n = 500) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
  // The server answers with each row as it now stands. If a newer edit from another device was already there
  // (this device was offline), the server kept it: take that version back instead of keeping ours.
  const up = async (table: string, rows: { id?: string; updated_ms: number }[]) => {
    const kept: Record<string, unknown>[] = [];
    for (const part of chunks(rows)) {
      const { data, error } = await c.from(table).upsert(part, { onConflict: table === 'profiles' ? 'user_id' : 'user_id,id' }).select();
      if (error) throw new Error(friendly(error.message));
      const sent = new Map(part.map((r) => [r.id, r.updated_ms]));
      for (const r of (data ?? []) as Record<string, unknown>[]) if (Number(r.updated_ms) > (sent.get(r.id as string) ?? Infinity)) kept.push(r);
    }
    return kept;
  };
  let corrected = 0;
  for (const r of [...await up('entries', entries), ...await up('entries', goneE)] as EntryRow[]) {
    corrected++;
    if (r.deleted) remote.dropEntries.push(r.id); else { remote.entries = remote.entries.filter((e) => e.id !== r.id); remote.entries.push(rowEntry(r)); }
  }
  for (const r of await up('goals', [...goals, ...goneG]) as Record<string, string>[]) {
    corrected++;
    if (r.deleted) remote.dropGoals.push(r.id); else remote.goals.push({ id: r.id, name: r.name ?? '', amount: Number(r.amount), emoji: r.emoji ?? 'star', updatedAt: Number(r.updated_ms) });
  }
  for (const r of await up('memories', memories) as { id: string; kind: Memory['kind']; data: Memory; updated_ms: number; deleted: boolean }[]) {
    corrected++;
    remote.memories = remote.memories.filter((m) => m.id !== r.id);
    remote.memories.push(r.deleted ? { id: r.id, kind: r.kind, text: '', createdAt: 0, updatedAt: Number(r.updated_ms), deletedAt: -1 } : { ...r.data, id: r.id, updatedAt: Number(r.updated_ms) });
  }
  if (profileChanged || !p) { await up('profiles', [{ user_id: u, ...prof, updated_ms: started } as unknown as { updated_ms: number }]); meta.profileMs = started; }
  meta.profileSig = remote.profile ? '' : sig;

  writeMeta({ ...meta, pulledAt: maxAt, pushedMs: started, at: Date.now() } as Meta);
  return { remote: pulled + corrected ? remote : null, pushed: entries.length + goneE.length + goals.length + goneG.length + memories.length + (profileChanged ? 1 : 0), pulled: pulled + corrected };
}
