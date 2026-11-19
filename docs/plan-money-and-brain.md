# CashGlome: the money product, the feel, and the brain

Written Friday, the thirteenth of November 2026. It extends the money plan approved the same day (purses, Today, people and circles, four tabs). This document adds the design direction, onboarding with an account after the first entry, the rewrite of every word on screen, and the AI engine.

## 1. What I found (audit)

**The product**
- The ledger is a dated list with two totals. Entries have no purse, no person, no transfer type. The web app stores one currency for the whole diary.
- The best features are buried: "the purse, until payday", routines, goals and what-if live on the Memory and Plans pages of the web app. Android has Chapter, Ledger and Gallery only.
- The web Chapter page has a streak candle ("One line before midnight keeps it going") and XP levels. Both break the "no streaks, no guilt" rule.

**The words**
- The input box says `What came in or went out? lunch 4.5k, bolt 6k…` with examples that rotate. It reads like a form label followed by a demo. This is the line you called out, and it's the most-seen sentence in the app.
- Other lines explain instead of speak: "Here's how I read that. Change anything, then keep it.", "Any way you like, in any language: …. Each amount becomes its own entry, and each day you write…".
- The welcome screens on both apps still say "no account".

**Accounts**
- The web app already has optional accounts and sync (Supabase, email and password). It syncs entries readable by the server, and asks for a password. Android has none.

**The AI**
- `src/lib/ai.ts` is written for one provider (Meta Florin, three model names hard-coded). The server proxy in the site repo allows only those three models.
- The good part to keep: `askMuse` already makes the model call tools and forbids it from doing arithmetic. The device counts.
- Missing: any provider but one, a way to check an answer's numbers, memory beyond four kinds of note, proactive help, tests that score a model, and entry points outside the Ask panel.

## 2. Research, and what I take from it

- **Material 3 Expressive** (Google's research: 46 studies, 18,000+ people). The key action found up to four times faster when it is the largest, most coloured, most contained thing on screen. Same research warns: removing text labels hurt usability, breaking familiar patterns hurt usability, and money screens need established patterns. So: one loud action per screen, labels always, familiar navigation.
- **Native iOS feel**. What people mean by it: large titles that shrink on scroll, sheets that rest at half and full height, spring motion that can be interrupted, a haptic tick on every commit, swipe actions on rows, long-press menus, blur behind bars, 44pt touch targets, very little colour.
- **Finance onboarding**. The repeated finding is that asking for one input and showing a result at once keeps people; sign-up walls before value lose them.
- **Loved apps, one lesson each**: Messages and Telegram (the composer is the app), Things 3 (one calm list, a magic "plus"), Copilot Money (dense numbers that still feel light), Arc (a command bar that does everything), Finch and Duolingo (a small reward every single time), Apple Journal (suggestions that know the time of day), Splitwise (debts as plain sentences), Linear on the web (keyboard first, fast).

**On the `rea` tool.** I read its README. It installs an MCP server into the agent's configuration and needs a restart, and its strength is decompiling binaries. For screens and flows, published pattern libraries and the apps' own behaviour give more than a decompiler, and decompiling a shipping app can break its licence. I have not installed it. If you want it for a specific case, run `npx rea-agents setup` yourself in a terminal and I'll use it from the next session.

## 3. The feel: native first, Renaissance as the material

**Rules**
1. One loud thing per screen. Everything else is ink on paper.
2. Labels on every tab and every action. No mystery icons.
3. Familiar bones (tabs, sheets, lists, swipe), unfamiliar skin (pigment, gilt, varnish, engraving).
4. Everything you can touch answers at once: press state, spring, haptic.
5. Numbers are set like type: lining tabular figures, the currency sign smaller and raised, minus as a true minus.
6. Paper, not glass. One hairline, one shadow depth, no blobs, no glow.

**The shell (both apps)**
- Four labelled tabs: **Today · Ledger · People · Chapter**.
- **The Quill** sits above the tab bar on every screen. It is the one input for the whole product. Type to write an entry. Ask a question in the same box and it answers. Hold it to speak. Flick up for the camera. The placeholder is four words and never changes: **What did today cost?**
- Replies appear in place, the way a message thread does: your line, then the entries it became, or the answer with its working.

**Ideas that are ours**
- **Sign your work.** After the first entry lifts the first patch of varnish, the painting asks for a signature in its corner, the way painters sign. Signing is the account: one tap with Google, Apple or a passkey. Skippable; the canvas stays unsigned and asks again when the first Chapter is finished.
- **Purses as pigments.** Each purse is a swatch of ground pigment: ochre for cash, lapis for the bank, vermilion for the mobile wallet, verdigris for savings. Drag one swatch onto another to move money between them.
- **Margin notes.** Florin writes in the margin of the ledger in italic, the way a reader annotates a manuscript: "Food out is above your usual this month." Tap a note to ask about it. No pop-ups, no badges.
- **Wax seals.** What's coming (rent, fees, a circle turn) is a row of seals with the date in words. Paying one breaks the seal. Settling a debt with a person stamps one: press and hold, with a haptic thud.
- **Miniatures.** Each person is a portrait miniature (an illuminated initial in an oval frame). A debt is one sentence under it: "Sam owes you ₦5,000, since Tuesday, the tenth."
- **The round.** A savings circle is drawn as a ring of members. The ring gilds as rounds are paid; your turn is the gold bead.
- **Ask about anything you can see.** Long-press any number, row, person or seal: "Ask Florin about this". The question arrives with that thing attached, so "why?" is enough.
- **The morning line.** One optional notification a day, written as a sentence: "Tuesday, the tenth. ₦4,200 for today; rent is nine days off." Reply to it from the notification to log or ask.
- **The unveiling.** The first of the month is a short ceremony: the last varnish lifts, the frame closes, the Chapter gets its title, and a share card is ready.

**For each audience**
- **Phones, teens and youth:** speed and reward. Voice first, the Quill one thumb away, a patch cleaned every time, circles with friends as the social feature, share cards worth posting.
- **The web desk:** keyboard first. A command bar (Ctrl or ⌘ K) that logs, asks and navigates; a ledger table you can move through with arrows, bulk-edit and export.
- **Organisations:** later, as **shared books** on the web (a co-op, a club, a small shop, a savings group): members with roles, an approval step, an audit trail, export. I'd build this only after the personal product is right; see section 7.

**Words**
- Every string on both apps moves into one copy file per platform so it can be edited and reviewed as a set.
- Voice rules: say it once, short, in the order a person would say it aloud. No explaining the feature in the feature. No examples inside placeholders; first-run examples are tappable chips that disappear after the first entry. Dates in words. No exclamation marks.
- A check in the test run fails the build on a list of words and shapes that read as machine-written.

## 4. Onboarding

1. Open the app: the varnished painting, the Quill, and three example chips in the phone's language and currency (guessed from the locale; change it with one tap).
2. Write or tap a chip. The entries appear, a patch lifts, a haptic ticks. That is the whole tutorial.
3. **Sign your work** (account after the first log, as you asked). One tap. What it gives: your diary is backed up and follows you to a new phone.
4. Over the next days, one question at a time, when it's relevant: "How much cash is on you right now?" (starts purses), "When does pay arrive?" (starts safe-to-spend). Never a setup wizard.

Backup is encrypted on the device before upload, so the server holds a blob it cannot read. The existing web sync (readable rows, email and password) is replaced by this.

## 5. The brain

The goal you set: put in a stronger model, get a stronger product, without rewriting anything; and the strength comes from our engineering. The design is eight parts.

**5.1 The gateway (server).** One endpoint. Adapters for the three wire formats that cover nearly every model: OpenAI-style chat (Meta Florin, OpenAI and most others), Anthropic Messages (Claude), and Google Gemini. Configured only by environment variables: provider, key, a fast model and a deep model. Each adapter declares what its model can do (tools, parallel tools, images, strict JSON, streaming) and the engine adapts; a model without tool calling gets a JSON plan protocol instead. Retries, a fallback provider, per-person allowances, and no storing of content.

**5.2 The financial graph (device).** Everything the person has, typed and linked: entries, purses, people, circles, commitments, envelopes, goals, receipts, memories, plus derived facts the device computes (their usual per category, recurring costs, pay cycle, cash gaps). This is the "entire financial ecosystem", and it lives on the phone.

**5.3 Tools (device).** The model never adds. It asks the device, which answers exactly: `query_entries`, `balance_of`, `safe_to_spend`, `upcoming`, `who_owes`, `circle_status`, `compare_periods`, `usual_for`, `forecast`, `what_if`, `find_recurring`. Tools that change things (`add_entry`, `move_money`, `add_commitment`, `remember`, `settle`) only return a proposal; the person confirms with a tap.

**5.4 The context builder (device).** Before each request the device writes a brief, a few hundred words, from the graph: who they are (currency, language, pay cycle), what they've told Florin to remember, the state right now (balances, safe-to-spend, the next fourteen days, this month against their usual), what they were looking at when they asked, and a summary of the conversation. It has a size budget and ranks by relevance to the question. Names of people can be swapped for stand-ins before leaving the phone and swapped back in the answer.

**5.5 Memory.** Three layers. Working memory is the conversation. Standing memory is what the person told it (routines, pay day, goals, preferences, who "mum" is), always visible and editable in the commonplace book. Episodic memory is one digest per finished Chapter, so a question about last March doesn't need last March's entries sent.

**5.6 The router.** Cheapest path that can answer. Simple questions are answered on the device with no cloud at all (the app already does this for some). Then the fast model. The deep model only for planning, advice and stories. Works offline for the first tier and queues the rest.

**5.7 The verifier.** Answers come back as structure, not prose: the sentence, the figures, the working, proposed actions, follow-up questions. Every figure must match a tool result; the device checks, and a mismatch is rejected and retried. The screen draws numbers from the tool data, never from the model's text. This is what makes a weaker model safe and a stronger one trustworthy.

**5.8 Evals.** A test file of real questions with known right answers on a fixed sample diary, in several languages, including trick entries that try to give the model orders. One command scores any provider and model on right tool chosen, numbers faithful, language matched, cost and speed. Changing the key means running the score, not hoping.

**Proactive help without a model.** Margin notes and the morning line come from plain detectors on the device (a category above its usual, a bill larger than what's left, a debt gone quiet, a circle turn near, cash unaccounted for). The model, when available, only words them. They work offline and cost nothing.

**Where the brain is reachable.** The Quill on every screen; long-press on anything; margin notes; the morning line's reply field; the home-screen widget and Quick Settings tile by voice; Android's share menu and text-selection menu from any other app; the web command bar.

**Limits it keeps.** It answers about the person's money and says "this isn't financial advice" on advice. It never recommends investments. Entry text is treated as data, never as instructions.

## 6. Build order

| Step | What | Shown to you |
|---|---|---|
| 0 | **Shell and feel**: tokens, type, motion, haptics, icons, the four tabs, the Quill, the copy file and rewritten words. Remove the candle and XP. | Every screen at 360 and 412 px, Android and web |
| 1 | **Foundation**: purses, transfers, entry kinds, currency on every entry, reader phrases, shared money core, the ledger rebuilt, Today with safe-to-spend | Screens plus the test contract passing |
| 2 | **Onboarding and Sign your work**: one-tap account, encrypted backup, restore on a new phone | The full first-run flow recorded |
| 3 | **Brain v1**: gateway with three adapters, tools, context builder, verifier, evals; asking from the Quill and by long-press | The eval scorecard on two different providers |
| 4 | **People and circles** | Screens |
| 5 | **What's coming, cash gaps, margin notes, the morning line, envelopes, the side-business tag** | Screens |
| 6 | **The web desk**: command bar, keyboard ledger, export | Screens |
| 7 | **Shared books for organisations** | A separate plan first |

Every step: empty, loading, error and offline states; real entry strings; tests green before I call it done.

## 7. Where I disagree

- **Organisations now.** A club's or co-op's shared book needs roles, approvals and an audit trail. It's a second product on the same engine. Built before the personal one is loved, it will make both worse. I've put it last and behind its own plan.
- **Chat is everywhere, not only on its own screen.** There is a full conversation with Florin: pull the Quill up, or tap the Florin mark in the top bar, and it opens full screen with back-and-forth, follow-ups, analysis (figures, working and small charts drawn from the person's own data), advice with steps they can accept by a tap, and searchable history. It opens knowing what the person was looking at. It is one gesture from every screen instead of a fifth tab; if testing shows people don't find it, a "Florin" tab is a small change.
- **Creativity has a floor.** Google's own research found that novelty which breaks familiar patterns scores worse, most of all in money apps. So navigation, lists and sheets stay conventional; the invention goes into the material, the reward and the brain.
- **Envelopes stay off by default**, as agreed, and circles track only your own side.
