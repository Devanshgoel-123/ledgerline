# Launch readiness

Assessed on 25 October 2026 on branch `privacy-first-local`, after the move to a
local, single-user app. Every status below comes from a check that was run that
day. Anything not run says so.

**Verdict: ready for a public beta with technical early users, once the branch
is merged and the website is deployed.** A fresh clone installs and runs
with one command. The full lifecycle (start, stop, backup, restore, update,
uninstall) works. The UX audit's one blocker and its high-severity findings are
fixed. What's left is the real-world part: a real mailbox scan over IMAP, a
real ICICI statement, and installs on Windows (WSL) and Linux.

## Install and run

| Check | Status | Evidence |
|---|---|---|
| `./ledgerline start` on a fresh clone | Verified (macOS, Docker Desktop) | Clean clone of the branch; `.env` created with mode 600 and random secrets; build, healthy, app answering |
| Ports bound to 127.0.0.1 only; Postgres not published | Verified | `docker port`: `127.0.0.1:4300`, `127.0.0.1:3300`; nothing for Postgres |
| Migrations on a real Postgres reach 065 | Verified | `schema_migrations` max 65; one local user |
| `status`, `backup`, `restore`, `stop`/`start` keeps data | Verified | Erase, then restore brought back 20 transactions; data survived stop/start |
| Port already in use | Verified | A clear message naming the port and `WEB_PORT` |
| `update` backs up first (even when stopped), then restarts | Verified | Backup written, then healthy |
| `uninstall` keeps data unless you type DELETE | Verified | Volume kept, then removed on DELETE |
| `install.sh` one-liner | **Not run end to end** | It downloads from GitHub `main`, which doesn't have this code until merge. Syntax and ShellCheck are clean |
| Windows (WSL) and Linux | **Not run** | Only macOS was available |

## Privacy boundary

| Check | Status | Evidence |
|---|---|---|
| No client header → 403 | Verified | curl against the running install; unit test; browser journey |
| Foreign Host header (DNS rebinding) → 403 | Verified | curl with `Host: evil.example`; unit test |
| CORS allows only the local web app | Verified | Preflight from `https://evil.example` gets no allow-origin; unit test and browser journey |
| Public website never calls an API | Verified | 0 requests from `/`, `/install`, `/privacy` in the site build; unit test |
| Mail password encrypted at rest; mailbox opened read-only | Verified in code and tests | `EXAMINE` + `BODY.PEEK`; `password_encrypted` column |

## Product flows (browser journeys, `npm test` at the root: 12 passing)

Covered: first run with sample data, then removing it; statement import with
totals, repeats refused, and data surviving a new browser; files that aren't
statements; wrong PDF password; ICICI import; typed-in expense; CSV export;
erase everything; the "not running" message; phone and tablet layouts with no
sideways scroll; and the API refusing foreign callers.

## Checks run

- **Backend:** typecheck, 240 unit and integration tests passing (2 skipped,
  which need Postgres). Fork A also ran the Postgres suite (17/17) and
  migration 065 up/down/up against a real database.
- **Frontend:** typecheck, 89 tests passing, lint with 0 errors, and production
  builds in both app and site mode.
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities in backend
  and frontend. Next.js is on 16.4.3, past the security advisory on 16.4.0.
- **UX audit:** see `ux-audit-ledgerline-local-2026-10-25.md`. One blocker
  (fixed), three high (fixed), and the rest Medium/Low, all fixed except
  grouping chart subcategories.

## Still open, by severity

1. **High: no real IMAP scan yet.** Connect and scan are tested against a fake
   mailbox, and one real refused login was checked. Connect a real Gmail with
   an app password and import a month before announcing.
2. **Medium: first rescan after upgrading an old Gmail-OAuth install.** Message
   ids changed format. Old mail should match existing rows by amount and date
   rather than duplicate, but no test covers it. Check this on the author's own
   data first, with a backup taken.
3. **Medium: `install.sh` and Windows/Linux installs untested.** Run them right
   after merge.
4. **Low: chart subcategories share one grey** (audit DATA-02).

## Launch checklist

- [ ] Merge `privacy-first-local` into `main`.
- [ ] Run the `install.sh` one-liner on a clean macOS user and on Ubuntu, and run `./ledgerline start` in WSL.
- [ ] Connect a real mailbox with an app password; scan one month; compare with the bank's statement.
- [ ] On the author's existing install: `./ledgerline backup`, then `./ledgerline update`, then check the first rescan doesn't duplicate.
- [ ] Deploy the website to Vercel with root `frontend` and `NEXT_PUBLIC_LEDGERLINE_MODE=site`.
- [ ] Rotate the Google OAuth client and Telegram bot token from the old hosted setup, and delete the Google Cloud project if nothing else uses it.
