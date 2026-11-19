import { useState } from 'react';
import { cloudConfigured, deleteAccount, resetPassword, signIn, signOut, signUp, updatePassword } from '../lib/cloud';
import { doneRecovering, syncNow, useSyncStatus } from '../lib/useCloud';
import { Icon } from './Icons';

const ago = (t: number | null) => {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 10 ? 'just now' : s < 60 ? `${s} seconds ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

/** Sign in, create an account, see sync, sign out, delete the account. */
export function Account({ compact = false }: { compact?: boolean }) {
  const st = useSyncStatus();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  if (!cloudConfigured) {
    return (
      <div className="acct">
        <p className="body-serif acct-lede">Accounts and sync aren't switched on in this build, so everything stays on this device.</p>
        <p className="small">For whoever runs this copy: add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code> and rebuild. The README has the steps.</p>
      </div>
    );
  }

  const act = async (f: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setMsg(null);
    try { await f(); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };

  if (st.session && st.recovering) {
    return (
      <form className="acct" onSubmit={(e) => { e.preventDefault(); if (pw.length >= 8) act(async () => { await updatePassword(pw); doneRecovering(); setPw(''); }, 'Your new password is set.'); }}>
        <p className="body-serif acct-lede">Choose a new password for {st.session.user.email}.</p>
        <input className="field" type="password" autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8 or more characters)" aria-label="New password" />
        <div className="acct-actions"><button className="btn primary" disabled={pw.length < 8 || busy}>Set password</button></div>
        {msg && <p className={'small acct-msg' + (msg.ok ? ' ok' : '')} role="status">{msg.text}</p>}
      </form>
    );
  }

  if (st.session) {
    return (
      <div className="acct">
        <div className="acct-who">
          <span className="acct-avatar"><Icon.cloud size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.session.user.email}</div>
            <div className="small acct-state" data-phase={st.phase}>
              {st.phase === 'syncing' ? 'Syncing…' : st.phase === 'error' ? `Couldn't sync: ${st.error}` : `Synced ${ago(st.at)}`}
            </div>
          </div>
        </div>
        {!compact && <p className="small acct-note">Your entries, goals, memory and settings are kept in your account and on each device you sign in on. Photos and your music choice stay on this device.</p>}
        <div className="acct-actions">
          <button className="btn" disabled={st.phase === 'syncing'} onClick={syncNow}>Sync now</button>
          <button className="btn" onClick={() => act(signOut)}>Sign out</button>
        </div>
        {!compact && (
          <details className="acct-danger">
            <summary className="small">Delete my account</summary>
            <p className="small">This erases your account and everything in it from the server. This device keeps its own copy until you delete it in Your data. Type DELETE to confirm.</p>
            <div className="acct-actions">
              <input className="field" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" style={{ maxWidth: 140 }} />
              <button className="btn danger" disabled={confirmDelete !== 'DELETE' || busy} onClick={() => act(deleteAccount, 'Your account and its data were deleted.')}>Delete forever</button>
            </div>
          </details>
        )}
        {msg && <p className={'small acct-msg' + (msg.ok ? ' ok' : '')} role="status">{msg.text}</p>}
      </div>
    );
  }

  const valid = /\S+@\S+\.\S+/.test(email) && pw.length >= 8;
  return (
    <form className="acct" onSubmit={(e) => { e.preventDefault(); if (!valid || busy) return; act(mode === 'in' ? () => signIn(email.trim(), pw) : async () => { const r = await signUp(email.trim(), pw); if (r.needsConfirm) setMsg({ ok: true, text: `Check ${email.trim()} for a link to confirm, then sign in.` }); }); }}>
      {!compact && <p className="body-serif acct-lede">Sign in to keep your world on every device: entries, goals, memory and settings. Without an account, everything stays on this device.</p>}
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Create account</button>
      </div>
      <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" />
      <input className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={mode === 'up' ? 'Password (8 or more characters)' : 'Password'} aria-label="Password" />
      <div className="acct-actions">
        <button className="btn primary" disabled={!valid || busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {mode === 'in' && <button type="button" className="btn ghost" disabled={!/\S+@\S+\.\S+/.test(email) || busy} onClick={() => act(() => resetPassword(email.trim()), `If there's an account for ${email.trim()}, a reset link is on its way.`)}>Forgot password?</button>}
      </div>
      {mode === 'up' && <p className="small acct-note">Everything already on this device is added to the new account.</p>}
      {msg && <p className={'small acct-msg' + (msg.ok ? ' ok' : '')} role="status">{msg.text}</p>}
    </form>
  );
}
