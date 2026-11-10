# CashGlome for iPhone and iPad

A native SwiftUI app: the same money diary as the desktop app, built for touch.

## Open and run

You need a Mac with **Xcode 26 or later** (for iOS 26's Liquid Glass; the app runs on iOS 18 and up, with frosted glass on older versions).

1. Copy the `ios` folder to the Mac (or clone the repository there).
2. Double-click `ios/CashGlome.xcodeproj`.
3. In Xcode, select the **CashGlome** target → **Signing & Capabilities** → choose your **Team** (a free Apple ID works for your own phone).
4. Pick an iPhone simulator or your plugged-in iPhone at the top, and press **⌘R**.

On your own iPhone the first time: **Settings → General → VPN & Device Management** → trust your developer certificate. With a free Apple ID, apps installed this way stop opening after 7 days; build again from Xcode to renew. A paid Apple Developer account removes that limit and lets you use TestFlight and the App Store.

If Xcode won't open the project, regenerate it: `brew install xcodegen && cd ios && xcodegen` (uses `project.yml`).

## What's inside

| Screen | What it does |
|---|---|
| **Month** | The month's painting, chosen by how you spent it. Spent, came in, put aside, and how much you kept. Pace to month end. A day-by-day chart you can scrub with a finger. "Where it went" ring: touch a slice, open a category. Highlights and monthly repeats. Swipe the painting to change month. |
| **Ledger** | Every entry by day. Search, filter in/out, swipe to delete or mark *worth it* / *regret*, tap to edit. Correct a category once and it's remembered. |
| **Ask** | Ask anything about your money. With Muse on, Muse searches your entries and **the phone does every sum**, so numbers are exact; **Show the numbers** lists what each answer used. Asks before anything is sent. Works offline for simple totals. |
| **Composer** | One line at the bottom of Month and Ledger: "bolt 6k, lunch 4.5k, got paid 350k". Shows what it understood as chips (tap one to change in/out or category), adds all at once, with Undo. Your usual buys appear as one-tap repeats. Type a question and it goes to Ask. Use the keyboard's mic to say it. |
| **Settings** | Name, currency, Meta key (kept in the iOS Keychain), Muse models, haptics, example month, JSON export (never includes the key), erase. |

## Design notes

- **Liquid Glass only where Apple intends it**: the composer, chips, toasts and the system tab and navigation bars float on glass; content sits on solid cards.
- **Summary first, detail one tap away**, as in the best finance apps: every number opens onto the entries behind it.
- **"Kept", not "left to spend"**: research on spending apps found that being sure how much is left near the end of the month tends to make people spend it. CashGlome shows what you kept and where you're heading instead.
- **Haptics** on add, undo, selection and chart scrubbing; numbers roll with `numericText` transitions; springs throughout.
- New York serif for headlines, rounded tabular digits for money, warm "gallery at night" palette in dark mode, museum paper in light.

## Privacy

Entries live in SwiftData on the phone. No account, no bank login, no analytics. Muse is used only with your key and switched on; the Ask consent card says exactly what is sent.

## Not done yet

- Receipt photos and home-screen widgets (the desktop app has receipts).
- Sync between phone and computer: export from one, keep the file. (Import on iPhone is a next step.)
- The project was written on Windows and has not been compiled yet. Expect to fix small compile errors the first time you build on a Mac.
