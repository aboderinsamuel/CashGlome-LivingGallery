# CashGlome: Devpost submission text

Paste each section into the matching Devpost field. Category: **Web**.

---

## Tagline (one line)

A private money diary where every line you write restores an Old Master painting, and the painting talks back.

## Inspiration

About 1.4 billion adults have no bank account, and many more are paid in cash, mobile money and bank transfers that no budgeting app can see. Bank-linking apps fail them, and spreadsheets don't survive a week. Most money apps also run on guilt: red charts, streaks, warnings.

We wanted the opposite: a diary that takes one line a day, keeps it on the phone, and gives something beautiful back. Renaissance workshops built a painting in layers, from a chalk underdrawing to grey tones to colour glazes to varnish. A month of money can grow the same way.

## What it does

**Write.** You type the way you'd say it: "bus 2.5k, lunch 6k, got paid 360k". That becomes three entries in any of 20 currencies, with k and m, slang and shorthand. Lines in other languages and scripts are read by Gemini Nano on the device.

**See.** Each month is a Chapter with a title and a public-domain masterpiece (58 of them, from every continent) that starts as a red-chalk underdrawing. Every entry is a brush stroke of glaze that restores a patch. The week's money sets the light: calm is Vermeer's window, a rushed week brings Caravaggio's dark in from the edges. Finished paintings hang in your gallery for good.

**Ask.** Muse is the voice of a figure in the painting, and you can ask it anything: "Should I go on a date this weekend?" "Where did my money go?" "Tell me about this painting." It's a real Gemini conversation that knows your book, but it never does arithmetic. Every figure comes from tools that run on the device, and the answer shows its working.

**One small act a day.** Nobody types every expense forever:
- In the evening, the painting asks one question by candlelight: *what did today cost?*
- "Nothing today" is one tap and cleans a patch too. A missed day costs nothing: no streaks, no guilt.
- As the painting is cleaned, a curator's lens unlocks Discoveries, details people walk past, like the convex mirror in *The Moneylender and His Wife*.

**The first ten seconds.** There's no sign-up. Teniers's painted gallery appears as a chalk underdrawing, and a line writes itself and colours the canvases. Then you write your own line, give a first name (or skip), and a wax seal reads *Chapter one begins*.

## How we built it

- **React, TypeScript and Vite**, a single web app that works at 360px on a phone and as a desktop window. Entries live in the browser and work offline.
- **One WebGL2 fragment shader** paints every stage from a single image: a Sobel edge pass as red chalk, grisaille, glaze, varnish, brush strokes with bristles, mood light, and candlelight at night.
- **Firebase AI Logic, hybrid**, in [`src/stage/brain.ts`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/blob/main/src/stage/brain.ts):
  - Gemini Nano (`ONLY_ON_DEVICE`) reads lines it's given first, and the line never leaves the browser.
  - Gemini in the cloud reads a line only when the device has no model.
  - The sitters' one-liners send the cloud categories only, never sums or the line.
  - Today's museum label uses `PREFER_ON_DEVICE`.
  - Every result reports `inferenceSource`, so a wax seal says where it was written.
- **Muse**, in [`src/stage/muse.ts`](https://github.com/aboderinsamuel/CashGlome-LivingGallery/blob/main/src/stage/muse.ts): a Gemini chat with function calling.
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
- Muse answers "should I go on a date?" with your real numbers, a labelled guess at the cost, and the working underneath.
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
  - statement import;
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

CashGlome's money reader and ledger existed before the hackathon in a private repository. That history is kept honestly in the first 15 commits of the public repo. Everything hackathon-specific is in the commits after them:
- the living canvas and its shader;
- the Firebase hybrid brain and Muse;
- the sitters;
- the 58-painting world library;
- the painted onboarding, the evening sitting and Discoveries;
- the Folio design.
