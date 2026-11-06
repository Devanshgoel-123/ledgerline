# UX audit: Ledgerline iOS app (quick mode), 5 Nov 2026

## 1. Scope and evidence

**Reading of the request.** Audit the existing Expo app in `mobile/` before it ships to the App Store, then fix it. Scope: the phone app's core paths: adding an expense, checking a statement, the Overview, and the visual theme. Platform: native iOS (Android shares the code but wasn't run). Audience: **mainstream** Indian UPI users, not finance experts. Stakes: **money and privacy**. Numbers have to be right and explained, and the privacy promise has to be visible. The product isn't onchain.

**Evidence.**
- **Rendered:** Expo Go 58.0.7 on an iPhone 16 Pro simulator (iOS 18.3), with 15 seeded entries for Oct–Nov 2026. Screenshots are in `ux-audit-ledgerline-ios-2026-11-05-evidence/`: Overview, Add expense, Check a statement, Lifestyle, Transactions.
- **Code:** `mobile/src/app/**`, `mobile/src/features/**`, `mobile/src/ui/**`.
- **Computed:** contrast ratios from theme hex values (`contrast-check.py`).
- **Not seen:** taps, scrolling and keyboard behaviour (no tap automation was available), the statement review step with a real PDF, People, Settings, dark mode, VoiceOver. Findings about those are marked *Inferred* or kept out.

## 2. Executive summary

The app's logic is careful and its copy is honest. The two things a phone user does most still feel slow and dull, though. **Adding an expense is a 10-section form**: "What for" is required and Save sits below the fold. So the "two seconds, chai ₹20" moment the product promises (PRODUCT.md, next step 3) doesn't happen. **The statement check, the phone's best feature, sits sixth on the Overview, below the fold.** **The palette is close to monochrome**: brown primary, olive and grey categories. Food, Grocery and Investments are nearly the same green, so category colour does little work, and the app reads as a ledger rather than a consumer app. Placeholder and some meta text fall below WCAG AA contrast. Fix these three areas (a quick-add sheet, a visible statement entry point, a vivid accessible palette) and the launch build gets much better at low risk.

## 3. Quick wins

1. Make "What for" optional. Default the description to the category name (FORM-01).
2. Put Save in a footer that stays above the keyboard (FLOW-01).
3. Raise `muted2` to at least 4.5:1 and use copper only for large text, or darken it (A11Y-01).
4. Remove the second "November 2026" and the duplicate avg/day (VIS-02).

## 4. Findings

### Core task flows

**FLOW-01: Adding an expense takes a scroll and a 10-part form** · High · Observed (rendered + code) · Effort M
- *Location:* `src/features/EntryForm.tsx`, `/add`
- *Evidence:* The modal shows, in order: Spent/Received, Amount, What for, Paid to, shop/person chips, 14 category chips, then (below the fold) When, Paid by, Split, Note and **Save**. On first view the keyboard covers the lower half of a screen that is already full, so Save is two screens away.
- *Why it matters:* Manual entry is where the statement doesn't reach (cash, UPI Lite), and people only keep it up if it's nearly free. Each extra field adds a chance to put the phone down and forget.
- *Recommendation:* A **Quick add** sheet: a big amount keypad, one row of the 8 most-used categories (most recent first), an optional note, and Save always visible. "More details" opens the full form with the values carried over. A home-screen widget opens this sheet directly.

**FLOW-02: The statement check is hard to find** · High · Observed (rendered + code) · Effort S
- *Location:* Overview, card 6 ("Anything missing?"), `src/app/(tabs)/index.tsx`
- *Evidence:* On a 6.1″ screen the first view shows the hero, two stat cards and the top of Daily limit. The statement card needs two screens of scrolling. No tab and no header action leads to it.
- *Why it matters:* The monthly check is what turns a half-complete ledger into a correct month, and on the phone it's the main reason to choose Ledgerline over a notes app.
- *Recommendation:* Two big actions under the hero: **Add expense** and **Upload statement**. Once 25 days pass without a check, show a banner: "It's been a while. Upload this month's statement."

### Input and forms

**FORM-01: Amount + category alone can't be saved** · High · Observed (code) · Effort S
- *Evidence:* `save()` sets `errors.what = "Add what it was for…"` when both description and payee are empty.
- *Why it matters:* "₹60, Food" is a complete thought for most people, and the form rejects it.
- *Recommendation:* When both are empty, save the category label as the description.

### Visual hierarchy and theme

**VIS-01: Category colours can't be told apart, and the palette reads as muted** · High · Observed (code + rendered) · Effort M
- *Evidence:* Food `#6b7c4e`, Grocery `#7a8856` and Investments `#5a7848` are three similar olive greens. Primary is `#3c3834` (dark brown). The Lifestyle bars and the entry-row initials rely on these colours.
- *Why it matters:* Category colour is how people scan a month at a glance. When five categories share one hue, the breakdown becomes something to read instead of something to see.
- *Recommendation:* One vivid primary (indigo-violet) for action and brand, a warm accent for spend, green for money in, and a 12-hue categorical set spaced around the colour wheel. Every colour checked for contrast in both themes. *(Brand direction is a taste call; distinguishability is not.)*

**VIS-02: The Overview repeats itself above the fold** · Medium · Observed (rendered) · Effort S
- *Evidence:* "November 2026" appears as the title and again in the month switcher right below it. "₹35,533 spent" appears in the subline and in the hero. Avg/day appears as a pill and as a card.
- *Recommendation:* Make the month title the switcher. Drop the subline. Keep avg/day once.

**CONTENT-01: Accounting caveats sit on the main number** · Medium · Observed (rendered) · Effort S
- *Evidence:* Under "Total spent": "includes rent, less refunds / investments stay off this number and the daily chart".
- *Why it matters:* For a mainstream user the first thing under their number reads like fine print, which makes the number feel unreliable.
- *Recommendation:* Hero subtext: "₹X left of your ₹Y/day pace", or the change from last month. Move the caveat to an ⓘ.

### Accessibility

**A11Y-01: Placeholder, meta text and copper body text below AA** · Medium · Observed (computed) · Effort S
- `muted2 #8a9288` on `#f5f8f6`: **3.00:1** (fails AA and the 3:1 non-text check). On white: 3.21:1.
- `copper #c46b3a` on white: **3.81:1**. It passes for the 44pt hero, but it's also used for 15pt "Bullet" icons and pill text.
- Dark `muted2 #6b7368` on `#10130f`: 3.81:1.
- *Recommendation:* Use 4.5:1 or better for all text tokens in both themes. A placeholder is text.

### Feedback and states

**STATE-01: Reading a statement shows only a disabled button** · Low · Observed (code); rendering Inferred · Effort S
- *Evidence:* The `reading` step renders `<Button label="Reading…" busy />`, with no sense of progress or of what's happening.
- *Recommendation:* A dedicated reading state, "Reading 3 pages on this phone…", with the lock reassurance repeated.

**STATE-02: The breakdown is dominated by rent** · Low · Observed (rendered) · Opportunity
- *Evidence:* Lifestyle shows Household at 79% (rent ₹22,000 of ₹35,533), and the copper bar swamps everything else.
- *Recommendation:* Not changed for launch (totals must match the web app). Consider a "without rent" toggle later.

### Platform

**PLAT-01: No way to add from outside the app** · Medium · Opportunity · Effort M
- Expense trackers live or die on capture speed. iOS users expect a home-screen widget (today's spend, plus a tap to add) and a long-press app-icon shortcut.
- *Recommendation:* A small/medium widget showing today and this month, whose tap opens Quick add. Note that `expo-widgets` needs a development or store build; Expo Go can't show it.

## 5. Backlog, in order

1. FORM-01, FLOW-01: Quick add sheet with an optional description.
2. FLOW-02: Upload statement as a primary action on Overview.
3. VIS-01, A11Y-01: new palette and categorical set, checked for contrast.
4. VIS-02, CONTENT-01: tidy the Overview hero.
5. PLAT-01: home-screen widget, deep-linked to Quick add.
6. STATE-01: statement reading state.
7. STATE-02: "without rent" view (after launch).

## 6. What's working, and what was left alone

- **The copy is honest and specific**: "Read on this phone. The file isn't uploaded or kept." This is the product's trust anchor. Kept as written.
- **The statement matching rules are explained up front** ("a day either way"). Kept.
- **Touch targets** are 44pt or larger throughout (`minHeight: 44–48`). No finding.
- **Destructive actions** (delete payment, remove sample data) have confirmations. No finding.
- **The totals logic** is shared with the web app. Not touched, because the numbers have to match.

## 7. Open questions

- Do real users enter a description? (A hypothesis: most only type an amount. Worth checking with the first 20 testers.)
- Which categories do people pick first? Quick add orders them by recent use, so that's self-correcting.
- Dark mode wasn't rendered and needs one pass on a device.
