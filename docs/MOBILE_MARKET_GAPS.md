# Ledgerline phone app: market gaps, adoption risks and probes

7 November 2026, the day of App Store submission. Owner: Devansh Goel.

This page answers three questions. Who else does this job for Indian users, and how? Why would someone not use Ledgerline? What should we test cheaply before building more?

Read with `docs/PRD.md` (what we're building), `docs/MOBILE_LAUNCH_STRATEGY.md` (why) and `mobile/README.md` (what exists).

Competitor facts were checked on the web on 7 Nov 2026. Sources are linked. Where sources disagree (prices, mostly), the table says so. Prices are in US dollars because most listings show that; Indian prices are usually lower. Check the India store listing before quoting any price.

---

## 1. What Ledgerline is today (checked in the code)

Before listing gaps, here is what actually exists on `mobile-app`, so nothing below calls a built feature missing.

| Area | Built | Not built |
|---|---|---|
| Capture | Quick add keypad with most-used categories; full form; daily and afternoon reminders; iOS widget (compiles first on EAS); Android long-press shortcuts | — |
| Automatic capture | **iOS only:** Shortcuts automation with the "Log bank message" App Intent, `ledgerline://capture?text=` link, paste a bank message, review inbox ("From your bank messages") | **Android SMS capture.** No `READ_SMS`/`RECEIVE_SMS` and no notification listener. `auto-capture.tsx` says "Coming to Android next" |
| Statements | HDFC and ICICI PDF, read on the phone, password never stored, missing payments listed, matched by amount ± 1 day | Any other bank. CSV/XLS statements. UPI-app exports (GPay, PhonePe, Paytm) |
| Ledger | Spend and received entries, categories (built-in tree plus custom), ~270 recognised brands with logos, rules ("always file X under Y"), splits with People and settle-up, search and filters | Accounts or balances, transfers, multiple currencies, receipt photos, tags |
| Planning | One **daily limit** shown on Overview and the daily chart | Monthly or per-category budgets, savings goals, recurring payments, subscription detection, bill due dates |
| Insights | Overview, Lifestyle (categories, trend, top shops), daily bars, sample month on first run | Weekly summary, "unaccounted" gap line, comparison with last month beyond the trend |
| Data | CSV export, backup to a file, restore from a file, erase everything | Automatic backup, a "last backed up" date or backup reminder, sync between devices, app lock (Face ID / passcode) |
| Platforms | iOS (submitting today); Android builds as an APK | Play Store listing, Android widget |

Two things in the task brief need correcting: **Android bank-SMS capture is not built**, and **budgets are limited to a single daily limit**.

---

## 2. Competitive comparison

The ten that matter most for a UPI-paying Indian salaried user in late 2026.

| App | How it gets transactions | Key features | Price | Where the data lives | What it means for us |
|---|---|---|---|---|---|
| **Google Pay** (Insights + "Ask Google Pay") | Automatic, for payments made in GPay | Spend summaries by category in Insights; since 29 Jul 2026 a Gemini chat that breaks spending into categories with charts in 10 Indian languages, rolling out in phases, opt-in ([Business Today](https://www.businesstoday.in/technology/news/story/google-pay-introduces-ai-powered-ask-google-pay-track-spending-understand-sips-and-access-more-credit-546164-2026-07-30), [Android Headlines](https://www.androidheadlines.com/2026/07/google-pay-launches-gemini-powered-ask-google-pay-to-simplify-your-finances.html), [Google help](https://Support.Google.Com/googlepay/answer/10197135)) | Free | Google's servers | **The real default.** Zero effort, already installed. Only sees GPay payments, not cash, cards or other UPI apps |
| **Paytm** | Automatic, for Paytm payments | Auto-tags each payment (food, travel, shopping, bills, transfers), editable tags, monthly spend summary ([Paytm blog](https://paytm.com/blog/payments/paytm-introduces-automatic-spend-categorization-and-monthly-spend-summary-for-smarter-expense-tracking)) | Free | Paytm's servers | Same story: good enough inside one app, blind to the rest. BHIM added similar spend analytics in Jan 2026 ([Patrika](https://develop.patrika.com/en/latest-technology/bhim-apps-digital-munim-to-curb-upi-spending-control-extravagance-20270348)). PhonePe has no confirmed consumer equivalent we could find |
| **axio** (formerly Walnut) | Reads bank SMS (Android) | Spend detection, bills, budgets, tags, receipt photos, search; now bundled with Pay Later, loans and FDs. ~14.5M installs, ~4.0 rating. v8.9.6 on 22 Jul 2026 says SMS is also used "for fraud prevention in personal loans" ([APKMirror](https://www.apkmirror.com/apk/axio-digital-pvt-ltd/axio-expense-tracker-bnpl/axio-expense-tracker-budget-8-9-6-release/), [AppGoblin](https://appgoblin.info/apps/com.daamitt.walnut.app)) | Free (monetised by lending) | Says SMS stays on device; account needed | The incumbent for "automatic". Its lending pivot is the distrust Ledgerline's positioning is built on |
| **CRED Money** | Account Aggregator (AA) | All bank balances and transactions in one view, merchant/category search, reminders for SIPs, EMIs, rent, insurance; flags big spends and refunds. Launched Jul 2024 for CRED members; CRED said it won't charge for it ([TechCrunch](https://techcrunch.com/2024/07/24/cred-launches-personal-finance-manager-for-indias-affluent/), [Inc42](https://inc42.com/buzz/kunal-shah-led-cred-unveils-new-offering-to-help-customers-manage-bank-accounts-track-expenses)) | Free | CRED's servers via AA | Fully automatic, no SMS. Needs a CRED account and AA consent |
| **INDmoney** | Account Aggregator | Bank tracking inside a net-worth app; category breakdown, income vs spend, "spending drift" flags on rising categories ([INDmoney](https://www.indmoney.com/networth/track-bank-accounts)) | Free (monetised by investing) | INDmoney's servers | Expense tracking is a side feature of an investing app |
| **Money Manager** (Realbyte) | Manual | Very popular manual tracker: accounts/assets, budgets, reports, PC companion. Free with ads and a 15-asset limit; paid unlocks reports and cloud sync ([App Store](https://apps.apple.com/us/app/id564730202), [App Pricing Lab](https://apppricinglab.com/app/google_play/com.realbyteapps.moneymanagerfree)) | Free with ads; paid ~$6 one-time or subscription (listings disagree) | On device; optional sync | The closest manual rival. Proves people will type if entry is fast and reports are good |
| **Cashew** | Manual, CSV/Google Sheets import, app links for pre-filled entries | Budgets with per-category limits, savings goals, recurring and subscription entries, multiple accounts and currencies, biometric lock, Google Drive backup, cross-device sync. Open source (GPL-3.0) ([GitHub](https://github.com/jameskokoska/Cashew), [AlternativeTo](https://alternativeto.net/software/cashew--expense-budget-tracker/about)) | Free; sync may be a paid tier (sources disagree) | On device; backup to your own Drive | **The feature bar for a free, private, manual app.** It has budgets, goals, recurring and app lock; we don't |
| **Splitwise** | Manual | Group expenses, balances, settle-up. Free tier capped at about 4 new expenses a day, with ads; Pro ~$4.99/mo or $39.99/yr ([App Store](https://apps.apple.com/us/app/splitwise/id458023433), [Finny blog](https://getfinny.app/blog/splitwise-pricing-2026)) | Freemium | Splitwise's servers | Wins on splits because the friend sees the debt too. Our splits are one-sided (only you see them) |
| **Wallet** (BudgetBakers) / **Spendee** | Manual; bank sync on paid tiers (patchy outside Europe) | Budgets, shared wallets, multiple accounts, reports. Wallet: Premium ~$5.99/mo or ~$22/yr, lifetime offered ([Finder](https://www.finder.com/uk/budgeting/wallet-budgetbakers-review)). Spendee: Plus $14.99/yr, Premium ~$22.99/yr; bank-sync reliability is the top complaint ([Spendee](https://www.spendee.com/premium), [Millennial Money](https://millennialmoney.com/spendee-review)) | Freemium, subscription | Their servers | Global apps. Weak on Indian banks and UPI. Set the expectation of budgets and shared wallets |
| **Bluecoins** / **Monefy** | Bluecoins: manual plus bank SMS/notification auto-log (Premium). Monefy: manual | Bluecoins: accounts, budgets, reports, one-time Premium (~$8, unconfirmed) ([Bluecoins](https://new.bluecoinsapp.com/guide/bank-notifications/), [FAQ](https://new.bluecoinsapp.com/faq/)). Monefy: fastest-possible manual entry, sync through your own Google Drive/Dropbox, passcode in Pro, one-time ~$3–6 ([App Store](https://apps.apple.com/app/id1212024409), [Gerald review](https://joingerald.com/learn/financial-wellness/monefy-expense-tracker-review)) | One-time unlock | On device / your own cloud | Both prove "your own cloud" sync is possible without a company server |
| **2025–26 indie entrants** | Mostly Android SMS parsing on device | MandateVault, LABAM, Finledge, Ruply, Cashiro, the F-Droid "UPI Expense Tracker" all claim on-device SMS parsing and no server ([hunted.space](https://hunted.space/product/mandatevault), [LABAM](https://sites.google.com/view/labamapp/home), [Product Hunt](https://www.producthunt.com/p/finledge-expense-tracker/finledge-expense-tracker), [F-Droid](https://f-droid.org/is/packages/com.goushik.upiwallet/), [Cashiro](https://f-droid.org/bo/packages/com.ritesh.cashiro/)). Finny is an iOS-only manual/AI tracker, Pro $17.99/yr ([Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)) | Mostly free | On device | **"Private + automatic" is no longer unique on Android.** Our edge there has to be statements, brands and quality, not privacy alone |

Context worth knowing:

- **Fi** wound down banking on its app in March 2026 ([TechCrunch](https://techcrunch.com/2026/03/11/india-neobank-fi-winds-down-banking-services-on-its-platform)). Neobank money tools are not a stable competitor; Jupiter is still running but we found no recent news on its spend tools.
- **Account Aggregator is mainstream now.** About 338 million accounts were linked by August 2026 ([Free Press Journal](https://www.freepressjournal.in/business/rbi-to-make-account-aggregators-interoperable-allow-cas-bank-deposits)), and Sahamati counts about 6 crore personal-finance users ([NewKerala](https://www.newkerala.com/news/a/indias-account-aggregator-ecosystem-facilitates-nearly-38-crore-263.htm)). "Automatic without SMS" is a real, free option for anyone who doesn't mind a company holding the data.
- **iPhone is a small slice of India.** About 6% of mobile web traffic in September 2026, Android about 94% ([StatCounter](https://gs.statcounter.com/os-market-share/mobile/india)). An iOS-first launch reaches a narrow, higher-income group.
- **SBI is the biggest bank by customers** (about 53 crore) ([AskFuzz, citing Groww](https://askfuzz.ai/discover/news/banking/sbi-leads-deposits-hdfc-bank-tops-per-customer-average)). Statement support for HDFC and ICICI only misses most people.

---

## 3. Why a person won't use Ledgerline

Ranked by severity: how many target users it stops, and how early. "Status" says what exists today, so the gap is precise.

| # | Reason | Severity | Status in the app | Why it bites |
|---|---|---|---|---|
| 1 | **"My UPI app already shows this."** GPay Insights, Ask Google Pay, Paytm tags and BHIM analytics are free, automatic and already installed | Critical | Not addressable by a feature; only by positioning | The user has to believe the gap (cash, cards, other UPI apps, a correct month) is worth an extra app. Most won't feel it until month-end |
| 2 | **Typing every payment gets old.** Day-30 retention for finance apps is around 4–7% even for apps that capture automatically ([Braze](https://www.braze.com/resources/articles/mobile-app-retention), [Similarweb](https://www.similarweb.com/blog/research/apps/app-retention-strategy)) | Critical | Quick add, widget and reminders are built. iOS SMS capture exists but needs a Shortcuts automation the user builds; Android has none | On iOS, the PRD itself rates "users don't set up the Shortcut" as High likelihood. Without it, Ledgerline is a manual tracker competing with Money Manager and Cashew |
| 3 | **My bank isn't supported.** The monthly statement check only reads HDFC and ICICI PDFs | High | Built for 2 banks; no CSV/XLS import | The statement check is the "correct month" promise. SBI, Axis, Kotak and the rest get a manual-only app |
| 4 | **"If I lose my phone, I lose everything."** | High | Backup and restore by file only. No automatic backup, no reminder, no "last backed up" date, no sync. Unverified whether the SQLite file rides along in iCloud device backup / Android Auto Backup | Local-only is the promise and also the fear. People who've lost data once won't trust a file they have to remember to save |
| 5 | **Never heard of it.** A new finance app with no reviews, no brand and a privacy claim the user can't check | High | Privacy is stated on welcome, auto-capture and Settings; App Store label will say "Data Not Collected" | Finance is where people are most wary of unknown apps. Discovery in the Finance category without ads or reviews is slow |
| 6 | **Not on my phone.** No Play Store listing yet; ~94% of Indian phones are Android | High (for reach) | APK builds; Play needs a 12-tester, 14-day closed test for a new personal account | Every friend who hears about it on Android hits a dead end |
| 7 | **No budgets or goals.** Only a single daily limit | Medium | Daily limit built; no per-category or monthly budgets, goals or recurring payments | Budgeters compare against Cashew, Money Manager and Wallet, which all have them. Trackers ("where did it go?") care less |
| 8 | **No app lock.** A finance app without Face ID lock feels odd for a privacy product | Medium | Not built | Cashew and Monefy offer it. Cheap to add, and it matches the brand |
| 9 | **No balances or accounts.** Can't see "how much is left in HDFC" | Medium | Not built (entries only, no account model) | AA apps (CRED Money, INDmoney) show live balances. Users who want net worth go there |
| 10 | **Splits only live on my phone.** The friend doesn't see what they owe | Low–Medium | Splits, People and settle-up built, one-sided | Groups that split often already use Splitwise. Ledgerline's splits are for "my share" accounting, not for chasing friends |
| 11 | **Shortcuts setup feels technical.** Personal Automation, "Run Immediately", sender filters | Medium (iOS) | In-app guide exists | Folded into #2, listed so the probe has a clear target |

Things that are **not** reasons, because they exist: reminders, widget, splits, search, received money, custom categories, rules, CSV export, a sample month on first launch, dark mode.

---

## 4. Feature-gap table

✅ has it · ◐ partly · ❌ no. "Auto" means without typing.

| Feature | Ledgerline | GPay / Paytm | axio | CRED Money / INDmoney | Money Manager | Cashew | Splitwise | Wallet / Spendee | Android indies |
|---|---|---|---|---|---|---|---|---|---|
| No account, no server | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Auto capture, Android | ❌ | ◐ own app only | ✅ SMS | ✅ AA | ❌ | ❌ | ❌ | ◐ paid bank sync | ✅ SMS |
| Auto capture, iOS | ◐ Shortcut setup | ◐ own app only | ❌ | ✅ AA | ❌ | ❌ | ❌ | ◐ paid bank sync | ❌ |
| Cash and other UPI apps | ✅ manual | ❌ | ◐ | ❌ cash | ✅ | ✅ | ✅ | ✅ | ◐ |
| Statement import | ◐ HDFC, ICICI PDF | ❌ | ❌ | n/a (AA) | ◐ Excel import | ◐ CSV | ❌ | ◐ CSV | ❌ |
| India brand recognition | ✅ ~270 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ◐ |
| Category budgets | ❌ (daily limit only) | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ◐ |
| Goals | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Recurring / subscriptions | ❌ | ❌ | ✅ bills | ✅ reminders | ✅ | ✅ | ✅ | ✅ | ◐ |
| Accounts and balances | ❌ | ❌ | ◐ | ✅ | ✅ | ✅ | ❌ | ✅ | ◐ |
| Splits | ◐ one-sided | ◐ split request | ❌ | ❌ | ❌ | ❌ | ✅ shared | ◐ shared wallets | ❌ |
| Home-screen widget | ✅ iOS | ❌ | ◐ | ❌ | ✅ | ✅ | ❌ | ✅ | ◐ |
| App lock | ❌ | ✅ (UPI PIN) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ◐ |
| Sync / auto backup | ❌ file only | ✅ | ✅ | ✅ | ◐ paid | ✅ Drive | ✅ | ✅ | ◐ |
| AI questions about spend | ❌ | ✅ Ask Google Pay | ❌ | ◐ insights | ❌ | ❌ | ❌ | ❌ | ❌ |
| Price | Free, no ads | Free | Free (lending) | Free (cross-sell) | Ads / ~$6 | Free | ~4/day free | Subscription | Free |

Cells for competitors come from the sources in section 2. Where a source didn't confirm a feature, the cell is ◐ or ❌ conservatively; check before quoting externally.

**Where Ledgerline genuinely leads:** the only app that is fully private *and* reconciles against a bank statement *and* knows Indian brands. **Where it trails:** automation on Android, statement coverage beyond two banks, budgets, and data safety.

---

## 5. What can be done

Effort: **S** = 1–2 days, **M** = 3–7 days, **L** = 2+ weeks, one person.

### Now (launch week, while the build is in review)

| # | Action | Fixes | Effort |
|---|---|---|---|
| N1 | **Backup safety:** show "Last backed up: 12 days ago" in Settings, nudge monthly with the statement reminder, and confirm whether the SQLite file is in iCloud device backup and Android Auto Backup (probe P5). If it is, say so on the welcome screen | #4 | S |
| N2 | **Face ID / passcode lock** (`expo-local-authentication`), off by default, one switch in Settings | #8 | S |
| N3 | **One-tap Shortcut install:** publish an iCloud Shortcut link per bank sender, so setup is "tap, allow" instead of building an automation by hand. Run probe P1 first to measure the current drop-off | #2, #11 | S–M |
| N4 | **App Store copy that answers "GPay already does this":** "Every rupee, not just one app: cash, cards and every UPI app, checked against your statement." Lead screenshot: Overview with cash and multiple UPI apps | #1, #5 | S |
| N5 | **Start the Play closed test** with the EAS preview APK and 12+ testers now, so the 14-day clock runs during iOS review | #6 | S (setup), clock-bound |

### Next (the next 4–8 weeks)

| # | Action | Fixes | Effort |
|---|---|---|---|
| X1 | **CSV/XLS statement import with column mapping**, saved per bank. Already #1 in `PRODUCT.md`. Covers SBI, Axis, Kotak without a PDF parser each. Run probe P4 first | #3 | M |
| X2 | **Android SMS capture (R11)** behind opt-in, with the Play "SMS-based money management" declaration, and the notification listener (R12) as fallback. Reuses `src/core/sms.ts` and the review inbox | #2, #6 | L |
| X3 | **Monthly budgets per category** (amount per category, progress on Overview). The daily limit already has the plumbing | #7 | M |
| X4 | **Recurring payments from history:** spot the same payee and amount each month (rent, Netflix, EMIs) and offer "remind me / add automatically" | #7, #2 | M |
| X5 | **SBI statement PDF**, if probe P4 shows CSV mapping is too fiddly for normal users | #3 | M |

### Later (after real usage data)

| # | Action | Fixes | Effort |
|---|---|---|---|
| L1 | **Encrypted sync through the user's own iCloud Drive / Google Drive** (the Monefy and Cashew model). Keeps "no Ledgerline server" true | #4 | L |
| L2 | **UPI-app history import** (PhonePe, Paytm, GPay exports) | #2, #3 | M per app |
| L3 | **Shared splits** via a link or QR the friend opens without installing | #10 | M–L |
| L4 | **Accounts with opening balances**, so "left in HDFC" can be shown from entries plus statements | #9 | M |
| L5 | **Android widget** once `expo-widgets` Android buttons can deep-link | #6 | M |
| — | **Not doing: Account Aggregator.** It needs a regulated FIU partner and routes data through third parties. Revisit only if probes show privacy doesn't drive installs (P3 fails) | — | — |

---

## 6. Proof of Life probes

Five probes for the riskiest assumptions. Each is cheap, narrow, has its failure threshold written down before it starts, and gets thrown away afterwards. Testers are friends and their friends on the TestFlight build or the Android APK.

Run them one at a time on this Mac: the emulator, Gradle and the simulator together hang an 8 GB machine.

### P1: Shortcut setup survives a normal person

**Hypothesis:** With the in-app guide, at least 6 of 10 iPhone testers set up the Shortcuts automation in under 3 minutes, and their next real bank SMS lands in "From your bank messages".

**Risk being eliminated:** iOS auto-capture is our answer to manual-entry fatigue (#2). If normal people can't or won't set it up, iOS Ledgerline is a manual tracker and N3 and the App Intent investment need rethinking.

**Prototype type:** Task-focused test.

**Target users:** 10 iPhone owners aged 22–40 who pay mostly by UPI, not developers, with an HDFC, ICICI, SBI or Axis account. Recruited from friends of friends.

**Success criteria:**
- **Pass:** ≥ 6/10 finish setup unaided in ≤ 3 min, and ≥ 5/10 have a real SMS captured within 48 h.
- **Fail:** ≤ 3/10 finish unaided, or median time > 6 min. Then the hand-built automation is dead; go straight to N3 (one-tap Shortcut link) or drop Shortcuts as a headline feature.
- **Learn:** the exact step where people stop (Personal Automation, sender filter, "Run Immediately", notification toggle).

**Tools:** TestFlight build, screen recording (Control Centre) or a video call with screen share, a stopwatch, a one-page note sheet per tester.

**Timeline:** Build 0.5 day (session script, note sheet) · Test 1.5 days (10 × 15 min sessions, 48 h follow-up message) · Analyse 0.5 day · Disposal day 4.

**Disposal plan:** Delete recordings after noting the drop-off step. Keep one table (tester, time, step reached, captured yes/no) in this doc. No code is written.

**Owner:** Devansh.

**Status:**
- [ ] Hypothesis defined
- [ ] Probe built
- [ ] Users recruited
- [ ] Testing complete
- [ ] Learnings documented
- [ ] Probe disposed

### P2: Real bank messages parse correctly across banks

**Hypothesis:** For real debit SMS from HDFC, ICICI, SBI, Axis and Kotak, the Shortcut passes the full message to the App Intent and `src/core/sms.ts` gets the amount and direction right on ≥ 90% of messages, without opening the app.

**Risk being eliminated:** PRD open question 3 (does the automation pass the full body?) and the "SMS formats vary" risk. If parsing is wrong, captured totals are wrong, which breaks the "correct month" promise.

**Prototype type:** Feasibility check.

**Target users:** Devansh's iPhone plus 3 friends with different banks; 50 real past debit/credit SMS pasted in (redacted names and account digits are fine), plus 10 live messages through the automation.

**Success criteria:**
- **Pass:** ≥ 45/50 pasted messages give the right amount and debit/credit; ≥ 9/10 live messages arrive without the app opening; 0 OTP or promo messages captured.
- **Fail:** < 40/50 correct, or the automation truncates or drops the body on any bank. Then hold the "automatic" claim in marketing, and per-bank fixtures become a prerequisite for X2 (Android SMS).
- **Learn:** which banks and message shapes fail (UPI vs card vs ATM vs credit).

**Tools:** TestFlight build (paste screen and App Intent), a spreadsheet of message vs parsed result, and a throwaway script that runs `parseBankMessage` over the redacted set on Node.

**Timeline:** Build 0.5 day (collect and redact messages, script) · Test 1 day (paste run, then live messages over normal spending) · Analyse 0.5 day · Disposal day 3.

**Disposal plan:** Delete the raw messages and the script. Turn only the failing message *shapes* (fully synthetic, no real numbers) into fixtures in `mobile/tests` if the result is acted on.

**Owner:** Devansh.

**Status:**
- [ ] Hypothesis defined
- [ ] Probe built
- [ ] Users recruited
- [ ] Testing complete
- [ ] Learnings documented
- [ ] Probe disposed

### P3: Privacy beats "GPay already shows it"

**Hypothesis:** Shown a 45-second pitch of Ledgerline next to what GPay Insights already gives them, at least 8 of 25 UPI-heavy people ask for the install link, and at least 5 add one entry within 48 hours.

**Risk being eliminated:** The biggest adoption killer (#1). If people don't see enough gap between their UPI app's free summary and Ledgerline, no feature fixes that. It also decides whether "privacy" or "every rupee, checked against the statement" leads the store page (N4).

**Prototype type:** Narrative prototype.

**Target users:** 25 salaried 22–40 UPI users, iPhone or Android, reached through WhatsApp groups and DMs. Not close friends (they'll say yes to be kind).

**Success criteria:**
- **Pass:** ≥ 8/25 (32%) ask for the link unprompted after the video; ≥ 5/25 add an entry within 48 h of installing (TestFlight or APK).
- **Fail:** ≤ 3/25 ask for the link, or most replies are "GPay does this." Then reposition before spending on features: the pitch shifts from privacy to "the month that matches your bank", and AA (currently a non-goal) gets reconsidered.
- **Learn:** split the 25 into two pitches (A: "nothing leaves your phone", B: "every rupee, checked against your statement") and compare link requests.

**Tools:** A 45-second screen recording of the TestFlight build with voice-over (two cuts, A and B), WhatsApp, a tally sheet. The TestFlight public link and the APK for those who ask.

**Timeline:** Build 1 day (two video cuts, message copy) · Test 2 days (send, wait 48 h for entries) · Analyse 0.5 day · Disposal day 4.

**Disposal plan:** Delete the videos and the tally after recording the counts here. Don't reuse the cuts as marketing; they're meant to be rough.

**Owner:** Devansh.

**Status:**
- [ ] Hypothesis defined
- [ ] Probe built
- [ ] Users recruited
- [ ] Testing complete
- [ ] Learnings documented
- [ ] Probe disposed

### P4: One CSV mapper covers most banks

**Hypothesis:** A single column-mapping step (date, description, debit, credit, or a signed amount) correctly reads ≥ 80% of rows from statement CSV/XLS exports of the 6 largest banks, with no per-bank code.

**Risk being eliminated:** #3 (my bank isn't supported). X1 is the plan for every bank beyond HDFC and ICICI. If bank exports are too messy (header junk, merged cells, split date columns, "Cr/Dr" suffixes), we need per-bank parsers (X5) instead, which costs much more.

**Prototype type:** Synthetic data simulation.

**Target users:** No users. Data: one real export each from SBI, HDFC, ICICI, Axis, Kotak and one more (Bank of Baroda or a credit card) from friends, with names and narration replaced by synthetic text that keeps the layout; plus 3 deliberately ugly synthetic files (header rows, footer totals, Dr/Cr columns).

**Success criteria:**
- **Pass:** ≥ 5/6 banks parse ≥ 80% of rows correctly (amount, date, direction) after one mapping; mapping takes ≤ 5 choices per bank.
- **Fail:** ≤ 3/6 banks pass, or a bank needs code to clean the file first. Then X1 shrinks to "CSV for the 2–3 clean banks" and X5 (SBI PDF) moves up.
- **Learn:** the list of quirks a mapper must handle (date formats, Dr/Cr, header offset, XLS vs CSV).

**Tools:** A spike script on Node in a scratch folder, reading CSV and XLS and comparing against hand-checked totals. Reuse `backend/src` date and amount helpers where they fit.

**Timeline:** Build 1 day (collect, anonymise, spike script) · Test 0.5 day (run all files) · Analyse 0.5 day · Disposal day 3.

**Disposal plan:** Delete the spike script and the real exports. Keep only the synthetic ugly files and the quirks list, as fixtures and notes for X1 if it goes ahead.

**Owner:** Devansh.

**Status:**
- [ ] Hypothesis defined
- [ ] Probe built
- [ ] Users recruited
- [ ] Testing complete
- [ ] Learnings documented
- [ ] Probe disposed

### P5: The phone's own backup already protects the data

**Hypothesis:** The Ledgerline SQLite database is included in a standard iPhone backup and in Android Auto Backup, and comes back intact after a restore, with no change to the app.

**Risk being eliminated:** #4 (data loss fear). If it's true, N1 is a sentence on the welcome screen plus a backup date, and L1 (own-cloud sync) can wait. If it's false, people who switch phones lose everything without knowing it, and L1 moves up.

**Prototype type:** Feasibility check.

**Target users:** No users. Devansh's devices: an Android emulator (Pixel 8, the existing release APK) and one iPhone with the TestFlight build.

**Success criteria:**
- **Pass:** On Android, `adb shell bmgr backupnow app.ledgerline.mobile`, uninstall, reinstall and restore brings back all 20 test entries. On iOS, the database file sits in a backed-up folder (not Caches or marked "exclude from backup"), and a local Finder backup and restore brings back the entries.
- **Fail:** Either platform loses the data, or Android Auto Backup is off for the app. Then N1 must say plainly "your phone's backup does not include Ledgerline; back it up here", and L1 moves into Next.
- **Learn:** the database size per year of entries, against Android Auto Backup's 25 MB limit.

**Tools:** `adb` and `bmgr`, Finder device backup, the in-app sample month as test data. Run the Android part and the iOS part on separate days (8 GB Mac).

**Timeline:** Build 0 days · Test 1 day (Android half day, iOS half day) · Analyse 0.5 day · Disposal day 2.

**Disposal plan:** Wipe the emulator and the test data on the iPhone. Record the result and the exact folder path here. No code.

**Owner:** Devansh.

**Status:**
- [ ] Hypothesis defined
- [ ] Probe built
- [ ] Users recruited
- [ ] Testing complete
- [ ] Learnings documented
- [ ] Probe disposed

### Order

| Order | Probe | Why first | Days |
|---|---|---|---|
| 1 | P5 Backup | No users needed; decides N1's wording before many people install | 2 |
| 2 | P2 Message parsing | Must be right before P1 puts real testers on it | 3 |
| 3 | P1 Shortcut setup | Needs the TestFlight build live | 4 |
| 4 | P3 Pitch | Can run in parallel with P1 (different people) | 4 |
| 5 | P4 CSV mapper | Decides the first "Next" build (X1) | 3 |

About two and a half weeks, done alongside App Store review and the Play closed test.
