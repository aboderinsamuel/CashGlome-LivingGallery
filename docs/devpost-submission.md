# CashGlome: Devpost submission text

Paste each section into the matching Devpost field. Category: **Web**.

---

## Tagline (one line)

A private money diary where every line you write restores an Old Master painting, and the painting talks back.

## Inspiration

About 1.4 billion adults have no bank account, and many more are paid in cash, mobile money and bank transfers that no budgeting app can see. Bank-linking apps fail them, and spreadsheets don't survive a week. Most money apps also run on guilt: red charts, streaks, warnings.

We wanted the opposite: a diary that takes one line a day, keeps it on the phone, and gives something beautiful back. Renaissance workshops built a painting in layers, from a chalk underdrawing to grey tones to colour glazes to varnish. A month of money can grow the same way.

## What it does

**Write.** You type the way you'd say it: "bus 2.5k, lunch 6k, got paid 360k". That becomes three entries in any of 20 currencies, with k and m, slang and shorthand. Lines in other languages and scripts are read by Gemini, in the cloud when online and by Gemini Nano on the device when offline. You can also snap a receipt (read in the browser, never uploaded), say it out loud, or drop in a bank statement PDF or CSV: every line is read on the device and shown for review before anything is written.

**See.** Each month is a Chapter with a title and a public-domain masterpiece (57 of them, from every continent) that starts as a red-chalk underdrawing. Every entry is a brush stroke of glaze that restores a patch. The week's money sets the light: calm is Vermeer's window, a rushed week brings Caravaggio's dark in from the edges. Finished paintings hang in your gallery for good.

**Ask.** Florin is the voice of a figure in the painting, and you can ask it anything: "Should I go on a date this weekend?" "Where did my money go?" "What does my statement say about me?" "Tell me about this painting." It's a real Gemini conversation that knows your book, but it never does arithmetic. Every figure comes from tools that run on the device, and the answer shows its working.

**One small act a day.** Nobody types every expense forever:
- In the evening, the painting asks one question by candlelight: *what did today cost?*
- "Nothing today" is one tap and cleans a patch too. A missed day costs nothing: no streaks, no guilt.
- As the painting is cleaned, a curator's lens unlocks Discoveries, details people walk past, like the convex mirror in *The Moneylender and His Wife*.

**The first ten seconds.** There's no sign-up. Teniers's painted gallery appears as a chalk underdrawing, and the line you write colours its canvases as you type. Then the Calling: six house paintings flicker in a frame until one holds, and your first line calls you to your house for the year (the House of the Scales: *Weigh every coin*). You sign its book with a first name, or skip, and the book opens on Today.

## How we built it

- **React, TypeScript and Vite**, a single web app that works at 360px on a phone and as a desktop window. Entries live in the browser and work offline.
- **One WebGL2 fragment shader** paints every stage from a single image: a Sobel edge pass as red chalk, grisaille, glaze, varnish, brush strokes with bristles, mood light, and candlelight at night.
- **Firebase AI Logic, hybrid**, in [`src/stage/brain.ts`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/blob/main/src/stage/brain.ts):
  - Gemini in the cloud answers first while online, so people whose laptops, phones or PCs aren't strong enough to run a model quickly get answers just as fast as anyone. On a small integrated GPU a single Nano reply can take minutes.
  - Gemini Nano (`ONLY_ON_DEVICE`) is the offline fallback: with no connection it loads and reads lines, voices the sitters and answers Ask, and nothing leaves the browser.
  - The sitters' one-liners send the cloud categories only, never sums or the line.
  - Today's museum label goes to the cloud online and `PREFER_ON_DEVICE` offline.
  - Every result reports `inferenceSource`, so each answer is labelled with where it ran: on this device, or in the cloud.
- **Florin**, in [`src/stage/muse.ts`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/blob/main/src/stage/muse.ts): a Gemini chat with function calling.
  - The model gets a summary of the book and two tools that run on the device: `search_entries` (exact totals, counts and a category split) and `can_afford` (balance, routines and pay day).
  - Replies stream word by word. Guessed figures are labelled as estimates.
  - "Keep Ask on this device" and offline both route to Gemini Nano or the book's own rules, so nothing is sent.
- **App Check with reCAPTCHA Enterprise** keeps the Gemini API for this app only.
- **A rules engine** reads English and pidgin money lines offline with no model at all, tested against a JSON contract of real entry strings.
- **Design.** "Folio" is parchment by day and candlelight by night, with ink stamp buttons, a sealing-wax send button, currency coins struck as medallions, pigment pans for categories, and red-chalk marks drawn by hand.

## Challenges we ran into

- **Letting a model talk about money without letting it count.** A model will add two numbers wrong with total confidence. The fix:
  - Gemini gets tools and a summary, never permission to do sums.
  - Every search returns its own category split, so there's nothing left to add.
  - The working under each answer is the tools' output, so you can check it.
- **Deciding what may leave the device before the SDK decides for us.** The brain picks on-device or cloud per task, by how private the input is, not by what's convenient.
- **Making a daily habit without streaks.** A quiet day had to count the same as a written one, or people would lie to the app to keep their painting moving.
- **Pointing a magnifying lens at a 500-year-old detail.** CSS background percentages pull toward the centre, so the Discoveries crops needed their own maths to land on the mirror and not the wall beside it.

## Accomplishments that we're proud of

- The first ten seconds: chalk turning to colour as you type, with no sign-up.
- Florin answers "should I go on a date?" with your real numbers, a labelled guess at the cost, and the working underneath.
- It works with no keys, no network and no model, and only gets better when Gemini is there.
- A painting library that is the world's, not one continent's: Zhang Zeduan, Kim Hong-do, Hokusai, Raja Ravi Varma and the Shahnameh hang beside Bruegel and van Eyck.

## What we learned

- Hybrid AI is a privacy design, not a fallback chain. The interesting decision is what each model is allowed to see.
- Function calling is the honest way to put a language model near numbers.
- People keep a habit for a reward they can see, not for a counter they're afraid to break.

## What's next

- **Passive capture**, so logging takes less than one action a day:
  - bank alert notifications parsed on the device;
  - share-to-CashGlome from any bank app's receipt;
  - "cash by balance", where the gap since a withdrawal is filed as cash spending.
- Recurring entries that post themselves after one confirmation.
- A home-screen widget and a Quick Settings tile for logging by voice.
- More writing systems in the core reader: Chinese, Korean, Spanish, French and more, in the writer's own script.
- Encrypted backup that we can't read, and an optional account after the first entry.

## Built with

firebase-ai-logic, gemini, gemini-nano, firebase-app-check, recaptcha-enterprise, react, typescript, vite, webgl2, framer-motion, vercel, wikimedia-commons

## Links

- Live app: https://cashglome-gallery.vercel.app
- Code: https://github.com/aboderinsamuel/CashGlome-LivingGallery

## Prior work (disclosure)

**Before the hackathon.** CashGlome existed as a private-repository app and was already public at cashglome.vercel.app. Its history is kept unchanged in the first 11 commits of this repo, up to [`27382dc`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/commit/27382dc) (10 November 2026, 4:12 PM PT). It already had:
- the offline money reader (English and pidgin, k/m, 20 currencies) and the ledger;
- monthly Chapters, each with a painting cleaned by a flat varnish wipe, and a gallery of past months;
- an Ask panel that sent questions to another provider's cloud chat model (now switched off, with no Google or Firebase anywhere);
- Spotify's embedded player, optional accounts, a share card and Plans.

**The core value it brings.** People in cash and bank-transfer economies need a money reader that understands how they actually write, works offline and keeps entries on the device. That reader and ledger are the foundation everything below is built on.

**Built during the submission period** (from 11 November 2026, 1:30 PM PT; the first commit in the window is [`07860fc`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/commit/07860fc), tagged [`contest-start`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/releases/tag/contest-start); every change is in [this comparison](https://github.com/aboderinsamuel/CashGlome-LivingGallery/compare/27382dc...main)):
- **The Firebase hybrid brain** ([`src/stage/brain.ts`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/blob/main/src/stage/brain.ts)). Firebase AI Logic with Gemini Nano on the device and Gemini in the cloud, with the cloud first so any device is fast and Nano as the offline fallback, with App Check and reCAPTCHA Enterprise. None of it existed before.
- **Florin** ([`src/stage/muse.ts`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/blob/main/src/stage/muse.ts)). A Gemini chat with function calling, in which tools on the device do every sum and the answer shows its working. It replaces the old Ask panel, which has been deleted.
- **The money reader, rewritten.** Nine more languages read on the device, five more currencies, and a JSON contract of real entry strings with its tests.
- **The living canvas.** One WebGL2 shader takes each painting from a red-chalk underdrawing through grisaille and glaze to varnish, with brush strokes, mood light and candlelight. It replaces the flat varnish wipe.
- **A world library of 57 public-domain masters.** The paintings come from China, Korea, Japan, India, Persia, Africa and the Americas as well as Europe, hung so that no month repeats until the whole library has been shown.
- **The sitters, the evening sitting and Discoveries.**
- **Folio, a new design language.** It covers the painted, sign-up-free onboarding, a sidebar in three acts (Write, See, Ask), and Today, Ledger, People and Chapter.
- **Play.** Twelve painting-puzzle Rooms with seals, scored without streaks or ranks.
- **The phone layout,** tested at 360 and 412 pixels wide.
- **Spotify sign-in and in-app search,** which runs as a server function so the secret never reaches a browser.
- **No streaks or ranks anywhere.**
