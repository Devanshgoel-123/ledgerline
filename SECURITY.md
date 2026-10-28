# Security

Ledgerline runs on one person's computer and holds their spending history. Never put secrets or financial records in issues, pull requests, or chats.

## How a local install protects itself

There's no sign-in, so the API relies on these instead:

- Docker publishes every port on `127.0.0.1` only.
- The API answers only Host names in `LEDGERLINE_ALLOWED_HOSTS` (default: `localhost`, `127.0.0.1`, `[::1]`), which blocks DNS rebinding.
- Every API call must carry `X-Ledgerline-Client: web`. A web page on another origin can't send that header without passing a CORS preflight, and CORS allows only the local web app. Other sites therefore can't post forms or files to it.
- Mail app passwords are encrypted with `ENCRYPTION_KEY` before they're stored. Statement passwords are never stored.

If you widen any of these, you remove the protection. Examples: binding to `0.0.0.0`, adding a LAN host name, or putting it behind a public proxy. Anyone who can then reach the API can read your data.

## Never commit

- `.env`, `APP_SECRET`, `ENCRYPTION_KEY`, database URLs, mail app passwords, or Telegram bot tokens
- Bank statement PDFs, mail exports, `backups/`, or database dumps
- A copy of your own ledger used as seed data

## Reporting a vulnerability

Email the address on the GitHub profile. Don't file a public issue for a vulnerability. Include the version or commit, what an attacker can do, and a way to reproduce it without real financial data.
