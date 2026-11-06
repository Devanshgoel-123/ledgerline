# Ledgerline for Android and iOS

The phone version of Ledgerline: an expense tracker that lives only on your
phone. No account, no server, no bank login.

- **Add as you spend.** Quick add is a keypad and a row of your most-used
  categories: amount, category, save. "More details" opens the full form (date,
  payee, splits). A reminder in the evening catches what you'd forget.
- **Payments from bank SMS (iOS).** Set up once in Settings → "Set up
  automatic capture": a Shortcuts automation runs Ledgerline's **Log bank
  message** action for each message, in the background. The action only
  writes the text to the App Group inbox; the app parses it on the phone
  (`src/core/sms.ts`), skips OTPs, requests, offers and chats, never adds the
  same payment twice, and lists new ones under "From your bank messages" for a
  quick review. Fallbacks: the link `ledgerline://capture?text=…` (a Shortcut
  "Open URLs" action, no native code), pasting a message, and the monthly
  statement check.
- **Payments from bank SMS (Android).** One tap in the same place: Ledgerline
  asks for SMS access, adds this month's bank payments, then reads new ones
  each time it opens. The native reader (`modules/ledgerline-sms`) returns
  only messages from business sender IDs, so messages from people never reach
  the app. Same parser, same dedupe as iOS.
- **Home-screen widget (iOS).** Shows today's and this month's spend. Tap it to
  open Quick add; the medium size has four category shortcuts. Deep link:
  `ledgerline://quick?category=food`.
- **Check your statement once a month.** Choose an HDFC or ICICI statement
  PDF, or a CSV export from any bank (`src/core/csvStatement.ts` finds the
  header row and recognises the columns; if a bank names them oddly, you tap
  which is which). Ledgerline reads it on the phone and lists every payment
  that isn't in the app yet; tick the ones to add. Payments you already added are matched by
  amount and date (a day either way). Cash entries are never matched, because
  cash isn't in a statement.
- **See where it went.** Overview, Insights (categories, daily spend, trend,
  top shops), Transactions, People. Payments show the shop's logo when
  Ledgerline knows it, and the category's icon otherwise.
- **Split bills.** Split an expense with friends; only your share counts as
  your spending, and People shows who owes you until they pay you back.
- **Your data.** Export CSV, back up to a file and restore it on another phone,
  erase everything. Settings shows when you last backed up; Overview nudges
  after 30 days, and an optional reminder comes on the 1st of each month. The
  phone's own iCloud or Google backup also includes the database.
- **App lock.** Face ID, fingerprint or the phone's passcode when Ledgerline
  opens and after 30 seconds away (`src/features/AppLock.tsx`).
- **Share a month on X.** Category shares, amounts only if you choose.

## How it fits with the rest of the repo

The phone runs the backend's own pure TypeScript straight from `backend/src`,
so a statement is read, matched, categorised and totalled exactly as on the
web: the HDFC and ICICI parsers, statement matching, the shop catalog and rule
matching, spend totals, and bill splits. `metro.config.js` and the `@shared/*`
path in `tsconfig.json` point at it.

| Part | Where |
|---|---|
| Screens | `src/app` (Expo Router: tabs plus Add, Edit, Check a statement, Categories, Welcome) |
| Phone-side logic | `src/core` (pure, tested on Node) |
| Storage | `src/db` (SQLite on the phone, via expo-sqlite) |
| PDF reading | `src/pdf`: pdf.js in a hidden WebView, inlined so it works offline |
| Reminders | `src/reminders`: local notifications scheduled on the phone |
| Bank SMS capture | `src/core/sms.ts` (parser), `src/core/capture.ts` (dedupe, categorise, save), `src/capture/inbox.ts` (App Group inbox), `plugins/withBankMessageIntent.js` + `plugins/native/LogBankMessageIntent.swift` (the iOS action) |
| Widget | `src/widget`: the `expo-widgets` layout (`QuickAddWidget.tsx`) and `sync.ts`, which pushes totals after every load and write |
| Theme | `src/ui/theme.ts`; the tokens, contrast ratios and screen specs are in `docs/MOBILE_DESIGN_HANDOFF.md` |
| Built-in categories and shops | `src/core/taxonomy.ts` (the phone's category tree: every backend slug, plus bills, subscriptions, education, EMIs, insurance, income), `src/core/brands.ts` (about 450 shops, apps, banks and billers, with their categories; logos come from `npm run brand-logos`, which trims and centres each one), on top of `src/core/catalog.generated.json`, made from the backend migrations by `npm run catalog` |
| Logos and category icons | `assets/brands/` and `src/ui/brandLogos.generated.ts`, bundled with the app by `npm run brand-logos` (never fetched on the phone); SF Symbols / Material icons per category in `src/ui/CategoryVisual.tsx` |

## Run it on your phone (development)

You need Node 22.13 or later (24 LTS is fine) and the **Expo Go** app on your
phone (App Store or Play Store). The phone and computer must be on the same Wi-Fi.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code: with the Camera app on iPhone, or from inside Expo Go on
Android. The app opens in Expo Go and reloads when you change code.

Everything works in Expo Go, including reminders (they are local
notifications) and reading statement PDFs, **except the home-screen widget**,
which needs a development or store build (`expo-widgets` is a native module).
In Expo Go the widget calls are skipped.

Building iOS locally (`npx expo run:ios`) needs Xcode 26.4 or later for SDK 58.
EAS builds in the cloud with the right Xcode, so you don't need it for store
builds.

To try it on a computer instead, press `w` for the web build. That build has
no reminders, and it stores data in the browser.

## Build installable apps

Builds run on Expo's build service (EAS), so you don't need Xcode or Android
Studio. You need a free Expo account.

```bash
npm install -g eas-cli
eas login
eas build:configure          # once: links the project to your Expo account
```

**Android, an APK you can install directly or share:**

```bash
eas build --platform android --profile preview
```

**Play Store (an .aab), then submit it:**

```bash
eas build --platform android --profile production
eas submit --platform android
```

**Android specifics.** Long-press the app icon for **Add expense** and
**Upload statement** (static app shortcuts from `plugins/withAndroidShortcuts.js`,
deep-linking to `/quick` and `/statement`). There's no Android home-screen
widget yet: `expo-widgets` Android buttons can't open a deep link. The
manifest blocks permissions the app doesn't use (`SYSTEM_ALERT_WINDOW` and
legacy storage), so the Play listing shows only what's needed. New personal
Play accounts must run a closed test with at least 12 testers for 14 days
before the first production release.

**Build an APK on your own Mac** (no EAS): JDK 17–21 and the Android SDK with
platform 37, build-tools 37.0.0 and NDK 27.1.12297006 (React Native 0.88).

```bash
npx expo prebuild --platform android   # android/ is generated and git-ignored
cd android && ./gradlew assembleRelease # app/build/outputs/apk/release/
```

A local release APK is signed with the debug key: fine for testing on your
own phones, not for Play. Play builds come from EAS.

**iOS.** Installing on an iPhone outside the App Store, or publishing to it,
needs an Apple Developer account (US$99 a year).

```bash
eas build --platform ios --profile production
eas submit --platform ios      # TestFlight, then App Store review
```

The app ID is `app.ledgerline.mobile` on both platforms (`app.json`). Change
it before your first store build if you publish under another name.

### First App Store release: checklist

1. `eas login`, then `eas build --platform ios --profile production`. EAS asks
   to create the certificates and profiles. Say yes. It also registers the
   widget extension (`app.ledgerline.mobile.ExpoWidgetsTarget`) and the App
   Group `group.app.ledgerline.mobile` that the app and widget share.
2. `eas submit --platform ios`, then install from TestFlight on a real iPhone.
   Check: add from Quick add, add the widget (small and medium) and tap it,
   tap a widget category, and check one real HDFC or ICICI statement.
3. If the widget target fails to build or misbehaves, remove the
   `expo-widgets` entry from `plugins` in `app.json` and rebuild. Nothing else
   depends on it.
4. App Store Connect: privacy label **Data Not Collected**. Category: Finance.
   In the review notes, say there's no account, no bank login and no server.
   Take screenshots on a 6.9" device: Overview, Quick add, Upload statement,
   Lifestyle, widget.

## Checks

```bash
npm run typecheck     # app and tests
npx eslint .
npm test              # logic and SQL, on Node (node:sqlite stands in for the phone's SQLite)
npx expo export --platform android --platform ios   # both bundles build
```

`npm install` also builds the PDF reader page (`npm run pdf-reader`). After
changing categories or shops in a backend migration, run `npm run catalog` and
commit the result; CI checks it matches.

## Privacy

Nothing is sent anywhere. There is no analytics or crash reporting. Statements
are read in memory and the copy the file picker makes is deleted. The PDF
reader page has no network access of its own: pdf.js is inlined, and the
WebView only loads its own page. Data leaves the phone only when you export a
CSV or a backup, and then only where you send it.
