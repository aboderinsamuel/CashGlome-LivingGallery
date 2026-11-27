# CASHGLOME — MASTER BRIEF

I'm building CashGlome (cashglome.vercel.app) and I need you locked in.
I believe in this product, but what exists today doesn't do it justice:
the UI/UX reads as AI slop, the web app is bad and far worse on phones,
and the landing page looks amateur. I want an artistic app people can't
put down and that investors rush toward. Think as long as you need,
research before designing, test what you build.

## PRODUCT

A private, local-first money diary for cash and bank-transfer economies
on every continent, wherever bank-linking apps fail. It is a worldwide
app: never tailor copy, examples or evidence to one country. Three acts:
Write, See, Ask.

- Write: "bolt 6k, lunch 4.5k, got paid 350k" becomes three entries.
  Understands k/m, slang and shorthand, 20 currencies. English and
  pidgin work in the core engine today; every other major language
  (Chinese, Korean, Spanish, French and more) must follow, in the
  writer's own script. Voice and receipt photos too.
- See: each month is a Chapter with a title (e.g. "The Homebody") and a
  public-domain masterpiece under old varnish. Every entry cleans a
  patch. Finished paintings hang in the gallery for good.
- Ask: Florin (cloud AI) only plans the query; the device does every sum
  exactly and shows its working.
- Rules we don't bend: entries live on the device and work offline; no
  sign-up before the first entry (the account comes after it, one tap,
  and can be skipped); backup is encrypted so we can't read it; no ads,
  no bank login, no guilt, no streaks. Missing a day costs nothing.
- The plan in force is docs/plan-money-and-brain.md.

## RENAISSANCE THEME (locked; extend it, never replace it)

- Read the existing CSS first and extract the real tokens (colours,
  fonts, spacing, radii). Treat them as the design system.
- Palette: Parchment (#EEE6D6) by day and Candlelight (#17120C) by
  night are the default. "Sugar by day, Velvet by night" (src/sugar.css)
  is a choosable second palette: the Renaissance with a Rococo sweet
  tooth, Gen Z playful but never cheap. Blush dotted paper (#FFF4EF) /
  aubergine velvet (#150A1B), mulberry ink, and candy pigments, each
  with a fill, a soft wash and a deeper ink shade for small text: rose
  madder, Naples yellow (butter), verdigris (mint), smalt (lavender).
  Stickers with white die-cut edges, jelly-bean pills, outlined chat
  bubbles, bouncy presses.
- Old Master paintings are the heroes: Bruegel
  (The Harvesters, Hunters in the Snow, Peasant Wedding, Tower of
  Babel), van Eyck (Arnolfini Portrait), Matsys (The Moneylender and
  His Wife), Caravaggio (The Calling of Saint Matthew), and many others.
  We could have a very, very large library for that later.
- The library is the world's, not only Europe's: public-domain masters
  from China, Korea, Japan, India, Persia, Spain, France, Africa and the
  Americas hang beside the Flemish ones, and their scripts may appear
  as part of the art.
- Serif headlines with one italic word ("Your money, painted."),
  museum-label captions (artist, title, year), dates in words
  ("Tuesday, the tenth of November"), a calm and kind voice.
- Colour comes from real pigments: rose madder, Naples yellow,
  verdigris, smalt, ochre, lapis, vermilion, gold leaf. Never neon, never red/green guilt charts, no stock gradients,
  no emoji as icons, no generic card grids.
- Motion feels physical: varnish lifting, brush strokes, paper, gilt.

## REFERENCES (study before designing; I've attached screenshots I like)

- Pattern libraries: mobbin.com, appllama.io, pageflows.com (flows)
- Android: Material 3 Expressive and developer.android.com/design
- Principles: lawsofux.com, Refactoring UI
- Apps: Telegram and Apple Messages (input physics, inline bubbles),
  Finch (reward loop), Procreate (tactile wiping), Amie (calm data),
  Apple Journal (time-aware suggestions), Duolingo (onboarding),
  Gentler Streak (kind tone), Not Boring apps (craft and haptics),
  Spotify Wrapped (shareable recap)
- Landing pages: Linear, Stripe, Arc, plus godly.website and
  land-book.com, and the YC company directory for packaging
- Art: Met Open Access, Rijksmuseum, Art Institute of Chicago,
  Wikimedia Commons (public domain only)
- Motion: Rive or Lottie

## THE BIG RISK: LOGGING FATIGUE

Nobody will type every expense forever. Design for about one small
action a day:

1. Auto-capture bank alert notifications, parsed on-device, user taps
   to confirm. Check current Play policy; notification access first.
2. Share-to-CashGlome from any bank app's receipt (Android share menu).
3. Statement catch-up: import a bank statement PDF, parsed on-device.
4. Cash by balance: "You withdrew ₦20k Monday, how much is left?" The
   gap is filed as cash spending.
5. One evening prompt: "What did today cost?"
6. Recurring entries post themselves after one confirmation.
7. Quick Settings tile and widget: log by voice without opening the app.

## HOW TO WORK

- Audit first, then give me a written plan. Wait for my go.
- Design every state: empty, loading, error, offline.
- Test on 360px and 412px widths with real entry strings. Show me
  screenshots of every finished screen.
- If something I asked for is a bad idea, say so and propose better.
