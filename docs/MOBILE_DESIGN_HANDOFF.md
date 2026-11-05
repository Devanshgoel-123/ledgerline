# Handoff spec: Ledgerline iOS v1.0 redesign

Source of truth for `mobile/src`. Inputs: `docs/MOBILE_LAUNCH_STRATEGY.md` (why) and `ux-audit-ledgerline-ios-2026-11-05.md` (what was wrong). Tokens live in `mobile/src/ui/theme.ts`. Screens use token names, never hex values.

## Overview

A mainstream Indian UPI user does two things on the phone: **captures a payment in about 2 seconds**, several times a day, and **uploads a bank statement** once a month. Every design decision below serves one of those, or helps them see where the money went at a glance.

Visual direction: **"confident and calm."** One vivid indigo-violet brand colour for actions and the hero, a warm orange for spend, green for money in, and a distinct hue per category. Surfaces are neutral and cool so the colour means something. It's professional because the colour is rationed, not because it's grey.

## Design tokens

### Colour: light / dark

All text pairs below were checked with `contrast-check.py`. Every one is 4.5:1 or better on `bg` and `surface`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg` | `#F6F6FB` | `#0B0B14` | App background |
| `bgMuted` | `#EEEEF6` | `#1C1C29` | Segmented track, muted pills, keypad keys |
| `surface` | `#FFFFFF` | `#15151F` | Cards, sheets |
| `foreground` | `#12121F` (17.2:1) | `#F2F2F8` (17.6:1) | Primary text |
| `muted` | `#5B5C70` (6.1:1) | `#A3A4B8` (8.0:1) | Secondary text |
| `muted2` | `#6E6F84` (4.6:1) | `#8B8CA3` (5.5:1) | Placeholders, tertiary meta |
| `primary` | `#4F46E5` (white on it 6.3:1) | `#8B85FF` (ink on it 6.4:1) | Primary buttons, selected chips, active tab, links |
| `primaryForeground` | `#FFFFFF` | `#0B0B14` | Text on primary |
| `primarySoft` | `rgba(79,70,229,0.10)` | `rgba(139,133,255,0.16)` | Selected tint, icon wells |
| `accent` (spend) | `#C2410C` (5.2:1) | `#FF8A4C` (8.4:1) | Spend amounts and spend highlights. Was `copper` |
| `accentSoft` | `rgba(234,88,12,0.10)` | `rgba(255,138,76,0.14)` | Spend pill backgrounds |
| `credit` / `success` | `#047857` (5.5:1) | `#34D399` (10.2:1) | Money in, success |
| `danger` / `debit` | `#B91C1C` | `#F87171` | Errors, destructive, over limit |
| `heroFrom` → `heroTo` | `#4F46E5` → `#7C3AED` | `#3730A3` → `#6D28D9` | Overview hero gradient (white text 5.7:1 or better) |
| `border` / `borderStrong` | `rgba(18,18,31,0.08)` / `0.14` | `rgba(255,255,255,0.08)` / `0.14` | Hairlines, inputs |

### Colour: categories

There are twelve top-level categories, each with its own hue. Light fills carry white initials at **4.5:1 or better**; dark fills carry `#0B0B14` initials at **7:1 or better**. Sub-categories take a shade of their parent's hue. Grocery and Salary get their own greens because they're so frequent.

| Root | Light | Dark |
|---|---|---|
| food | `#C2410C` | `#FB923C` |
| shopping | `#DB2777` | `#F472B6` |
| travel | `#0369A1` | `#38BDF8` |
| healthcare | `#DC2626` | `#F87171` |
| family | `#C026D3` | `#E879F9` |
| outing | `#7C3AED` | `#A78BFA` |
| investments | `#047857` | `#34D399` |
| vices | `#B45309` | `#FBBF24` |
| banks | `#475569` | `#94A3B8` |
| household | `#2563EB` | `#60A5FA` |
| personal | `#0F766E` | `#2DD4BF` |
| other | `#6B7280` | `#9CA3AF` |

### Type

| Token | Font | Size / line | Usage |
|---|---|---|---|
| `display-hero` | Bricolage Grotesque 700 | 44/50, tracking −1 | Hero amount, Quick add amount (56/62) |
| `display-title` | Bricolage Grotesque 600 | 28/33 | Page titles |
| `display-card` | Bricolage Grotesque 600 | 18/23 | Card titles |
| `body` | Inter 400 | 15/21 | Body |
| `small` | Inter 400 | 13/18 | Meta |
| `strong` | Inter 600 | 15/20 | Row titles, button labels |
| `amount` | Inter 600, **tabular-nums** | 15–22 | All money in lists and stats (replaces JetBrains Mono; mono read as code to consumers) |

### Spacing and radius

`space` 4 / 8 / 12 / 16 / 24 / 32 (unchanged). Radius: `sm` 10, `md` 14, `lg` 20 (was 18), `xl` 28 (sheets, hero), `pill` 999.

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
