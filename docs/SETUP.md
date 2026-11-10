# Switching on accounts and the shared Muse

Three parts, about 20 minutes in all. Do them in order.

| Part | Where | What it gives people |
|---|---|---|
| **A. Supabase** | supabase.com | Email + password accounts; their world on every device |
| **B. Shared Muse** | vercel.com (the `cashglome-site` project) | Muse for everyone, on your Meta key, without pasting one |
| **C. Publish** | this folder → `cashglome-site` | The web app at `cashglome.vercel.app/app/` with both switched on |

What goes where, so no secret is ever published:

| Value | Secret? | Lives in |
|---|---|---|
| Supabase project URL | no | `.env.local` → built into the app |
| Supabase **anon / publishable** key | no (RLS protects the rows) | `.env.local` → built into the app |
| Supabase **service_role / secret** key | **yes** | nowhere in CashGlome. Never paste it anywhere here |
| Your **Meta API key** | **yes** | Vercel environment variable `META_API_KEY` only |
| Shared Muse address | no | `.env.local` → built into the app |

`scripts/publish-web.mjs` refuses to build if a secret looks like it's in `.env.local`.

---

## A. Supabase: the database

### A1. Create the project
1. Sign in at **supabase.com** → **New project**.
2. Name: `cashglome`. Choose a strong database password and keep it in your password manager (the app never needs it).
3. Region: the one closest to most of your users (for Nigeria, **West EU (London)** or **Central EU (Frankfurt)**).
4. Wait about a minute for it to start.

### A2. Create the tables
1. Left sidebar → **SQL Editor** → **New query**.
2. Open [`supabase/migrations/20261110000000_cashglome.sql`](../supabase/migrations/20261110000000_cashglome.sql), copy all of it, paste, press **Run**. You should see *Success. No rows returned.*
   It's safe to run again; it won't duplicate anything.
3. New query again: paste [`supabase/check.sql`](../supabase/check.sql) and **Run**. Every row should say `ok = true`. If one says `false`, run the migration again and re-check.

<details>
<summary>Or with the Supabase CLI instead of the SQL Editor</summary>

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```
The project ref is the `xxxx` in `https://xxxx.supabase.co`.
</details>

### A3. Email sign-in
1. **Authentication → Sign In / Providers → Email**: make sure **Email** is enabled and **Confirm email** is on. Set the minimum password length to **8**, matching the app.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://cashglome.vercel.app/app/`
   - **Redirect URLs**, add both:
     - `https://cashglome.vercel.app/app/**`
     - `http://localhost:5173/**` (for development)
3. **Email sending (important before real users).** Supabase's built-in mailer only sends a few emails an hour and is meant for testing. For launch, go to **Authentication → Emails → SMTP Settings** and connect a sender (Resend, Postmark, Brevo, Amazon SES…). Until then, sign-up confirmations may be slow or not arrive.
4. Optional: **Authentication → Emails → Templates** to word the confirmation and reset emails in CashGlome's voice.

### A4. Copy the two public values
**Project Settings → API Keys** (older dashboards: **Settings → API**):
- **Project URL**, like `https://abcd1234.supabase.co`
- The **anon** key (`eyJ…`) or the **publishable** key (`sb_publishable_…`). Either works.

Do **not** copy the `service_role` / `sb_secret_…` key.

---

## B. Shared Muse: your Meta key, on the server

The website's Vercel project now has a small server function, [`api/muse.js`](https://github.com/cashglome/cashglome-site/blob/main/api/muse.js) (in the `cashglome-site` repo). The app sends Muse requests to it; it adds your key and passes them to Meta. The key is never sent to anyone's browser.

### B1. Add the key to Vercel
1. **vercel.com** → the **cashglome** project (the one serving `cashglome.vercel.app`) → **Settings → Environment Variables**.
2. Add:
   - Key: `META_API_KEY`
   - Value: your Meta Model API key
   - Environments: **Production** (and Preview if you use preview links)
   - Tick **Sensitive**, so it can't be read back from the dashboard.
3. Save. It takes effect on the next deploy (part C pushes one).

Optional limits (same screen, defaults in brackets):
- `MUSE_PER_MINUTE` (20): requests a minute per visitor
- `MUSE_PER_DAY` (300): requests a day per visitor

### B2. Cap your spend at Meta
The function limits each visitor, but anyone can visit, so a determined person could still run up use. In Meta's developer console for the Model API, **set a monthly spending limit / budget alert** on this key. If the cap is hit, Muse calls fail and CashGlome quietly falls back to its own on-device reader. Nothing breaks.

What the function allows:
- Only Muse models: `muse-spark-1.3`, `muse-spark-1.1`, `muse-wonder-1.0`.
- Answers capped at 4,000 tokens; requests up to 4 MB (receipt photos).
- Only from `cashglome.vercel.app`, the desktop app and local development.
- People who paste their own key in **Settings → Meta Muse** use theirs instead, without the limits.

---

## C. Publish

### C1. Fill in `.env.local`
In this folder, copy `.env.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...            # or sb_publishable_...
VITE_MUSE_PROXY=https://cashglome.vercel.app/api/muse
```

`.env.local` is gitignored; it never gets committed.

### C2. Build into the website
```bash
node scripts/publish-web.mjs
```
It prints which features are on, type-checks, and builds into `../cashglome-site/app/`.

### C3. Push the website
```bash
cd ../cashglome-site
git add -A
git commit -m "Web app with accounts and shared Muse"
git push
```
Vercel redeploys in about a minute.

### C4. Check it's live
1. Open `https://cashglome.vercel.app/app/`.
2. **Settings → Meta Muse**: it should say *on CashGlome's key*. Press **Test**: *Connected*.
3. **Settings → Account & sync → Create account** with a real email, confirm it from your inbox, sign in. Write an entry.
4. In Supabase: **Table Editor → entries**. Your entry is there.
5. Open the app in a second browser, sign in, and the entry appears.

### The desktop installer
`npm run dist:win` reads the same `.env.local`, so a rebuilt installer has accounts and the shared Muse too.

---

## If something's off

| You see | Likely cause |
|---|---|
| *Accounts and sync aren't switched on in this build* | `.env.local` was missing when you built. Fill it in and run C2–C3 again. |
| Sign-up says to check email, but nothing arrives | Supabase's test mailer limit. Set up SMTP (A3.3). |
| The confirmation link opens a 404 or the wrong page | Site URL / Redirect URLs (A3.2) don't match `https://cashglome.vercel.app/app/`. |
| *Couldn't sync: permission denied* | The migration didn't finish. Re-run A2 and `check.sql`. |
| Muse: *The shared Muse isn't set up on this server yet* | `META_API_KEY` missing in Vercel, or no redeploy since adding it. |
| Muse: *Muse error 401* | The Meta key is wrong or revoked. Replace it in Vercel and redeploy. |
| Muse: *You've used today's Muse allowance* | That visitor hit `MUSE_PER_DAY`. Raise it in Vercel if you like. |

**Deleting someone's data on request:** they can do it themselves (*Settings → Account & sync → Delete my account*). You can also do it in **Authentication → Users → ⋯ → Delete user**; their rows go with it.
