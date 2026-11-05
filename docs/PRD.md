# PRD: Ledgerline for Android and iOS

| | |
|---|---|
| **Status** | v1.0 built and committed on `mobile-app` (b8651a6). v1.1 (automatic capture) proposed |
| **Owner** | Devansh Goel |
| **Last updated** | 6 Nov 2026 |
| **Related** | `docs/MOBILE_LAUNCH_STRATEGY.md` (why), `docs/MOBILE_DESIGN_HANDOFF.md` (how it looks), `ux-audit-ledgerline-ios-2026-11-05.md` (what was wrong), `docs/PRODUCT.md` (feature list across web and phone) |

Gaps are tagged inline: 🔶 **Assumption** (plausible, not yet validated) and 🔵 **Open question** (needs discovery or a decision).

---

## 1. Problem

> Salaried Indians pay for almost everything by UPI. They still can't say where ₹30,000 went at month-end. Bank apps show one account at a time with no categories. The apps that do categorise want a bank login, an SMS inbox or an email inbox, and send that data to a company's servers. Cash and UPI Lite never show up anywhere.

**Who has it:** UPI-heavy, salaried, 22–40, one to three bank accounts, uneasy about fintech apps reading their messages. 🔶 **Assumption:** this group is big enough, and privacy matters enough to them, that they'll accept slightly more manual work in exchange for nothing leaving the phone.

**Why now:** the web version already proved the parsing and totals work (HDFC/ICICI statements, alert parsing, categories, splits). The phone is where spending happens, and capture speed decides whether people keep a tracker up.

**What happens if we do nothing:** the people we want keep using SMS-reading apps they don't trust, or nothing at all.

## 2. Persona (proto)

**Ananya, 27, product analyst in Bengaluru.** About 90% of her payments are UPI (GPay and PhonePe), on an HDFC salary account plus an ICICI credit card. She pays rent by UPI and splits dinners with flatmates. She tried an SMS-reading budgeting app, uninstalled it after "it knew everything," and now keeps a Notes list she abandons by the 10th.

- **Jobs:** (1) Capture a payment in seconds, as it happens. (2) Close the month: know the total is right and nothing is missing. (3) See where it went and decide what to change. (4) Track who owes her from splits.
- **Won't do:** give a bank login, connect email, or create an account.
- 🔶 **Assumption:** she'll forward or allow *only bank SMS* if it's clearly processed on the phone. 🔵 **Open question:** does this hold for her, or is any SMS access a dealbreaker? Ask the first 20 testers.

## 3. Goals and non-goals

### Goals

| Goal | Metric (measured through interviews and TestFlight/Play feedback; the app has no telemetry) | Target at 30 days |
|---|---|---|
| G1: capture is effortless | Entries added per active day | ≥ 3 |
| G2: the month is correct | Testers whose month matches their bank's debits after one statement check | ≥ 70% |
| G3: people keep using it | Testers still adding entries in week 4 | ≥ 50% |
| G4: privacy is believed | "I trust that my data stays on my phone" (5-point scale) | ≥ 4.3 average |
| G5 (v1.1): less manual capture | Share of a tester's payments captured automatically (SMS/notification/Shortcut) | ≥ 60% for those who opt in |

### Non-goals (v1.x)

- No account, cloud sync or server. Backup files are the only way data moves.
- No email reading on the phone. Email stays a web-app feature.
- No Account Aggregator. It needs a regulated FIU partner and sends data through third parties, which breaks the promise.
- No lending, credit scores, ads or investment advice.
- No banks beyond HDFC and ICICI for statement PDFs in v1.0 (CSV comes next).

## 4. Scope

### v1.0: launch (built)

| # | Requirement | Platform | Status |
|---|---|---|---|
| R1 | **Quick add**: keypad amount, most-used categories first (the 60-day count), optional note, Save always visible; amount + category is enough | iOS, Android | Built |
| R2 | **Full form** ("More details"): date, payee or person, method, splits, note, "always file X under Y" rule; carries over Quick add values | Both | Built |
| R3 | **Upload statement**: HDFC/ICICI PDF read on the phone (pdf.js in a WebView), password once and never stored; lists missing payments; tick to add, skip to hide | Both | Built |
| R4 | **Overview**: spent this month, today against the daily limit, primary actions, nudge after 25 days without a check, top categories, daily chart, recent | Both | Built |
| R5 | **Insights**: Lifestyle (categories, trend, shops), Transactions (search), People (who owes you) | Both | Built (existing) |
| R6 | **Home-screen widget**: today/month, tap goes to Quick add, 4 category shortcuts (medium) | iOS only | Built, **not yet compiled** (see Risks) |
| R7 | **Reminders**: daily nudge, monthly statement nudge (local notifications) | Both | Built (existing) |
| R8 | **Your data**: CSV export, backup/restore file, erase everything | Both | Built (existing) |
| R9 | **Theme**: vivid, AA-contrast in light and dark, distinct category hues | Both | Built |

### v1.1: automatic capture without email (proposed)

The question this answers: *how does someone who won't share email, or whose bank doesn't email alerts, get payments in without typing?* Every bank in India sends an SMS for each debit and credit, so SMS is the universal source. The platforms differ sharply:

| Option | Android | iOS | Privacy | Store risk | Effort |
|---|---|---|---|---|---|
| **A. Read bank SMS on the phone** (`RECEIVE_SMS` + `READ_SMS`) | ✅ Live capture plus backfill of past months | ❌ No third-party SMS access, ever | On-device only | **High**: Play allows SMS permissions only for approved exceptions. "SMS-based money management" is one, but it needs a Permissions Declaration and review, and some expense trackers are rejected | M |
| **B. Read notifications** (NotificationListenerService): bank SMS notifications plus GPay/PhonePe/Paytm "Paid ₹X to Y" | ✅ Live only, no backfill | ❌ | On-device; the user grants access in system settings | Medium: not on the restricted list, but needs prominent disclosure. 🔵 **Open question:** does Play's current policy need a declaration? | M |
| **C. iOS Shortcuts automation**: "When I get a message from AD-HDFCBK containing 'debited'" runs Ledgerline's App Intent with the message text | ❌ | ✅ iOS 17+, Run Immediately, the banner can be turned off | On-device; the user builds the automation and Apple keeps control | Low: a standard App Intent | M: native Swift App Intent through a local Expo module; plus a one-time setup guide |
| **C′. Same, with no native code**: the Shortcut opens `ledgerline://capture?text=…` | ❌ | ✅ | Same | None | S, but the app opens on every payment (intrusive) |
| **D. Share or paste a message** into Ledgerline (share sheet / "Paste bank SMS") | ✅ | ✅ | Same | None | S |
| **E. UPI-app statements** (PhonePe, Paytm and GPay export history as PDF/CSV) | ✅ | ✅ | Same | None | M per app |

**Decision (proposed):**

- **Android:** ship **A** behind an explicit opt-in screen, and file the Play declaration (SMS-based money management) with the first Android release. Build **B** alongside it as the fallback if the declaration is rejected. Offer the **sideloaded APK** (EAS `preview` build) for people who want SMS reading without waiting for Play.
- **iOS:** ship **C′** first, since it's an afternoon of work. Then ship **C** with a guided setup ("Add automation" walk-through with screenshots) once the App Intent module is built. Add **D** on both platforms as the always-available manual fallback.
- **Parsing:** reuse `backend/src/bankMail/alertParser.ts` (pure TypeScript, already handles "debited/credited/VPA" alert text) through the existing `@shared` path, and add SMS fixtures for HDFC, ICICI, SBI, Axis and Kotak. Captured payments are matched against existing entries with the same amount ± 1 day rule that statements use, so nothing is counted twice.

| # | v1.1 requirement | Acceptance criteria |
|---|---|---|
| R10 | Opt-in screen explaining exactly what is read | Shows the list of bank sender IDs, "read on this phone, never sent anywhere", and an off switch in Settings. Nothing is read before opt-in |
| R11 | Android SMS capture | On opt-in, backfills 90 days. New bank SMS add an entry within 5 s with category suggested. Only allow-listed bank sender IDs are read; OTP and promotional SMS are ignored |
| R12 | Android notification capture (fallback) | Same, from the SMS app's notifications and from GPay, PhonePe and Paytm |
| R13 | iOS capture via Shortcut | An `ledgerline://capture?text=` URL (C′), then an App Intent "Log bank message" (C) that adds the entry without opening the app. A setup guide gets a tester from zero to a working automation in under 2 minutes |
| R14 | Paste or share a bank message | Paste or share text and see the parsed amount, date and payee, then confirm |
| R15 | No double counting | An SMS payment later found in a statement is matched, not added twice. Manual and SMS entries for the same payment are merged on confirmation |
| R16 | Review inbox | Automatically captured entries land as "New" with a badge, so the user can confirm or fix the category in bulk |

## 5. User stories

**Capture**
- As Ananya, I want to log ₹60 for chai in under 3 seconds, so I don't put it off and forget. *(R1)* **AC:** from the widget or the Overview button, keypad + Food + Save is 4 taps, and no keyboard appears.
- As Ananya, I want my bank's debit SMS to become an entry automatically, so I only type cash. *(R11/R13)* **AC:** after setup, a UPI payment shows in Recent within a minute (Android) or after the Shortcut runs (iOS), with amount, payee and a suggested category.
- As Ananya, I want to see and confirm what was captured automatically, so I trust the totals. *(R16)*

**Close the month**
- As Ananya, I want to upload my HDFC statement and see only what's missing, so the month is complete in 5 minutes. *(R3)* **AC:** password-protected PDFs open, matched payments are hidden, missing ones are pre-ticked, and one tap adds them.

**Understand**
- As Ananya, I want to see where the month went at a glance, so I can decide what to cut. *(R4/R5)* **AC:** the top 4 categories are on Overview with distinct colours, and the daily limit shows how much is left today.

**Trust**
- As Ananya, I want proof nothing leaves my phone, so I'm comfortable granting SMS access. *(R10)* **AC:** the opt-in screen and Settings state it plainly. The App Store and Play listings declare "Data not collected". The app has no network permission use beyond the stores.

**Story splits for v1.1** (smallest valuable first): R14 paste/share (both platforms) → R13a URL Shortcut (iOS) → R11 SMS live capture, then R11 backfill (Android) → R16 review inbox → R13b App Intent (iOS) → R12 notification fallback (Android).

## 6. Platform readiness

| | iOS | Android |
|---|---|---|
| Code | Shared Expo SDK 58 app | Same code |
| Bundle builds | ✅ `expo export` | ✅ `expo export` |
| Run on simulator or emulator | ✅ iPhone 16 Pro sim, light and dark (no taps) | ✅ Release APK on a Pixel 8 emulator (Android 16), tested with real taps: onboarding, reminders, Quick add, app shortcuts |
| Device test | Pending TestFlight (membership 6 Nov) | Pending: EAS `preview` APK installs on any phone without a developer account |
| Widget / shortcuts | Widget built, compiled only by EAS | No widget (Android widget buttons can't open a deep link). Long-press app shortcuts: Add expense, Upload statement |
| Store account | Apple Developer (arriving) | 🔵 **Open question:** is there a Google Play developer account ($25 one-time)? New personal accounts must run a closed test with ≥ 12 testers for 14 days before production |
| Ship date | Submit 7 Nov 2026 | 🔶 **Assumption:** about 2–3 weeks later, gated by the closed-test rule and the SMS declaration |

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| iOS widget extension fails to compile on EAS (never built locally; this Mac has Xcode 16.2, SDK 58 needs 26.4) | Medium | Remove the `expo-widgets` plugin entry and rebuild. Nothing else depends on it |
| Play rejects the SMS permission declaration | Medium–High | Notification-listener fallback (B), sideloaded APK, paste/share (D) |
| SMS formats vary by bank and change without notice | High | Allow-list sender IDs, fixture tests per bank, and "couldn't read this message" goes to the review inbox, never silently dropped |
| Android behaviour (native tabs, PDF WebView, notifications) is untested | Medium | Run the EAS preview APK on two real Android phones before Play submission |
| **Anti-pattern: "SMS reading makes it a surveillance app."** Reading all SMS, uploading samples "to improve parsing", or adding analytics later would destroy the one thing that makes Ledgerline different | n/a | Read only allow-listed bank senders, ignore OTPs, no network calls, and state it in the listing. Any future telemetry needs its own opt-in and a PRD change |
| **Anti-pattern: automation without review.** Auto-adding every parsed SMS straight into totals makes wrong categories and duplicates invisible | n/a | R16 review inbox: auto-captured entries are marked "New" until confirmed or for 7 days |
| Users don't set up the iOS Shortcut | High | Make paste/share and the widget good enough on their own. The Shortcut is a bonus for keen users |

## 8. Open questions

1. 🔵 Will the target user grant SMS access if it's on-device? Ask in the first 20 interviews before building R11.
2. 🔵 Does Play's current policy need a declaration for NotificationListenerService in a finance app?
3. 🔵 Does the iOS Message automation pass the full SMS body to an App Intent parameter? Verify on a device with an HDFC SMS before committing to R13b.
4. 🔵 Is there a Google Play developer account, and is it a personal or organisation account? This decides whether the 12-tester closed test applies.
5. 🔶 Most users have one or two banks, so a sender allow-list of about 15 IDs covers 90% of people.

## 9. Release plan

| Date | Milestone |
|---|---|
| 6 Nov | EAS iOS production build; TestFlight on a real iPhone; real HDFC statement test |
| 7 Nov | App Store submission |
| Week of 9 Nov | Android preview APK on 2 phones; fix Android issues; R14 paste/share; R13a URL Shortcut |
| Weeks 2–3 | R11 Android SMS + declaration; R16 review inbox; Play closed test starts |
| Week 4+ | R13b App Intent; R12 notification fallback; Play production |

---

## Self-assessment

- **Strongest section:** Scope v1.1 (§4). Each capture option is compared on platform, privacy, store risk and effort, and the decision names a fallback for each failure.
- **Weakest section:** Goals (§3). The targets are reasoned guesses with no baseline, and with no telemetry they rest on interviews and small samples.
- **Top assumptions to validate:** (1) the target user will grant on-device SMS access; (2) the iOS Message automation passes the full SMS text to an App Intent; (3) Play approves the "SMS-based money management" declaration for an app with no server.
- **Recommended next step:** before building any SMS feature, put the paste/share flow (R14) in TestFlight and interview the first 10 testers on open questions 1 and 3. Then run `/plan-roadmap` for v1.1.
