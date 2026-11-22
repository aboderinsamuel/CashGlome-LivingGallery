# Switching on accounts and Florin

Three parts, about 20 minutes in all. Do them in order.

| Part | Where | What it gives people |
|---|---|---|
| **A. Supabase** | supabase.com | Email + password accounts; their world on every device |
| **B. Florin** | console.firebase.google.com | Florin (Gemini) answers questions and reads lines in other scripts |
| **C. Publish** | this folder → `cashglome-site` | The web app at `cashglome.vercel.app/app/` with both switched on |

What goes where, so no secret is ever published:

| Value | Secret? | Lives in |
|---|---|---|
| Supabase project URL | no | `.env.local` → built into the app |
| Supabase **anon / publishable** key | no (RLS protects the rows) | `.env.local` → built into the app |
| Supabase **service_role / secret** key | **yes** | nowhere in CashGlome. Never paste it anywhere here |
| Firebase web config (API key, project ID, app ID) | no (App Check guards the API) | `.env.local` → built into the app |
| reCAPTCHA Enterprise **site** key | no | `.env.local` → built into the app |

`scripts/publish-web.mjs` refuses to build if a secret looks like it's in `.env.local`.

---

## A. Supabase: the database

### A1. Create the project
1. Sign in at **supabase.com** → **New project**.
2. Name: `cashglome`. Choose a strong database password and keep it in your password manager (the app never needs it).
3. Region: the one closest to most of your users.
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

## B. Florin: Gemini through Firebase

Florin runs on Firebase AI Logic: Gemini in the cloud first, Gemini Nano on the device when offline. There is no server of your own and no secret key to keep: App Check with reCAPTCHA Enterprise makes sure only your site can call the API.

### B1. Create the Firebase web app
1. **console.firebase.google.com** → add a project (or use an existing one).
2. **Build → AI Logic** → get started, and choose the Gemini Developer API.
3. **Project settings → Your apps → Web app**. Copy `apiKey`, `authDomain`, `projectId` and `appId`.

### B2. Turn on App Check
1. In Google Cloud, create a **reCAPTCHA Enterprise** key for websites, with your domains (for example `cashglome-gallery.vercel.app` and `localhost`). Copy its **site key**.
2. In Firebase: **App Check → Apps → your web app → reCAPTCHA Enterprise**, paste the site key, then **enforce** App Check for AI Logic.
3. Local development uses a debug token instead (`VITE_APPCHECK_DEBUG_TOKEN`, registered under App Check → Manage debug tokens).

Optional: `VITE_GEMINI_MODEL` picks the cloud model (default `gemini-3.5-flash-lite`). Set a budget alert on the Google Cloud project; if a cap is hit, Florin's calls fail and the book's own rules answer instead. Nothing breaks.

---

## C. Publish

### C1. Fill in `.env.local`
In this folder, copy `.env.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...            # or sb_publishable_...
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_RECAPTCHA_SITE_KEY=6L...
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
git commit -m "Web app with accounts and Florin"
git push
```
Vercel redeploys in about a minute.

### C4. Check it's live
1. Open `https://cashglome.vercel.app/app/`.
2. **Ask Florin** a question. Under *Show the working*, the answer says Gemini wrote it.
3. **Settings → Account & sync → Create account** with a real email, confirm it from your inbox, sign in. Write an entry.
4. In Supabase: **Table Editor → entries**. Your entry is there.
5. Open the app in a second browser, sign in, and the entry appears.

### The desktop installer
`npm run dist:win` reads the same `.env.local`, so a rebuilt installer has accounts and Florin too.

---

## If something's off

| You see | Likely cause |
|---|---|
| *Accounts and sync aren't switched on in this build* | `.env.local` was missing when you built. Fill it in and run C2–C3 again. |
| Sign-up says to check email, but nothing arrives | Supabase's test mailer limit. Set up SMTP (A3.3). |
| The confirmation link opens a 404 or the wrong page | Site URL / Redirect URLs (A3.2) don't match `https://cashglome.vercel.app/app/`. |
| *Couldn't sync: permission denied* | The migration didn't finish. Re-run A2 and `check.sql`. |
| Florin answers only from the book's rules | The Firebase values were missing from `.env.local` when you built, or App Check is refusing the site: add the domain to the reCAPTCHA key (B2). |

**Deleting someone's data on request:** they can do it themselves (*Settings → Account & sync → Delete my account*). You can also do it in **Authentication → Users → ⋯ → Delete user**; their rows go with it.
