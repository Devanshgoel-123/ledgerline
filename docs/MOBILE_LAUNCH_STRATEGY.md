# Ledgerline for iPhone: launch strategy

November 2026. Launch target: App Store submission on 7 Nov 2026 (Apple Developer membership expected on 6 Nov).

## Positioning

**For** salaried Indians who pay mostly by UPI and want to know where the month went,
**who** don't want to hand their bank login or SMS inbox to a fintech app,
**Ledgerline** is a private expense tracker
**that** gives you a correct month: quick to add as you spend, and checked against your bank statement once a month,
**unlike** SMS-reading or account-aggregator apps,
**it** keeps everything on your phone. No account, no server, no bank login.

## The problem we're solving on the phone

> "I pay for everything by UPI, so I *think* my bank has it all, but by month-end I can't say where ₹30,000 went, and the chai, autos and cash never show up anywhere."

Two jobs, at very different frequencies:

| Job | How often | What it needs from the phone |
|---|---|---|
| Capture a payment as it happens | 3–10× a day | **Two seconds.** Amount, category, done, ideally without opening the app |
| Close the month | 1× a month | **Upload the statement here**, see what's missing, tick to add |
| Understand where it went | 1–4× a month | One glance: total, pace and categories that look different from each other |

## Strategic choices for v1.0

1. **Speed of capture beats richness of capture.** Quick add (amount → category → save) is the default. The full form, with splits, payee, method and date, is one tap away and never in the way.
2. **The statement is the safety net, so it's always one tap away.** "Upload statement" sits next to "Add expense" on Overview, not in a card at the bottom.
3. **Add from the home screen.** An iOS widget shows today and this month, and opens straight into Quick add.
4. **Look like a consumer app people want to open.** A vivid, professional theme (indigo primary, warm spend accent, a distinct colour per category), still calm enough for money.
5. **Privacy is the product, not a setting.** The on-device promise appears where it matters: on first launch, on the statement upload and in the App Store copy.

## Non-goals for v1.0

- No SMS reading or account aggregator (it breaks the privacy promise and App Store review is harder).
- No cloud sync. Backup files only.
- No new banks (HDFC and ICICI only). CSV statements come next.
- No Android store launch on the same day (same code, but separate testing).
- No changes to how totals are calculated (they must match the web app).

## Bets and how we'll know

| Bet | Leading indicator (asked in interviews and TestFlight feedback; no telemetry) | Good looks like |
|---|---|---|
| Quick add closes the manual gap | Entries added per active day | 3+ |
| The widget drives capture | Share of testers who add the widget in week 1 | 40%+ |
| A visible statement upload gets used | Testers who check a statement within 7 days | 60%+ |
| The privacy promise converts | App Store page → install (App Store Connect analytics) | Above category median |

## Sequence

| When | What |
|---|---|
| **Today (5 Nov)** | Quick add sheet, new theme, Overview with primary actions, statement reading state, iOS widget, simulator pass |
| **6 Nov** (membership arrives) | `eas build --profile production --platform ios`, run on a real iPhone via TestFlight, test with one real HDFC statement, then screenshots |
| **7 Nov** | App Store Connect listing, privacy nutrition label ("Data Not Collected"), submit for review |
| **After launch** | CSV statements, the "without rent" view, Android Play Store, more banks |

## Launch risks

| Risk | Mitigation |
|---|---|
| Widget native target untested locally (this Mac has Xcode 16.2; SDK 58 needs 26.4+) | EAS cloud build compiles it. Verify on TestFlight before submitting. If it fails, remove the `expo-widgets` plugin entry and ship without the widget. The in-app Quick add doesn't depend on it |
| Review rejection over finance-app rules | No lending, no bank login, no data collection. Say so in the review notes |
| A statement format change breaks parsing | Clear error with a "report" path, and manual entry still works |
