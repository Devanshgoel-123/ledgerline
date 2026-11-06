# Handoff spec: Ledgerline iOS v1.0 redesign

Source of truth for `mobile/src`. Inputs: `docs/MOBILE_LAUNCH_STRATEGY.md` (why) and `ux-audit-ledgerline-ios-2026-11-05.md` (what was wrong). Tokens live in `mobile/src/ui/theme.ts`. Screens use token names, never hex values.

## Overview

A mainstream Indian UPI user does two things on the phone: **captures a payment in about 2 seconds**, several times a day, and **uploads a bank statement** once a month. Every design decision below serves one of those, or helps them see where the money went at a glance.

Visual direction: **"calm ledger"** (revised 6 Nov 2026). Deep navy and steel blue for brand and actions, ink for amounts, green only for money in, and a muted hue per category. Surfaces are cool and neutral, so colour means something. It feels professional because colour is rationed, not because everything is grey.

## Design tokens

### Principles ("calm ledger", 6 Nov 2026)

The first theme was vivid indigo and orange. For a money app that read as loud, and orange spend amounts made ordinary spending look like a warning. The redesign works from five rules:

1. **Money is the content.** Amounts are set in ink, large and tabular. Colour is never decoration.
2. **Colour means something.** Brand blue is for things you can tap. Green is only for money in. Red is only for a problem: over a limit, an error, a delete. Spending is not a problem, so it isn't red or orange.
3. **Calm.** Cool, low-saturation neutrals. There is one gradient in the app (the Overview summary), navy to ocean, with the two stops close in value so it reads as depth.
4. **Quiet depth.** Hairline borders and a faint shadow (2 px offset, 10 px blur).
5. **One primary action per screen.** Secondary actions, such as Review on a notice, use the outlined button.

### Colour: light / dark

Every text pair is 4.5:1 or better on `bg` and `surface`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg` | `#F3F5F8` | `#0B1219` | App background |
| `bgMuted` | `#E8ECF1` | `#17212C` | Segmented track, muted pills |
| `surface` | `#FFFFFF` | `#111A23` | Cards, sheets, keypad keys |
| `foreground` | `#0F1B2A` (15.9:1) | `#E6EDF3` (15.9:1) | Primary text, **all spend amounts** |
| `muted` | `#526070` (6.4:1) | `#9AA8B6` (7.2:1) | Secondary text |
| `muted2` | `#677485` (4.8:1) | `#8494A4` (5.7:1) | Placeholders, tertiary meta |
| `primary` | `#1D5C96` (white on it 7.0:1) | `#82B4E3` (ink on it 8.6:1) | Primary buttons, selected chips, active tab, links |
| `primaryForeground` | `#FFFFFF` | `#0B1219` | Text on primary |
| `primarySoft` | `rgba(29,92,150,0.09)` | `rgba(130,180,227,0.14)` | Selected tint, icon wells, info notices |
| `onPrimarySoft` | `rgba(255,255,255,0.16)` | `rgba(11,18,25,0.12)` | Icon well on a primary fill |
| `accent` | `#A24F2B` (5.7:1) | `#E39A72` (7.6:1) | Rare highlights only; no longer used for spend amounts |
| `credit` / `success` | `#1B7A4E` (5.3:1) | `#5DC795` (8.4:1) | Money in, success |
| `danger` / `debit` | `#B42318` (6.6:1) | `#F08A7E` (7.2:1) | Errors, destructive, over limit |
| `heroFrom` → `heroTo` | `#102A43` → `#1D5A73` | `#0F2236` → `#1A4A63` | Overview summary gradient. White text 7.6:1 or better; `onHeroMuted` `#C6D6E3` 5.1:1 or better |
| `heroChip` / `heroTrack` / `heroWarn` | white 14% / 18% / `#F6B8AB` | white 12% / 16% / `#F6B8AB` | Stat tiles, limit track and over-limit fill inside the summary |
| `border` / `borderStrong` | `rgba(15,27,42,0.08)` / `0.14` | `rgba(230,237,243,0.08)` / `0.14` | Hairlines, inputs |
| Chart bars | calm `#C3D2E1`, watch `#DCB57A`, hot `#DC8A7D`, peak = primary | `#2C4054`, `#C79B57`, `#D47A6D`, primary | Daily spend chart |

### Colour: categories

There are twelve top-level categories, each with a muted hue. They are distinct enough to tell apart on a chart and quiet enough to sit together. Light fills carry white initials at **5:1 or better**; dark fills carry `#0B1219` initials at **8.5:1 or better**. Sub-categories take a shade of their parent's hue. The widget uses the dark set, because its background is navy.

| Root | Light | Dark |
|---|---|---|
| food | `#A9552F` | `#E3A17D` |
| shopping | `#A3456B` | `#E09CBB` |
| travel | `#2E6590` | `#8FB8DC` |
| healthcare | `#AB3F3B` | `#EA9C95` |
| family | `#874A8C` | `#D1A4D5` |
| outing | `#5D4F9C` | `#B4A9E4` |
| investments | `#22775A` | `#82CDA9` |
| vices | `#8C5D18` | `#E0BE7D` |
| banks | `#55657A` | `#A9B6C5` |
| household | `#3A61A3` | `#95B4E4` |
| personal | `#2A716C` | `#84C9C2` |
| other | `#646F7D` | `#A8B1BC` |

### Type

One typeface, Inter. Its heavier weights do the display work: a characterful display face (Bricolage Grotesque) read as playful.

| Token | Font | Size / line | Usage |
|---|---|---|---|
| `display-hero` | Inter 700, tabular | 42/50, tracking −1.2 | Summary amount; Quick add amount (56/62) |
| `display-title` | Inter 700 | 28–30/34–36, tracking −0.7 | Page titles |
| `display-card` | Inter 600 | 17/22, tracking −0.2 | Card titles |
| `body` | Inter 400 | 15/21 | Body |
| `small` | Inter 400 | 13/18 | Meta |
| `strong` | Inter 600 | 15/20 | Row titles, button labels |
| `amount` | Inter 600, **tabular-nums** | 15–22 | All money in lists and stats |

### Spacing and radius

`space` 4 / 8 / 12 / 16 / 24 / 32. Radius: `sm` 10, `md` 12, `lg` 16 (cards), `xl` 22 (sheets, summary), `pill` 999. These are tighter than v1.0, which reads more precise.

### App icon

The same L and ledger line, now a white L with a sky line (`#8FC7EA`) on the navy-to-ocean gradient. The source is a small SVG. The PNGs in `mobile/assets/images` were rendered from it with headless Chrome.

## Screens and components

### 1. Overview (`(tabs)/index.tsx`)

Top to bottom, on a 393pt-wide screen with a 16pt gutter:

1. **Header**: eyebrow with greeting ("Good evening") and the month title as a tappable **MonthSwitcher** (‹ November 2026 ›). There's no separate title, so the month appears once.
2. **Hero card**: `heroFrom→heroTo` gradient, radius `xl`, padding 20. Contains "Spent this month" (white 80%), the amount (`display-hero`, white), then a single line: "₹X today · ₹Y/day average". If a daily limit is set, a progress bar of today vs the limit (white 25% track, white fill, `danger`-tinted fill once over). The caveat moves to an ⓘ that shows the "includes rent, less refunds…" text in an Alert.
3. **Primary actions row**: two equal tiles, 64pt or taller, radius `lg`.
   - **Add expense**: `primary` fill, `plus` icon, opens `/quick`.
   - **Upload statement**: `surface` with a `primary` icon well, opens `/statement`. Sub-label: "Find what you missed".
4. **Statement nudge** (conditional): if there has been no check in the last 25 days, or none ever and there are 5 or more entries, show a `primarySoft` notice: "Upload October's statement to catch anything you missed." with an "Upload" button.
5. **Stats pair**: "Money in" (credit) and "Daily limit" (or "Set a limit").
6. **Daily spend chart**: unchanged component, recoloured with tokens.
7. **Top categories**: the top 4 categories with colour bars. Tap goes to Lifestyle.
8. **Recent**: the last 5 entries, then "See all".

### 2. Quick add sheet (`app/quick.tsx`), new

A form sheet (`presentation: "formSheet"`, detents `[0.85]`, grabber visible). Deep link: `ledgerline://quick?category=<slug>`.

| Region | Spec |
|---|---|
| Header | "Add expense" (`display-card`). On the right, a "More details" text button opens `/add` with the amount, category and note carried over as params. Close ✕ on the left, 44×44 |
| Kind | Small segmented control: Spent / Received. Default Spent |
| Amount | "₹" in muted, 32pt, plus the amount in `display-hero` 56pt, centred. Spent shows in `foreground` and turns `accent` once non-zero; Received in `credit`. Empty shows "0" in `muted2` |
| Category row | Horizontal scroll of chips, 44pt tall, each with a 10pt colour dot. Order: the `?category=` param first, then the 8 categories used most in the last 60 days, then the rest of the roots. Selected chip: filled with the category colour, white or ink text. "More" at the end opens the full picker inline |
| Note | Single-line field, placeholder "What for? (optional)". Uses the system keyboard; the keypad hides while it's focused |
| Keypad | 3×4 grid: 1–9, ".", 0, ⌫. Keys 56pt tall, `bgMuted`, radius `md`, Inter 600 24pt. ⌫ long-press clears. At most 2 decimals and 8 integer digits |
| Save | Full-width `primary` button, 56pt, label "Save ₹60 · Food" (or "Enter an amount" while disabled). Pinned to the bottom, above the safe area |

**Behaviour:** Save writes with `description = note || category label` and `method = upi`. It closes the sheet, refreshes data and updates the widget snapshot. No confirmation screen: the new row appears at the top of Recent. Validation: the amount must be greater than 0 (the button stays disabled until then), and a category is required (preselected to the first chip).

### 3. Full form (`/add`, `EntryForm`)

Same fields as before. Changes:
- "What for" is optional; if empty, it falls back to the category label (audit FORM-01).
- Save moves to a sticky footer.
- It accepts `amount`, `category` and `note` params from Quick add.

### 4. Check a statement (`app/statement.tsx`)

- **Start:** the hero icon in a 56pt `primarySoft` circle, title "Upload your bank statement", the three reassurance bullets (unchanged copy), and the primary button "Choose statement PDF". Supported banks appear as pills (HDFC, ICICI).
- **Reading:** a dedicated card with an ActivityIndicator, "Reading {file name}", "On this phone. Nothing is uploaded." and the lock icon. No disabled button.
- **Review / done:** unchanged structure. The checkbox fill uses `primary`, missing count pills use `accent`, and the success state gets a `credit` check circle.

### 5. Lists, chips, tabs

- `EntryRow`: a 40pt circle in the category colour with the initial, Inter 600 15pt title, `amount` token right-aligned. Credits are `credit` with "+".
- `Chip` selected state: `primary` fill (or the category colour in Quick add).
- Tab bar: active tint `primary`, indicator `primarySoft`.

### 6. Home-screen widget (`src/widget/QuickAddWidget.tsx`)

Built with `expo-widgets` (`createWidget('QuickAdd', …)`), families `systemSmall` and `systemMedium`.

| Family | Layout | Tap |
|---|---|---|
| Small | Gradient background (`heroFrom→heroTo`). "Today" label (white 80%, 12pt), today's spend (28pt bold white), then "₹X this month" (12pt). At the bottom, a white capsule "+ Add" | Whole widget: `widgetURL("ledgerline://quick")` |
| Medium | Left half as Small. Right half: a 2×2 grid of category `Link`s (the 4 most-used categories) with a colour dot and label, each going to `ledgerline://quick?category=<slug>` | Each link opens Quick add with that category preselected |

Props: `{ today: string, month: string, updated: string, shortcuts: {slug, label, color}[] }`. The app calls `updateSnapshot` after every write and on launch. The widget runs no logic; it only displays the strings it receives. Privacy: amounts show on the home screen. That's acceptable for v1 and standard for this category. A later version should add a "hide amounts on widget" setting.

## States and interactions

| Element | State | Behaviour |
|---|---|---|
| Primary button | Pressed | Opacity 0.85, scale 0.98 (no colour change) |
| Primary button | Disabled | Opacity 0.45, not focusable |
| Primary button | Busy | Spinner in place of the icon, label kept |
| Keypad key | Pressed | `primarySoft` background |
| Quick add Save | Amount empty | Disabled, label "Enter an amount" |
| Quick add | Save fails | Inline `danger` text above the Save button: "Couldn't save. Try again." |
| Statement | Wrong password | Field error (unchanged) |
| Widget | No data yet | "₹0 today", "Tap to add your first expense" |

## Edge cases

- **Large amounts:** at 7 or more digits the Quick add amount shrinks to 44pt, and to 36pt at 9 or more. The hero uses `adjustsFontSizeToFit`.
- **Long merchant names:** one line with tail ellipsis in rows. The widget truncates labels at 12 characters.
- **No entries:** the Overview hero shows ₹0, and Recent shows the "Start with today" empty state with both primary actions.
- **Expo Go / web:** widget calls are no-ops (the module is loaded in a try/catch).

## Motion

| Element | Trigger | Animation | Duration |
|---|---|---|---|
| Quick add sheet | Open | Native form-sheet slide | System |
| Amount | Digit typed | None (instant, to stay fast) | n/a |
| Buttons | Press | Scale 0.98 | 100ms |
| Respect Reduce Motion | Always | No custom animation beyond the native sheet | n/a |

## Accessibility

- Focus order in Quick add: Close, Kind, Amount (announced as "Amount, ₹60"), Categories, Note, Keypad, Save.
- Keypad keys have the labels "1"…"9", "decimal point" and "delete" (hint: "Long press to clear").
- Category chips are `radio`, inside a `radiogroup` labelled "Category".
- The hero amount is announced as one label: "Spent this month, ₹35,533".
- Targets are 44pt or larger everywhere. Text contrast is 4.5:1 or better in both themes (see the token table).
