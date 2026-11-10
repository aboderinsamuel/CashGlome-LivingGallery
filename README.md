# CashGlome

Type it, say it, or snap the receipt. Write what came in and what went out, the way you'd say it out loud. CashGlome turns each month into a chapter you can read: a headline, the figures, where the money went, who you were that month, and what could be.

No bank login. No account. Everything stays on your device.

## Three ways in: type, say, snap

The composer has a camera on the left, words in the middle and a microphone on the right. Nobody has to be told how to use it.

- **Type.** "Bolt 6k, data 3k, lunch 4.5k" becomes three entries. The chips above the field show what will be saved before you press Enter. Tap a chip's amount to flip in/out, or its name to change the category.
- **Say.** Tap the mic and speak. The words appear in the field as you talk, with level bars, and stop after a pause. Spoken numbers are turned into digits ("four thousand five hundred", "two point five million", "twelve fifty"), and nothing is saved until you press send.
  - In the browser it uses the Web Speech API (Chrome, Edge, Safari).
  - The Windows app uses Windows' own **offline** recogniser (System.Speech), via `electron/speech.cjs`.
  - Elsewhere the mic button is hidden.
- **Snap.** Use the camera button, drop a photo anywhere on the window, or paste one. On a phone it opens the camera; on a laptop it opens a live view with a shutter, or lets you choose a file.
  - **Receipts** are read **on this device** with Tesseract (`public/ocr`, bundled, no download). CashGlome finds the shop, the *total paid* (not the subtotal, VAT, cash or change) and the date, outlines the total in gold on the receipt, and prefills one editable line, e.g. "Shoprite Lekki 13383.75". If no total is found, it says so and asks you to type it.
  - With Meta Muse connected, the photo is sent to Muse for reading instead, and the sheet says so. If Muse fails, it falls back to the on-device reader.
  - **Things you bought** are repainted as an old-master oil painting, entirely on the device (`src/lib/paint.ts`): a Kuwahara filter, brushstrokes laid along the forms, an umber-to-ivory grade, light from the upper left, canvas weave and craquelure. The painting sweeps in over your photo, then hangs in a gilt frame.
  - Receipts are inked onto vellum instead.
  - Photos live in IndexedDB on this device, are not part of JSON exports, and are deleted a few minutes after their entry is.

Your paintings then show up across the app:
- as thumbnails in the Ledger (an entry's inspector can add a photo or take it down);
- in the Chapter's "Painted this month" row;
- on the Gallery's green-walled **Your still lifes**, each with a brass plaque.

## Seeing where it went

Right under the month's painting, the chapter lays the month out as **100 coins on a velvet tray**, one colour per category, dropping in as you scroll. The headline says it plainly, e.g. "26 went on home & rent, 22 are still yours." Coins you spent beyond what came in get a red ring.

Next to each category is a translation into something you actually buy. That is **your own usual purchase**, measured from entries you wrote at least three times ("296 × Keke to work"). Until you have one, it uses a marked estimate ("≈ plates of jollof at about ₦2,500", or coffees elsewhere).

## Ask about your money

Type or say a question in the same box (or press `Ctrl/⌘ K`, or **Ask** in the toolbar): "Where did my money go this month?", "How much did I spend on food last week?", "When did I last buy suya?", "Am I spending more than last month?", "Can I afford 40k?".

- **Any question, exact numbers.** With Meta Muse on, Muse reads the question and asks the app to search your entries (by date, category, words, amount, weekday, grouped by week or month…), as many searches as it needs. The app does every sum on the device and Muse writes the answer from those results, so it can take on "What do I spend on at weekends?", "Which week was my most expensive and why?" or "How much have I given my mum this year?" without making numbers up. You see each search as it runs, and **Show the numbers** lists the figures and entries behind the answer.
- **Muse only with your OK.** The first time, it says exactly what is sent (your question, monthly totals, and the entries each search finds; never photos) and asks. Change it any time in **Settings → Meta Muse**.
- **Works without Muse too.** Offline, or with Muse off, totals, top categories, comparisons, "when did I last…" and "can I afford" are still counted on the device.
- **Your Meta key**: paste it in **Settings → Meta Muse**. It is stored only on this device and never exported.

## iPhone and iPad

A native SwiftUI version is in [`ios/`](ios/README.md): open `ios/CashGlome.xcodeproj` in Xcode 26 on a Mac and run. Same categories, parser and Ask engine, built for touch with Liquid Glass, haptics and Swift Charts.

## Music

**♪** in the toolbar plays Spotify while you write: any playlist, album, song or podcast link, or one of the quiet picks (Classical Essentials, Peaceful Piano, lofi beats), from **Settings → Music**. It is Spotify's own player, so it keeps playing as you move around the app. Without being signed in to Spotify in that browser it plays 30-second previews; **Open in Spotify** plays everything in the Spotify app.

**Linking a Spotify account** (choose from your own playlists) needs a Spotify app registered once for CashGlome:

1. Create an app at developer.spotify.com/dashboard (Web API).
2. Add redirect URIs: `http://127.0.0.1:43821/callback` for the desktop app, and the exact address you serve the web app from (Spotify accepts `http://127.0.0.1:<port>/` for local testing, not `localhost`).
3. Build with the Client ID: put `VITE_SPOTIFY_CLIENT_ID=<your client id>` in `.env.local`, then build.

Sign-in uses Spotify's PKCE flow, so no secret is stored in the app. CashGlome asks only to read playlist names. The token stays on the device and is never exported. Without a Client ID the link option simply doesn't appear; links and picks still work.

## Fast on ordinary laptops

Tested on Intel UHD 620 integrated graphics:
- Switching pages draws the new page in the same frame (no fade-out wait).
- Changing month draws in about 60–90 ms, down from about 800 ms.
- Typing stays at 60 fps.

What made the difference:
- **Paintings under varnish are drawn once.** A background worker draws them into an ordinary image, where they used to be live SVG noise and blur filters.
- **Effects stop behind glass.** Nothing moves behind frosted glass while the window covers it, film grain is a still texture, and paintings pause when scrolled away.
- **Smaller pictures.** Each painting comes in three sizes (`public/art`, `art/md`, `art/sm`), and each place loads the smallest that is sharp.
- **CSS animations instead of JavaScript springs.** The 100 coins and the daily bars animate in CSS.
- **Less work at once.** Long pages render in stages, and off-screen ledger days are skipped until you scroll to them.

Regenerate the smaller paintings after adding one with `npx electron scripts/make-art-sizes.cjs`.

## Built against the usual complaints

What people dislike in money apps, and what CashGlome does instead:

| Complaint | CashGlome |
|---|---|
| Bank sync breaks silently | No bank connection to break. You write it, say it or snap the receipt; Muse failures are said out loud and the offline reader takes over. |
| Typing everything in is tedious | One line for many entries ("bolt 6k, data 3k"), voice, receipt photos, and one-tap repeats of your usual buys. |
| Categories are wrong and never learn | Fix one once and it's remembered for that thing from then on. |
| The AI assistant gets numbers wrong | Answers are counted on the device, and every one can show its working. |
| My data goes to a third-party AI | Nothing leaves the device unless you turn Muse on, and asking asks first. |
| Apple-only / phone-only / subscription | Web, Windows and Mac; free; no account. |
| Can't add things offline | Fully offline. |

## How it reads
CashGlome is dressed as a Renaissance edition. It uses sixteen public-domain paintings bundled in `public/art`, by Bruegel, Van Eyck, Matsys, Holbein, Caravaggio, Raphael, Botticelli and Dürer. The palette is pigment-based: lapis, gold leaf, vermilion and terre verte on warm paper. Type is Newsreader with Schibsted Grotesk. The paintings are alive: a slow camera drift, a shaft of light, gold dust in the air, and film grain. *Reduce motion* holds them still. There are no scrollbars anywhere, and light, dark and auto themes are included.

On a wide screen in a browser, CashGlome draws a whole Mac desktop around itself:
- a painting as wallpaper, chosen by season or picked in Settings;
- a menu bar with working menus, the candle streak, Muse status and a clock;
- desktop widgets;
- a window you can drag, zoom, minimise and close;
- a magnifying dock with Renaissance-styled icons.

The Electron app is the window itself, with the painting showing through its glass sidebar.

| Part | What it does |
|---|---|
| **This chapter** | The month's painting sits beside the headline under old varnish. A painting is chosen for who you were that month, for example *The Moneylender* for a saver or *Icarus* for an overreacher. Writing cleans it patch by patch, and new patches are shown being cleaned the next time you look. Below it: the **Today** row (candle, today's card, today's cleaning), then the figures, the day-by-day strip, colour tiles, a collectible character card painted with that month's work, moments, *How it felt* under Bruegel's *Carnival and Lent*, *What could be* beside the *Tower of Babel*, repeat payments, and the Edition. |
| **All chapters** | Every month bound as an oxblood book with its painting set into the cover. The less restored the painting, the more faded it looks. |
| **The Edition** | The month as an illustrated book read like a short film. The cover swings open. Each of the seven pages has its own living painting, and each painting is credited. |
| **Gallery** | A salon wall of every month's painting in gilt frames, plus the candle, wax seals, guild ranks (Apprentice to Medici) and the sticker book. |
| **Ledger / Plans** | Every entry, editable (a category you correct is remembered), and goals and habits. |
| **Composer** | One plain line at the bottom. Chips let you flip in/out or change the category before adding. When it's empty, your usual buys appear as one-tap repeats. Type a question instead and it's answered. After adding, a single line says what was added and which patch it cleaned, with Undo. |

### Why people come back (and why it's on their side)

The loop rewards **writing things down and keeping money**, never spending:

- **Restoration (variable reward and goal gradient).** Every entry cleans part of the month's painting. Only the first three lines each day count, so coming back daily beats writing everything at once. About one entry in seven is *gilded* and cleans an extra patch. Two corners start clean, because people finish what they've already started.
- **The candle (loss aversion, softened).** It grows taller every day you write. Each 7-day run earns a wax seal (you can hold two), and a seal protects the candle through a missed day. That way one bad day doesn't wipe out a habit.
- **Today's card (daily trigger).** Each day you can turn over one new card with an observation drawn from your own entries.
- **Collection.** One painting a month joins your gallery wall.
- **Evening reminder.** Optional. It fires only if today's candle is still unlit.

## AI: Meta Muse

CashGlome works fully offline with its own parser. It understands `5k`, `2.5m`, `₦4,500` and `$12`, tells money in from money out, splits "bolt 6k, data 3k, lunch 4.5k" into separate entries, and picks up feelings ("regret", "worth it") and dates ("yesterday", "last friday").

To use Meta's models, open **Settings → Meta Muse**, turn it on and paste a Meta Model API key:

- **Muse Spark 1.1** (`muse-spark-1.1`) reads your entries.
- **Muse Wonder 1.0** (`muse-wonder-1.0`) writes each chapter's headline, lede and notes, and answers the questions CashGlome can't count itself (with your OK).

The API is OpenAI-compatible. The default base URL is `https://api.meta.ai/v1` and can be changed in Settings. If Muse can't be reached, the local parser takes over. Your key stays on your device and is left out of exports. On desktop, requests go from the Electron main process; on the web, they go through the bundled `/__ai` proxy.

## Run it

```bash
npm install
npm run dev            # web, http://localhost:5173
npm run desktop        # desktop app (Electron)
npm run desktop:dev    # desktop app with hot reload
```

## Ship it

```bash
npm run build && npm run serve    # production web server + AI proxy (PORT env, default 4173)
npm run dist:win                  # Windows installer → release/
npm run dist:mac                  # macOS .dmg (must run on a Mac)
```

## Shortcuts

`Ctrl/⌘ N` write · `Ctrl/⌘ K` ask · `Ctrl/⌘ 1–5` Chapter, All chapters, Ledger, Plans, Gallery · `Ctrl/⌘ [ ]` previous / next month · `Ctrl/⌘ E` the Edition · `Ctrl/⌘ ,` Settings · `← →` and `Esc` inside the Edition

## The icon

A gold florin, with a beaded rim, the legend FLORENTIA and an embossed lily, sits in a wreath of real flowers. The flowers are an iris, roses, tulips, a carnation, a narcissus, a columbine and others, cut from Ambrosius Bosschaert the Elder's *Vase of Flowers in a Window* (c. 1618, Mauritshuis, public domain).

The icon is drawn by `scripts/logo.html`, from `build/source/bosschaert-1618.jpg`. Each flower is matted along its own petal colours, over a ring of the painting's leaves. Regenerate it with:

```
npx electron scripts/make-logo.cjs
```

This writes `build/icon.png` (1024), `public/icon.png` (512) and `public/icon-64.png`.

## Project map

```
electron/        desktop shell (frameless window, IPC for AI calls, screenshot dev aid)
scripts/         AI proxy, desktop dev runner, icon renderer, painting sizes
server.mjs       production web server
src/lib/         parser, Muse client, analytics and chapter copy, art (paintings, restoration, candle, daily card), store, demo data, sounds,
                 speech (voice), receipt (OCR + Muse vision), paint (oil-painting and vellum filters), images (IndexedDB), coins
src/components/  Desktop (menu bar, window, dock, widgets), Shell, Composer, CaptureSheet, Coins, Photo, LivingArt, Restoration, Candle, Logo, Stickers, Icons
public/art/      the sixteen paintings (public domain, Wikimedia Commons)
src/views/       Chapter, WhatIf, Shelf, Ledger, Plans, Collection, Settings, Edition, Welcome
```

CashGlome gives general money insights, not licensed financial advice.

The paintings are public-domain reproductions from Wikimedia Commons; credits are listed in Settings → About.
