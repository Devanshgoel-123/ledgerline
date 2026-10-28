# API

The Ledgerline API runs on your own computer at `http://localhost:4000`. The
port is `API_PORT` in `.env`. It's an internal interface between the web app
and its database, not a public API, so it can change between versions.

## Every request

- **No sign-in.** There's one local profile, and every request acts as it.
- **Send `X-Ledgerline-Client: web`.** Requests without it get `403`. This is
  what keeps other websites from using the API through your browser (see
  [SECURITY.md](../SECURITY.md)).
- **Use `localhost`, `127.0.0.1` or `[::1]` as the Host.** Anything else gets
  `403`, unless it's listed in `LEDGERLINE_ALLOWED_HOSTS`.
- **JSON in, JSON out**, except where noted.

```bash
curl -H 'X-Ledgerline-Client: web' http://localhost:4000/api/imports/status
```

Errors look like:

```json
{ "error": { "code": "BAD_REQUEST", "message": "A sentence you can show a person", "requestId": "…", "details": [] } }
```

## Health (no header needed)

| Method | Path | |
|---|---|---|
| GET | `/live` | Process is up |
| GET | `/ready` | Database answers |
| GET | `/health` (also `/api/health`) | Summary: status, database |

## Profile and preferences

| Method | Path | |
|---|---|---|
| GET | `/api/me` | `{id, displayName, avatarUrl, dailySpendLimit, createdAt}` |
| PATCH | `/api/me` | `{displayName?, avatarUrl?}`. The avatar is a small JPEG/PNG/WebP data URL |
| DELETE | `/api/me` | **Erases everything**: transactions, rules, mail connection, Telegram link. The next request starts a fresh profile |
| GET, PATCH | `/api/preferences` | `{dailySpendLimit}` |

## Imports and transactions

| Method | Path | |
|---|---|---|
| POST | `/api/parse` | Multipart `file` (PDF) and optional `password`. Imports a statement and returns a report: lines read, already recorded, added, needing review |
| POST | `/api/imports/upload` | Same as `/api/parse` |
| GET | `/api/imports/status` | `{hasTransactions, latestMonth, transactionCount, sampleCount, scanWindow}` |
| GET | `/api/imports/dashboard?from=&to=` | Everything the views draw for a month range |
| GET | `/api/imports` | Import history |
| GET | `/api/imports/export` | CSV of every transaction (`text/csv`) |
| POST | `/api/imports/transactions` | Add an expense: `{date, amount, categorySlug, description}` |
| PATCH | `/api/imports/transactions/:id` | Correct payee, merchant or category |
| PUT | `/api/imports/transactions/:id/splits` | Split a bill: `{friends: [{name, amount}]}` |
| DELETE | `/api/imports/transactions/:id` | Delete. A later import won't add it back |
| DELETE | `/api/imports/data` | Delete imported transactions and mail records. Settings stay |

## Bank mail (IMAP)

| Method | Path | |
|---|---|---|
| GET | `/api/mail/status` | `{connected, needsPassword, email, provider, host, port, scanWindow, lastScannedOn, lastSyncAt, poolingEnabled, latestRun}` |
| POST | `/api/mail/connect` | `{email, provider: gmail\|yahoo\|icloud\|zoho\|outlook\|custom, host?, port?, password}`. Signs in once to check, then stores the app password encrypted. A wrong password, IMAP turned off, or an unreachable server gives `400` with a plain message |
| DELETE | `/api/mail/connect` | Disconnect and wipe the stored password |
| POST | `/api/mail/scan` | `{month?, password?, maxMessages?}` starts a scan: `{status: "running", runId}` |
| POST | `/api/mail/scan-now` | Rescan the current month |
| POST | `/api/mail/pooling/enable`, `/pooling/disable` | Choose banks (`{banks?}`, at most two) and turn the 6-hourly scan on or off |
| GET | `/api/mail/locked-statements` | Statement PDFs found in mail that need a password |
| POST | `/api/mail/locked-statements/:id/unlock` | `{password}` imports one. The password isn't stored |

## Categories, rules, shops

| Method | Path | |
|---|---|---|
| GET, POST | `/api/categories` | List, or add your own |
| GET | `/api/categories/hints` | Category hints by UPI id |
| GET, POST, DELETE | `/api/categories/hints/upi[/:upiId]` | Remember a category for a UPI id |
| GET, POST | `/api/rules` | Your rules (people, matches) |
| GET | `/api/rules/suggestions` | Suggested rules |
| POST | `/api/rules/attach-upi`, `/detach-upi`, `/untrack` | Attach or detach a UPI id to or from a person; stop tracking one |
| DELETE | `/api/rules/:id` | Remove a rule |
| GET, POST | `/api/providers` | The shop and app catalog, plus your own entries |
| PATCH | `/api/providers/:id` | Edit your copy of a shop |
| GET, PATCH | `/api/accounts` | Bank accounts seen in imports |
| GET | `/api/accounts/bank-presets` | Supported banks |

## Statement match

| Method | Path | |
|---|---|---|
| GET | `/api/statement-match/status` | |
| POST | `/api/statement-match/preview` | Lines from a statement with suggested shops |
| POST | `/api/statement-match/apply` | Label one UPI id |
| POST | `/api/statement-match/apply-batch` | Label many in the background: `{id, status, …}` |
| GET | `/api/statement-match/apply-batch/:jobId` | Progress of that job |
| POST | `/api/statement-match/import-missing` | Import statement lines the alerts missed |

## Sample data

| Method | Path | |
|---|---|---|
| POST | `/api/demo/load` | Add a labelled month of made-up transactions |
| DELETE | `/api/demo` | Remove them |

## Telegram (optional)

Needs `TELEGRAM_BOT_TOKEN` in `.env`.

| Method | Path | |
|---|---|---|
| GET | `/api/telegram/status` | Whether the bot is configured and reachable, and whether your chat is linked |
| POST, DELETE | `/api/telegram/link` | Link or unlink a chat |
| POST | `/api/telegram/phone`, `/verify` | Link by phone number with a one-time code |
| POST | `/api/telegram/test` | Send a test message |
| POST | `/api/v1/telegram/webhook` | Only when `TELEGRAM_WEBHOOK_URL` is set. Telegram calls it with its secret header; it doesn't need the client header |
