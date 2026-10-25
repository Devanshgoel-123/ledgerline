# UX audit — Ledgerline after the privacy-first local rebuild

The public website and the locally installed app's first run and core flows,
audited on 25 October 2026 at commit `56f85d0` (branch `privacy-first-local`).
Evidence comes from production builds driven in Chromium, the source, and the API logs.

## 1. Scope & evidence base

**Audited:**
- **Public website** (`NEXT_PUBLIC_LEDGERLINE_MODE=site`): landing `/`, `/install`, `/privacy`, a dashboard URL in site mode (`/overview`), and the 404 page.
- **Installed app** (`mode=app`, in-memory API):
  - the "Ledgerline is not running" screen and the welcome screen;
  - Import: bank-mail connect form, a wrong-password error, statement upload, the import report;
  - Overview, Lifestyle, Apps, People, Transactions and Add expense;
  - Settings, including the erase panel.

**Platform:** web — a marketing site plus a desktop-first web app with a phone layout.

**Audience:** mixed. The product is for everyday UPI users in India; the
landing copy and the welcome screen are written for them. Installing, though,
needs a terminal and Docker, so the first real users are technical. I graded
jargon against mainstream readers and the install guide against people
comfortable with a terminal.

**Stakes:** high. This is a person's spending history and mailbox access, so
trust signals, honesty about what is and isn't seen, and anything that touches
the network are graded harder than usual.

**Evidence:**
- **Live builds:** Chromium at 1440×900 and 390×844. Production `next build`
  standalone servers ran on ports 3600 (app) and 3601 (site), against an
  in-memory API on 4600. Screenshots, accessibility (ARIA) snapshots,
  keyboard focus walks and console errors are in
  [`ux-audit-ledgerline-local-2026-10-25-evidence/`](ux-audit-ledgerline-local-2026-10-25-evidence/).
  `notes.md` there holds the focus walks, overflow measurements and console log.
- **Source** at the commit above.
- **The API log** from the session (FORM-01).
- **Contrast:** computed with the skill's `contrast-check.py` from colours
  sampled in the browser through `getComputedStyle`.

**Not audited, and why:**
- **A real mailbox connection and scan.** I had no app password. One connect
  attempt with a made-up address did reach Gmail's IMAP server; it was refused,
  as expected.
- **Telegram linking.** No bot token was configured.
- **Statement match, the Daily limit page, and dark mode across the app.** These
  were outside the requested flows. Dark mode was captured only through the theme
  toggle on the site.
- **Screen-reader output** (no VoiceOver/NVDA pass). ARIA snapshots stand in
  for it, which shows names and roles but not the reading experience.
- **The terminal half of the install.** It was tested end to end separately
  (fresh clone, `./ledgerline start` through to `uninstall`), but it's not
  graded here as UI.

No conformance claim is made for accessibility; this is a sampled review.

## 2. Executive summary

The rebuild reads as one product with one promise: you install it on your own
computer, nothing is sent anywhere, and the screens keep saying so in plain
language. The landing page, the install guide and the welcome screen are clear
and honest about limits. "What it cannot see" names UPI Lite and RuPay-on-UPI
outright, which is rare and right for a money product. Three things matter most.

1. **Breaks the privacy promise:** the public website makes every visitor's
   browser call `http://localhost:…/api/me`. On the real site that request goes
   to the visitor's own machine, and current Chrome asks for permission to
   reach local network devices. A privacy-first product would show that prompt
   to someone who has only come to read about it.
2. **Crashes the app:** a wrong mail app password crashed the API process a
   minute later. Docker restarts it, but the user loses whatever scan or import
   was running, with no explanation.
3. **Misdirects first-time users:** a new user who picks "Import a statement"
   on the welcome screen lands on a page that leads with a mailbox form, while
   the upload they came for sits below it, labelled "Optional".

Beyond those three, keyboard focus is nearly invisible on the welcome screen.
Everything else is Medium or Low polish on a product that otherwise
communicates well.

## 3. Quick wins

| ID | Finding | Dimension | Severity | Effort |
|---|---|---|---|---|
| TRUST-01 | Public site calls the visitor's localhost on every page | Trust & privacy | High | S |
| A11Y-01 | Welcome-card focus ring at 1.2:1 | Accessibility | High | S |
| A11Y-02 | Default focus ring at 2.96:1, just under 3:1 | Accessibility | Medium | S |
| A11Y-03 | Count-up numbers ignore reduced motion | Accessibility | Medium | S |
| FORM-02 | Add-expense "Save" is disabled with no reason given | Forms | Medium | S |
| COPY-01 | "Telegram is not enabled on this server yet" doesn't tell the user how to turn it on | Content | Medium | S |
| COPY-02 | Sidebar still says "Limits & account" | Content | Low | S |

## 4. Findings

### 4.1 Error prevention & recovery

#### FORM-01 · A wrong mail app password crashes the API a minute later

| | |
|---|---|
| **Dimension** | Error prevention & recovery (D6) · Feedback (D5) |
| **Severity** | Blocker |
| **Confidence** | Observed (API log + code) |
| **Effort** | S |
| **Location** | Import → "Check and connect"; `backend/src/bankMail/mailbox.ts` `newClient`, `checkImapLogin` |

**Evidence.** The connect form correctly showed "The email address or app
password was not accepted. Check both and try again." Sixty seconds later the
API log read `FATAL: Uncaught exception — process will exit`,
`Error: Socket timeout` from `imapflow/lib/imap-flow.js:1449`. Every later
request was refused (`ECONNREFUSED`) until the API was started again. The IMAP
client left behind by the failed login had no `error` listener.

**Why it matters.** A wrong app password is the most common thing a person
does on this form. The first try is often wrong, because Google shows the
password once with spaces. Each wrong try silently restarts the whole
service a minute later. Any statement import or mail scan running at that
moment dies, and the page shows "Ledgerline is not running" with no hint
that the password attempt caused it.

**Recommendation.** Attach an `error` listener to every IMAP client and close
the client when `connect()` fails. **Fixed in this branch** after the audit,
with a regression test (`mailScan.test.ts`, "a socket error after a refused
login does not crash the API").

### 4.2 Trust, safety & privacy

#### TRUST-01 · The public website calls the visitor's localhost

| | |
|---|---|
| **Dimension** | Trust & privacy (D15) · Perceived performance (D14) |
| **Severity** | High |
| **Confidence** | Observed (rendered console) + Observed (code) |
| **Effort** | S |
| **Location** | Every site-mode page; `frontend/src/app/layout.tsx:72` mounts `ProfileProvider`, and `lib/profile.tsx` fetches `/api/me` on mount |

**Evidence.** Loading the site-mode build at `/` logged: *"Access to fetch at
'http://localhost:4600/api/me' from origin 'http://localhost:3601' has been
blocked by CORS policy"*. The provider wraps the whole app, including the
landing, install and privacy pages, and fetches whatever the mode.

**Why it matters.** On the real website the request targets
`http://localhost:4000` on the visitor's own computer. That's exactly what a
privacy-first product promises not to do. Browsers increasingly put this
behind a "wants to access devices on your local network" permission prompt,
so someone reading "nothing is sent anywhere" would get a local-network prompt
from that very page. Visitors who have Ledgerline running also get a cross-site
request into it; the CORS check stops it, but it shouldn't be sent at all.

**Recommendation.** Mount `ProfileProvider` (or have it skip its fetch) only
in app mode. In site mode no component should know the API's address.

### 4.3 First-run & core flows

#### FLOW-01 · "Import a statement" opens a page that leads with a mailbox form

| | |
|---|---|
| **Dimension** | Onboarding (D1) · Core flows (D3) · IA (D2) |
| **Severity** | High |
| **Confidence** | Observed (rendered) |
| **Effort** | S |
| **Location** | Welcome → "Import your transactions / Import a statement" → `/import?start=1`; `features/imports/ImportPage.tsx` (BankPoolingPanel first, the upload panel third) |

**Evidence.** The welcome card's call to action reads **"Import a
statement"**. The page it opens is titled *Bank mail and statements*. Its
first panel is **Bank mail**: a provider picker, app-password steps, email and
password fields, bank chips, "Scan bank mail" and "Clear imported data", about
800px tall. The upload comes after it, as **"Or upload a statement PDF —
Optional."** At 1440×900 the upload panel starts below the fold
(`app-import-empty-1440.png`).

**Why it matters.** The statement PDF is the fastest way to a correct month,
and it needs no password or account changes. A first-time user who chose it
is shown an app-password form instead, and the page calls their choice
optional. Some will assume a mailbox is required and stop. Others will hand
over mailbox access they never meant to give, which is the opposite of what a
privacy-first product should nudge.

**Recommendation.** When the page is opened with `?start=1`, or when there's
no data yet, put the statement upload first and the mail panel second. Retitle
it **"Upload a statement PDF"**, drop "Optional", and give the mail panel the
subtitle *"Optional: read new payments from your bank's alert emails."*

#### FORM-02 · Add expense: "Save" is disabled with no reason given

| | |
|---|---|
| **Dimension** | Forms (D4) |
| **Severity** | Medium |
| **Confidence** | Observed (rendered + code) |
| **Effort** | S |
| **Location** | Transactions → "Add expense"; `components/LedgerMoneyForms.tsx:91` |

**Evidence.** With the form empty, **Save** is greyed out (`disabled=true`,
`app-add-expense-empty-submit-1440.png`). Nothing marks "What" as the missing
field. The Amount placeholder **"500"** looks like an entered value.

**Why it matters.** Manual entry is how UPI Lite and cash get in, and the
product's own landing page sends people there. A dead button with no reason
makes users guess. A placeholder that looks like a value makes them think the
amount is already filled in.

**Recommendation.** Keep Save enabled. On submit, say which field is missing,
e.g. **"Add what it was for"**, and focus that field. Change the Amount
placeholder to **"₹ amount"**.

### 4.4 Accessibility

#### A11Y-01 · Welcome cards have a nearly invisible focus ring

| | |
|---|---|
| **Dimension** | Accessibility (D12) |
| **Severity** | High |
| **Confidence** | Observed (computed) |
| **Effort** | S |
| **Location** | Welcome screen; `app/styles/views.css:177` `.welcome-option:focus-visible` |

**Evidence.** The focus walk lands on all three welcome options, each with
`outline 2px rgba(228,213,188,0.6)`. Composited, that's `#EBE3D3` on `#F5F8F6`:
**1.19:1**, against the 3:1 a focus indicator needs.

**Why it matters.** This is the first screen of the app. Keyboard users can't
tell which of the three first steps is selected before pressing Enter.

**Recommendation.** Use the default ring (A11Y-02, once fixed) on
`.welcome-option`, or a 2px `var(--foreground)` outline.

#### A11Y-02 · The default focus ring measures 2.96:1

| | |
|---|---|
| **Dimension** | Accessibility (D12) |
| **Severity** | Medium |
| **Confidence** | Observed (computed) |
| **Effort** | S |
| **Location** | `app/styles/base.css:74` `:focus-visible` |

**Evidence.** The global ring is `color-mix(foreground 45%, transparent)`.
On `#F5F8F6` it composites to `#8D928F`, which measures **2.96:1**. It's used by
the sidebar, site nav and buttons (focus walks in `notes.md`).

**Why it matters.** It's just under the line, everywhere. Users with low
vision or a dim screen lose track of focus across the whole app.

**Recommendation.** 60% mix (about 4:1) or the full foreground colour.

#### A11Y-03 · Count-up numbers ignore "reduce motion" and briefly show wrong totals

| | |
|---|---|
| **Dimension** | Accessibility (D12) · Data display (D11) |
| **Severity** | Medium |
| **Confidence** | Observed (rendered + code) |
| **Effort** | S |
| **Location** | Overview cards; `components/LiveCounter.tsx` (1200ms tween, no reduced-motion check) |

**Evidence.** A phone screenshot taken about 700ms after load shows **Total
spent ₹31,450** and **Avg/day ₹963**. The summary line on the same screen says
₹35,303 and ₹1,081 (`app-overview-390-firstscreen.png`). The DOM already holds
₹35,303, so this is animation, not arithmetic. `LiveCounter` has no
`prefers-reduced-motion` branch.

**Why it matters.** People who ask their system to reduce motion still get
the rolling numbers. In a money product, a total that is visibly wrong for a
second, next to a line that disagrees with it, is a small blow to trust.

**Recommendation.** Render the final value immediately under
`prefers-reduced-motion: reduce`. *Taste call, not graded:* consider dropping
the count-up on totals altogether.

#### A11Y-04 · Daily chart bars take focus but show no ring

| | |
|---|---|
| **Dimension** | Accessibility (D12) |
| **Severity** | Medium |
| **Confidence** | Observed (computed) |
| **Effort** | S |
| **Location** | Overview daily chart; `components/charts/DetailBarChart.tsx:165` (`tabIndex={0}`) |

**Evidence.** Focus-walk steps 19–25 on Overview land on
`div "Thu, 1 Oct: ₹0, Typical"` and the following days, all with **no
visible outline or shadow**. The month input (step 12) has no ring either.

**Why it matters.** Each bar is a tab stop: a month is 31 extra stops, and the
user can't see which one they're on. The bars' labels ("Fri, 2 Oct: ₹389,
Typical, ₹692 under the daily average") are very good, which makes the
invisible focus the only thing in the way.

**Recommendation.** Give the bar element a `:focus-visible` outline. Also
consider making the chart a single tab stop, with arrow keys moving between
days.

### 4.5 Data display

#### DATA-01 · The daily chart's square-root scale isn't marked

| | |
|---|---|
| **Dimension** | Data display (D11) |
| **Severity** | Medium |
| **Confidence** | Observed (rendered + code) |
| **Effort** | S |
| **Location** | Overview → Daily spend; `DetailBarChart.tsx:61` (`scale === "sqrt"`) |

**Evidence.** The y-axis gridlines read **₹0, ₹360, ₹1.4k, ₹3.2k**, evenly
spaced (`app-overview-1440.png`). That's a square-root scale, and nothing on
the chart says so.

**Why it matters.** People compare bar heights. A ₹1,400 day looks two-thirds
as tall as a ₹3,200 day, when it's less than half the spend. That flattens
exactly the spikes the chart exists to show. The choice is reasonable, since
it keeps small days visible, but it should be stated.

**Recommendation.** Add *"Heights use a square-root scale so small days stay
visible"* under the chart, or offer a linear/sqrt toggle.

#### DATA-02 · Chart legend: mixed capitals, five categories in the same grey

| | |
|---|---|
| **Dimension** | Data display (D11) · Visual hierarchy (D9) |
| **Severity** | Low |
| **Confidence** | Observed (rendered) |
| **Effort** | S |
| **Location** | Overview daily-chart legend |

**Evidence.** The legend reads *Food, grocery, Travel, Shopping, Family,
pharmacy, Outing, salon, dinner, petrol*. The lower-case entries share one
grey swatch.

**Why it matters.** The bars can't be told apart by category for half the
legend. The mixed capitals look like raw data leaking through.

**Recommendation.** Title-case every entry. Group the uncoloured subcategories
under their parent colour, or as "Other".

#### DATA-03 · Import report labels and numbers sit about 1000px apart

| | |
|---|---|
| **Dimension** | Data display (D11) |
| **Severity** | Low |
| **Confidence** | Observed (rendered) |
| **Effort** | S |
| **Location** | Import → statement report card (`ImportReportCard`) |

**Evidence.** "Lines read" and "New payments added" sit at the left edge of
the card; their values (3, 3) sit at the right edge, about 1000px away at
1440 wide (`app-import-report-1440.png`).

**Why it matters.** The eye can't pair a label with its number across that
gap. This card is the moment the user checks the import worked.

**Recommendation.** Cap the card at around 480px wide, or put each value next
to its label.

### 4.6 Content & microcopy

#### COPY-01 · Telegram says "not enabled on this server", with an active "Link" button

| | |
|---|---|
| **Dimension** | Content (D8) · Feedback (D5) |
| **Severity** | Medium |
| **Confidence** | Observed (rendered + code) |
| **Effort** | S |
| **Location** | Settings → Telegram; `lib/telegram.ts:31` |

**Evidence.** The panel reads **"Telegram is not enabled on this server
yet."**, next to "Not linked" and an enabled **Link** button.

**Why it matters.** There's no server, and nobody to wait for "yet". The user
is the operator now, and the copy doesn't say what to do.

**Recommendation.** *"Telegram is off. To use it, create a bot with
@BotFather, add `TELEGRAM_BOT_TOKEN` to the `.env` file in your Ledgerline
folder, then run `./ledgerline start`. It's the one feature that sends data
to Telegram."* Hide or disable **Link** while it's off.

#### COPY-02 · The sidebar still describes Settings as "Limits & account"

| | |
|---|---|
| **Dimension** | Content (D8) |
| **Severity** | Low |
| **Confidence** | Observed (rendered + code) |
| **Effort** | S |
| **Location** | Sidebar; `lib/dashboardViews.ts:93` |

**Evidence.** The sidebar subtitle reads **"Limits & account"**. The Settings
page itself is titled *Limits and your data*.

**Why it matters.** "Account" contradicts the "no account" promise the user
just read on the welcome screen.

**Recommendation.** **"Limits & your data"**.

#### COPY-03 · The "not running" screen says the same thing twice

| | |
|---|---|
| **Dimension** | Content (D8) |
| **Severity** | Low |
| **Confidence** | Observed (rendered) |
| **Effort** | S |
| **Location** | `components/LocalGate.tsx` |

**Evidence.** Under "Ledgerline is not running", the page gives the
instruction (*./ledgerline start*, then *./ledgerline status* and *logs*) and
then repeats the error *"Could not reach the Ledgerline API on this
computer. Make sure Ledgerline is running (./ledgerline status), then try
again."* The brand line "Ledgerline" sits directly above the heading
"Ledgerline is not running".

**Why it matters.** It's a small thing, but this screen is shown at a
stressful moment, and the repeat makes it read like two separate problems.

**Recommendation.** Show the raw error only when it's something other than
the network message. Drop the brand line, or replace it with the logo.

### 4.7 Dimensions with no findings

- **Responsive.** No sideways scroll at 390px on any page measured (site
  `/`, `/install`, `/privacy`; app Overview, Transactions, Import, Settings —
  all 0px). The phone app has a bottom tab bar, and the site nav wraps cleanly.
- **Dark patterns.** None. Erasing everything needs a disclosure, then a
  button, then a native confirm. Sample data is labelled on every screen, with
  a one-click remove.
- **Install guide (as copy).** The commands match the CLI. There are
  troubleshooting entries for each failure the CLI reports, and every command
  block has a copy button with an accessible name ("Copy: Check Docker").

## 5. Prioritized backlog

| # | ID | What to do | Severity | Effort | Why it's here |
|---|---|---|---|---|---|
| 1 | FORM-01 | Error listener on IMAP clients (done) | Blocker | S | A wrong password restarted the service |
| 2 | TRUST-01 | No API calls in site mode | High | S | The public site reaches into visitors' machines |
| 3 | FLOW-01 | Statement upload first on first run | High | S | The first-run path asks for mailbox access first |
| 4 | A11Y-01 | Visible focus on welcome cards | High | S | The first screen can't be used by keyboard |
| 5 | A11Y-02 | Default ring to ≥3:1 | Medium | S | Every screen, every focus |
| 6 | FORM-02 | Enabled Save with a named missing field | Medium | S | Manual entry closes the UPI Lite/cash gap |
| 7 | A11Y-03 | Respect reduced motion in LiveCounter | Medium | S | Totals visibly disagree for a second |
| 8 | A11Y-04 | Focus ring on chart bars | Medium | S | 31 invisible tab stops on Overview |
| 9 | COPY-01 | Telegram copy for local installs | Medium | S | Points the operator at the right setting |
| 10 | DATA-01 | Label the sqrt scale | Medium | S | Bar heights understate spikes |
| 11 | COPY-02 | "Limits & your data" | Low | S | |
| 12 | COPY-03 | De-duplicate the not-running screen | Low | S | |
| 13 | DATA-02 | Legend case and grouping | Low | S | |
| 14 | DATA-03 | Tighten the import report card | Low | S | |

## 6. What's working, and what I left alone

**What's working.**
- **"What it cannot see" on the landing page.** It names UPI Lite, RuPay
  credit cards on UPI, cash and other banks, and says what to do about each.
  That honesty is the product's best trust signal.
- **The connect form.** It explains each provider's app password in three
  numbered steps with direct links. It states the privacy terms right next to
  the password field, and turned an IMAP refusal into a sentence a person can
  act on.
- **Chart-bar accessible names.** "Sat, 3 Oct: ₹1,240, Typical, 1.1× the daily
  average" is better than most finance apps manage. Only the focus ring is
  missing (A11Y-04).

**What I left alone, and why.**
- **Mono figures for money**, the warm accent colour on totals, and the
  serif-less display face. These read as decisions. The bold amount colour
  measures 3.56:1 but is large text (21.6px bold), so it passes.
- **The sidebar's "Needs import" greying on day one.** It tells the user why
  views are empty, which is a deliberate trade, not a defect.
- **The install tabs opening on the visitor's OS.** Chromium reported Windows,
  so the guide opened on WSL. That's working as designed.

## 7. Open questions

- **Does Chrome on the public site actually show the local-network prompt
  today?** TRUST-01 stands either way (the request shouldn't exist), but it
  decides whether this is a launch blocker for the website.
- **Hypothesis (unverified): first-time users read "Import" as "connect my
  email".** A five-person test from the welcome screen would settle FLOW-01's
  real cost.
- **How many people get the Gmail app password wrong on the first try?** With
  the crash fixed this costs one retry, but the form could catch the most common
  mistakes before they're submitted.

## Appendix — evidence log

```
SEEN (production builds, Chromium, 25 Oct 2026)
  site  /, /install, /privacy           1440×900 + 390×844, full page, ARIA, focus walk (/)
  site  /overview (site notice), /nope  1440×900
  app   / with API blocked              "Ledgerline is not running"
  app   / welcome, /import (empty, mail form, mail error, file chosen, report)
  app   /overview /lifestyle /apps /people /transactions /settings   1440×900, sample data
  app   /overview /transactions /import /settings                    390×844
  app   Add expense (open, empty submit), Settings erase panel open
  api   log showing the IMAP socket-timeout crash
NOT SEEN
  real mailbox scan, Telegram linking, statement match, daily-limit page,
  dark mode inside the app, screen-reader output
```

## Appendix — status after fixes (same day, separate change)

The report above is the audit as found at `56f85d0`. The fixes below were made
afterwards, then re-checked in fresh production builds with the same method.
Before/after evidence is the `after-*.png` files in the evidence folder.

| ID | Status | How it was verified |
|---|---|---|
| FORM-01 | Fixed | Error listener on every IMAP client; failed clients closed. Regression test `mailScan.test.ts` |
| TRUST-01 | Fixed | 0 requests to the API from `/`, `/install` and `/privacy` in the site build, with 0 console errors. Vitest: `siteMode.test.tsx` fails without the fix |
| FLOW-01 | Fixed | Import now reads *Statements and bank mail → Upload a statement PDF → Bank alert emails (optional)* |
| A11Y-01, A11Y-02 | Fixed | Focus ring now `foreground 70%`: 6.62:1 on the page background, 6.85:1 on white. Input fields and chart bars get the same ring |
| A11Y-03 | Fixed | With reduced motion, Overview shows ₹35,303 at once (`after-overview-390-reduced-motion.png`) |
| A11Y-04 | Fixed | Chart bars show a solid ring when focused. The single-tab-stop chart is not done |
| FORM-02 | Fixed | Save stays enabled; an empty submit shows "Add what it was for, for example Chai or Auto." and focuses the field. Vitest: `ManualExpenseForm.test.tsx` |
| DATA-01 | Fixed | Note under the chart: "Bar heights use a square-root scale, so small days stay visible next to big ones." |
| DATA-02 | Partly fixed | The legend is title-cased. Subcategories still share one grey; grouping them is open |
| DATA-03 | Fixed | The report list is capped at 28rem |
| COPY-01 | Fixed | Telegram explains `TELEGRAM_BOT_TOKEN` and `./ledgerline start`; "Link" is hidden while the bot is off |
| COPY-02 | Fixed | The sidebar reads "Limits & your data" |
| COPY-03 | Fixed | The brand line was removed, and the network error isn't repeated under the steps |
