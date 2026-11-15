# CashGlome for #BuildHybridAI: The Living Gallery

Written 14 November 2026, second draft. Submissions close **Monday 30 November, 2:00 PM PT**.

The first draft saved the magic for the end of the month. This one spends it in the **first five seconds** and keeps
paying out on every line after that.

## The problems, before the paintings

Logging what you spent is a tool, not a problem. People don't wake up wanting a diary. These are the problems
people in cash and transfer economies on every continent actually have, and what CashGlome does about each one.

| The problem, in their words | What CashGlome does | Where the AI sits |
| --- | --- | --- |
| **"Can I afford this?"** Pay comes in once, irregularly or in cash, and has to last. | **Safe to spend today:** one number, from what's in each purse (cash, bank, mobile wallet) and the days to the next pay. Ask "can I buy the 40k shoes?" and the painting answers with what it does to the rest of the month. | The model reads the question; the device does the arithmetic. |
| **"Where did it all go?"** Cash leaves no statement. | Write it the way you'd say it, in any language, or photograph the receipt. The month becomes a painting you can read at a glance. | Lines the rules can't read go to the on-device model; receipts are read on the device. |
| **"Everything costs more, and I can't say how much."** Prices change monthly in many economies. | **Your own inflation rate.** CashGlome recognises the same thing across months ("bread", "pan", "面包", "a loaf") and shows what *your* basket costs now against then. Nobody else can calculate this, because it's built from your own lines. | The on-device model matches items across languages and spellings; the device does the percentages. |
| **"Who owes who?"** Money lent to a cousin, a split dinner, a colleague's contribution. | **People:** each person gets a portrait miniature; lent and borrowed lines settle themselves when the money comes back. | The model recognises names and "lent", "owes" and "paid back" in any language. |
| **"Whose turn is it in the circle?"** Rotating savings circles run on trust and a notebook: tontine, tanda, susu, hui, kye, chit fund, stokvel, arisan, partner. | **Circles:** a shared page by link, with a member list, the rotation, and who has paid this round. Only the circle's own figures are shared, never anyone's diary. | Firestore holds the circle (the one shared thing); the model drafts the gentle reminder. |
| **"I can't prove my income."** Paid in cash, so no landlord, lender or embassy believes it. | **The Catalogue:** a printable, dated record of the months, made on the device, which the person chooses to hand over. | None needed. The point is that the device's sums are exact. |
| **"I forget the bills until they bite."** | **Recurring lines** post themselves after one confirmation, and the evening prompt asks what today cost. | The model spots repeats; the device schedules them. |

For the hackathon video, the first three lead, because they show hybrid AI working in under a minute. People and Circles
follow if time allows; Circles is the one place a shared cloud database earns its place.

## The idea

**The paintings are alive, and they are about you.**

You don't open an app with a painting in it. You walk into a painting that is breathing: candlelight flickers, snow
falls, the sitters' eyes follow your cursor. A quill waits on the varnish. You write "lunch 4.5k", and a bowl of food is
**painted onto the Moneylender's table while you watch**. The Moneylender looks up and says something dry about it. You
ask what food cost you this month, and his wife puts it on her scales.

Every one of those moments is AI, split between your device and the cloud. You can see the split:

> **The device sketches it instantly. The cloud paints it properly.**

The instant on-device answer appears as red chalk, the way a Renaissance painter blocked in a figure. When the cloud's
full painting arrives a few seconds later, it glazes in over the chalk like oil. That is hybrid inference made visible,
and it is how real paintings were made. Nobody else in this contest will have a metaphor that true.

## The first sixty seconds (no sign-up, no welcome screens)

| Second | What happens |
| --- | --- |
| 0 | The page *is* The Moneylender and His Wife, full screen and alive. Dust turns in the window light, the candle moves, and his eyes find your cursor. One line of serif across the varnish: *What did today cost?* |
| 3 | You type "bolt 6k, lunch 4.5k, got paid 350k". The words are written in ink as you type, in the quill's hand. |
| 4 | Three entries peel off the line and settle into the ledger on the table. Coins slide across the cloth for the 350k. In red chalk, a bowl of food and a carriage ticket are sketched where the scene has room for them. Everything so far happened on the device, offline. |
| 8 | The cloud's repaint arrives. The chalk glazes into oil: a real bowl, in Matsys's own light, sitting on his table. Gold leaf blooms across the frame for pay day. |
| 10 | The wife glances up from her book. A speech slip unrolls: *"Paid, and still you bought your own lunch. Restraint. I'm not used to it."* |
| 15 | A museum label slides in under the frame: *Still Life with Pay Day. Oil on ledger. Workshop of You, Tuesday the 14th.* |
| 30 | Second line, in Korean. The answer is brushed onto the canvas in Hangul and read in the language it was written in. Seal: *Read on this device.* |
| 45 | You ask "what's left of the 350k?" The wife lifts her scales; the money in and out settle into balance. On a parchment slip, the exact sum and its working. |
| 60 | *Keep this painting?* The account appears here, one tap, skippable. Your painting comes with you either way. |

## Six living things

### 1. Living masterpieces
Six hero paintings, prepared to move:
- *The Moneylender and His Wife*: candle, dust, glances.
- *Hunters in the Snow*: falling snow, skaters gliding, smoke from the chimneys.
- *The Calling of Saint Matthew*: the shaft of light swings across the wall.
- *The Harvesters*: wheat moving in the wind.
- *Along the River During the Qingming Festival*: a whole market economy, with boats drifting.
- *Kim Hong-do's market scene*.

How it moves:
- **2.5D depth.** We build a depth map for each painting ahead of time, so the scene shifts as the cursor or phone
  moves.
- **Hand-drawn motion masks** for the parts that move.
- **One WebGL shader** draws all of it. No video files, works offline, 60 fps on a mid-range phone.
- **The light follows your real clock.** Morning light at 8 a.m.; after dark the candles carry the scene.

### 2. Every line is painted into the scene, now
Each entry becomes an object in the painting, in that painting's style.
- **Instantly, on the device:** a red-chalk sketch drawn from a library of still-life objects cut from public-domain
  paintings (bread, fish, a jug, coins, a lute, a candle, a cart). Dutch still-life painters already drew everything
  people buy.
- **Seconds later, from the cloud:** Gemini's image model repaints the object into the real canvas, matching the
  light, and the chalk glazes over.
- The painting fills up with your life as the month goes on. It is not a progress bar; it is a still life of your month.
- If you go back to Tuesday, Tuesday's objects are still there.

### 3. The sitters talk
Every painting has its cast, and they have opinions.
- The Moneylender is a careful man; his wife is drier.
- Caravaggio's Matthew points at your biggest spend: *"Him? No. That was you."*
- Bruegel's hunters have had a long day and are not impressed by your taxi.
- The on-device model writes their lines, in character, using what it knows about your week.

The voice rule: the sitters may tease, but never shame. They laugh with you, the way a friend does. Missing a day
gets no comment at all.

### 4. Your month changes the weather
- Pay day: Venetian gold blooms through the scene.
- A run of late nights: Caravaggio's darkness creeps in from the edges, and a spotlight finds the sitter.
- Rent week: the light goes Northern, slate and umber.
- A calm week: Vermeer's window opens.

Every line moves the light, live. On-device code computes four numbers for the week (calm, rush, weight, plenty); no
model is involved. It is drama, never a red or a green.

### 5. Ask the painting
- Questions are answered by the scene. The wife's scales weigh food against transport. The Moneylender's ledger opens
  at the right week. Matthew's coins are counted out on the table.
- A model only plans the query; the device does every sum, and the working is written on the parchment slip.
- In Hunters in the Snow, the answer is carved into the ice by a skater.

### 6. Sit for your portrait (opt-in, the shareable moment)
- Take a selfie and you are painted into the Arnolfini Portrait, or as the Moneylender, or as a Mughal courtier, in
  that painting's style.
- Your face is sent to the cloud only for this, only after a clear yes, and is never stored.
- Your portrait becomes the cover of your gallery and the share card: *"My money, painted."*
- This is the TikTok clip.

## The months still end in the gallery

- **Weekly:** each week hangs as a small framed study.
- **Monthly:** each month as the full painting with everything you lived in it.
- **The gallery is a room you walk through,** using CSS 3D, with candlelit walls and your labels. That part is
  the end of the month. Everything above is the first minute.

## Hybrid AI: the honest split, for the technology score

| Job | Device (Gemini Nano, desktop Chrome) | Cloud (fallback, and for phones) |
| --- | --- | --- |
| Read a line, in any language and script, to strict JSON | Yes, after the rule parser | Fallback |
| Mood of each line (enum) | Yes | Fallback |
| What object to paint, and where it sits in the scene | Yes | Fallback |
| The sitters' lines, the museum label | Yes | Fallback |
| Read a receipt photo (JPEG or PNG) | Yes | Fallback |
| Plan an Ask query (JSON); the device does the sums | Simple questions | Long questions |
| Paint the object into the canvas | Chalk sketch, from the library | **Repaint (image model)** |
| Your portrait | No | **Yes, opt-in** |

- **The wax seal.** Every result carries one: *Read on this device* or *Read in the cloud*. The SDK reports which
  ran.
- **Offline.** Pull the Wi-Fi mid-demo: the chalk sketches, the voices, the labels and the light all keep working,
  and the repaints queue for later.

## Honest costs and limits

- **Image repaints cost money and take seconds.**
  - The design hides the wait behind the chalk sketch, so nothing ever feels slow.
  - Cost: we repaint only real moments (your first line ever, the first line each day, pay day, anything new). Repeats
    reuse what was painted. A hard spending cap sits on the key.
  - The free Quota Account lasts four days. To get it, apply by **Wed 18 Nov, 10 AM PT**.
  - For judging, the demo month's paintings are made ahead of time, and live repaints use a capped paid key.
- **The on-device model only runs in desktop Chrome 139+, with a flag.**
  - On phones everything runs in the cloud and still feels instant, because the chalk sketch is drawn from the library
    on the device.
- **Living paintings need preparation.** Depth and motion masks for six paintings is real work. I do it once with a
  build script, then hand-correct. More paintings join after the hackathon.
- **The code must be public.** We cut a separate public repo from main under Apache-2.0, without the folio, brag
  videos or anything private.

## Schedule

| Dates | Work |
| --- | --- |
| 14–15 Nov | Public repo; Firebase, App Check, `firebase/ai` hybrid behind the Muse slot; wax seal; quill ink. |
| 16–19 Nov | The living-painting engine: depth, motion, clock light, mood weather. The Moneylender first, end to end. |
| 19–22 Nov | Lines painted into the scene: the object library, chalk sketch, cloud repaint, glaze transition (during the quota days). |
| 22–24 Nov | The sitters talk; Ask the painting; museum labels; other languages and scripts. |
| 25–26 Nov | Five more living paintings; your portrait; the gallery room; share card. |
| 27 Nov | Every state (empty, loading, error, offline), sound, 360 and 412 px, the judges' month. |
| 28 Nov | The three-minute video. |
| 29–30 Nov | Submission, README, buffer. Submit Monday morning. |

Android stays a stretch. A web entry that feels impossible beats two that feel finished.

## What only you can do

1. Register on Devpost and apply for the Quota Account by Wed 18 Nov.
2. Create the Firebase project and send me the web config (public by design, no secrets).
3. Say yes to a public repo under Apache-2.0.
