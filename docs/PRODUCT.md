# Ledgerline: the product, feature by feature

Ledgerline is a privacy-first spending tracker for UPI users in India. It runs
on the user's own computer and stores nothing anywhere else. This page lists
every feature, what changed in the move to local-only (October 2026), and what
comes next.

## Who it's for

People who pay mostly by UPI, want to know where the month went, and don't want
a company holding their bank data. The first users are technical enough to
install Docker. Getting it down to one command is what makes them the right
first audience.

## The promise, and its limits

- **It promises:** a correct month for the accounts you import, worked out on
  your machine, with nothing sent anywhere you didn't turn on.
- **It does not promise:** to see everything. UPI Lite, cash and other wallets
  never reach a statement or a bank alert. The app says so and makes manual
  entry quick.

## Features

| Area | Feature | Status | Notes |
|---|---|---|---|
| Install | `./ledgerline` CLI: start, stop, status, logs, update, backup, restore, uninstall | **New** | Bash and Docker. Creates secrets on first run; nothing to edit |
| Install | One-line installer (`install.sh`) | **New** | Clones (or downloads the archive) into `~/ledgerline`, then starts it |
| Install | Public website with install guide | **New** | The same frontend with `NEXT_PUBLIC_LEDGERLINE_MODE=site`; never calls an API |
| Privacy | No accounts: one local profile | **Changed** | Replaces sign-up, JWT, Google/Apple sign-in, password reset, SMTP, allowlists, invites, admin |
| Privacy | Localhost-only API (Host pinning + client header + CORS) | **New** | Stands in for sign-in as the boundary; see SECURITY.md |
| Privacy | Erase everything | **Changed** | Was "delete account"; now wipes local data and starts fresh |
| Import | HDFC statement PDF | Kept | Balance-checked lines; repeats add nothing; the password is never stored |
| Import | ICICI statement PDF | Kept | Needs more real statements tested |
| Import | Bank alert mail | **Changed** | IMAP with an app password replaces Gmail OAuth, which needed each user to create a Google Cloud project, or a paid CASA audit for a hosted version |
| Import | Locked statement PDFs found in mail | Kept | Listed until you type the password once |
| Import | Statement ↔ alert matching | Kept | Reconciles the two sources so nothing is counted twice |
| Import | Sample data | Kept | Clearly labelled, removable |
| Ledger | Manual expenses | Kept | Where UPI Lite and cash go |
| Ledger | Categories, rules, merchant catalog | Kept | The India retail catalog is shared reference data |
| Ledger | Bill splitting | Kept | Only your share counts as spending |
| Ledger | CSV export | Kept | Formula cells neutralised |
| Views | Overview, Lifestyle, Apps, People, Transactions, Daily limit | Kept | |
| Alerts | Telegram bot | Kept, optional | The one feature that sends data off the machine; off unless a bot token is set |
| Removed | iOS app | **Removed** | Needed a hosted API |
| Removed | Splitwise email parser | **Removed** | Was never wired in |
| Removed | Gmail Pub/Sub push, separate pooling worker | **Removed** | Scans run inside the API every 6 hours or on demand |
| Removed | Stale Playwright audit scripts, logo scrapers, the production compose overlay, video scripts | **Removed** | |

## Next, in order

1. **CSV/XLS statement import.** Every bank exports these, and one column-mapping
   screen covers SBI, Axis, Kotak and the rest far faster than a PDF parser per
   bank.
2. **"Unaccounted" line on Overview.** Show the gap between the statement
   closing balance and the payments Ledgerline knows about, so missing money is
   visible instead of silently absent.
3. **Quick add in two seconds.** A keyboard shortcut on desktop and a single
   field ("chai 20"). This is where most of the manual-entry gap closes.
4. **A weekly summary you don't have to open the app for.** Shown on the next
   visit by default; through the Telegram bot for people who turned it on.
5. **More alert templates** (SBI, Axis, Kotak), tested against real anonymised
   mail.
6. **Native desktop package** (Tauri with an embedded database) once the Docker
   version has real users. It removes the Docker requirement, the biggest
   install hurdle left.

## How we'll know it works

- **Install:** share of people who reach the welcome screen after running the
  installer. Measure this in user interviews, not with telemetry.
- **Activation:** a correct month (totals match the bank's closing balance)
  within 15 minutes of installing.
- **Retention:** still opening it in week 4.
