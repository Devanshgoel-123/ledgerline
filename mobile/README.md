# Ledgerline for Android and iOS

The phone version of Ledgerline: an expense tracker that lives only on your
phone. No account, no server, no bank login.

- **Add as you spend.** Amount, what for, done. Category is suggested from the
  shop name. A reminder in the evening (and optionally the afternoon) catches
  what you'd forget.
- **Check your statement once a month.** Choose an HDFC or ICICI statement PDF.
  Ledgerline reads it on the phone and lists every payment that isn't in the
  app yet; tick the ones to add. Payments you already added are matched by
  amount and date (a day either way). Cash entries are never matched, because
  cash isn't in a statement.
- **See where it went.** Overview, Lifestyle (categories, trend, apps and
  shops), Transactions, People, the same as the web app.
- **Split bills.** Split an expense with friends; only your share counts as
  your spending, and People shows who owes you until they pay you back.
- **Your data.** Export CSV, back up to a file and restore it on another phone,
  erase everything.

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
| Built-in categories and shops | `src/core/catalog.generated.json`, made from the backend migrations by `npm run catalog` |

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
notifications) and reading statement PDFs.

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

**iOS.** Installing on an iPhone outside the App Store, or publishing to it,
needs an Apple Developer account (US$99 a year).

```bash
eas build --platform ios --profile production
eas submit --platform ios      # TestFlight, then App Store review
```

The app ID is `app.ledgerline.mobile` on both platforms (`app.json`). Change
it before your first store build if you publish under another name.

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
