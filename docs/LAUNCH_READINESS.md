# Launch readiness

Assessed on 12 October 2026; updated after merge `b76ecd7` (ICICI statements, password reset). Every status below comes
from a check that was actually run; nothing is inferred from code reading alone unless it says so.

**Verdict: ready for a public beta once email sending and hosting are set up.** The core path (sign
up, import an HDFC or ICICI statement, see correct totals, correct and export data, reset a
password, delete the account) is verified end to end in a real browser on real Postgres, locally and
in CI, and Gmail scanning has run against a real account. What remains is operational: an SMTP
provider for reset emails, a host for the API, and one real ICICI statement.

## Core workflows

| Workflow | Status | Evidence | Limits |
|---|---|---|---|
| Email sign-up and sign-in | Verified | `e2e/acceptance.spec.ts`, `e2e/first-run.spec.ts` (browser, Postgres); `passwordAuth.test.ts` | |
| Forgotten password | Verified | Browser: emailed link sets a new password, old one stops working; unit and Postgres-store tests | Needs `SMTP_URL` in production; without it the form says reset is not set up |
| Google sign-in | Partially verified | Unit and Postgres tests for the account-claim path; on the live server `/api/auth/google` redirects to Google's consent page | Real Google OAuth not exercised (needs Google credentials) |
| First run (welcome, sample data, remove samples) | Verified | Browser journeys, both stores | |
| Import an HDFC statement PDF | Verified | Generated HDFC-format statement imported in the browser; report card shows 4 lines added | Real customer statements not used (private data) |
| Import an ICICI statement PDF | Verified | Generated PDF in ICICI's layout (wrapped 1–4 line descriptions, centred dates, two pages): every row, direction and balance checked; browser import with totals | Built from screenshots of a real statement; not yet run on the real PDF file |
| Wrong or missing PDF password | Verified | Browser: message shown, user stays signed in; mutation check (reintroducing the old 401) makes the test fail | |
| Files that are not statements | Verified | Browser: non-PDF and non-statement PDF refused with a plain message, nothing added | |
| Repeat upload of the same statement | Verified | Browser: "Already imported", totals unchanged | |
| Totals and categories | Verified | Statement totals worked out in the test (₹870 spent, Food ₹500); sample month worked out by hand (₹28,293: rent and family counted, ₹5,000 investment and ₹52,000 salary excluded) matches API and settled UI | Covered mixes: UPI debits, salary, rent, family, investment, refund |
| Typed-in expense | Verified | Browser: total moves by exactly ₹75; description with parentheses and ₹ accepted | |
| Data persistence across sessions | Verified | Browser: fresh browser context signs in and sees the same totals (Postgres) | |
| CSV export | Verified | Browser download; header and sample flag checked; formula cells neutralised (unit test) | |
| Delete account, sign up again | Verified | Browser: deletion signs out, old password refused, same email can register | |
| Offline / network failure | Verified | Browser offline: "Check your internet connection" | |
| Phone and tablet layout | Verified | Browser at 390×844 and 768×1024: no sideways scrolling on 7 main pages; Apps content visible on first screen; header checked by screenshot | |
| Gmail bank-mail scan | Verified | The live app's scheduled scan on 12 Oct 21:34 read 122 real emails from a connected Gmail account and imported 4 payments; later runs complete | Alert wording tested for HDFC only; SBI, ICICI and Axis alerts are labelled "early" |
| Telegram bot | Blocked | Unit tests only | Needs a Telegram bot token |
| Self-hosting from the README | Verified | Fresh clone of `main`, two secrets set, `docker compose up`: API healthy, sign-up 201, web 200 | |

## Checks run

- Backend: type check, 225 unit tests, both integration scripts, Postgres tests (`npm run test:db`) on a disposable database, production build.
- Frontend: type check, 71 tests, lint (0 errors, 3 `<img>` warnings), production build.
- Browser (Playwright, `npm test` at the repo root): 12 journeys, all passing on Postgres.
- Migrations: all apply to an empty database, roll back one by one, and apply again.
- Dependencies: 0 production vulnerabilities in backend and frontend.
- CI on GitHub runs all of the above, including the browser journeys against a Postgres service.

## Remaining issues, by severity

1. **High (operational) — no email provider configured.** Password reset works, but production needs `SMTP_URL` (any SMTP service) to send the links.
2. **Medium — no hosted deployment.** Vercel can host the frontend only; the API runs background jobs and needs a long-running host.
3. **Medium — ICICI checked on a generated statement only.** Run one real ICICI PDF through Import to confirm.
4. **Low — non-HDFC alert emails.** Gmail scanning works end to end, but only HDFC alert wording is tested.

## Incident note

Migrations 053–063 reached the live database while they were being written. The cause was a
backend dev server (`tsx watch src/index.ts`) left running since 10 October with `backend/.env`
pointing at the real database: every file change restarted it and applied pending migrations. It
was stopped on 12 October. Its restarts also logged failed Gmail scans ("Unsupported state or unable
to authenticate data"): `backend/.env` holds a different `ENCRYPTION_KEY` from the root `.env` the
containers use, so it could not decrypt the stored Gmail token. Point `backend/.env` at a local
database (`docker compose up -d postgres`), not the production one. Backend tests also now refuse any database except the in-memory store or
`TEST_DATABASE_URL`. Do not run the backend dev server against the production database.

## Launch checklist

- [ ] Choose an email provider and set `SMTP_URL` and `MAIL_FROM` so reset links are sent.
- [x] Sign-up allowlist cleared (both `GOOGLE_ALLOWED_EMAILS` and the `allowed_emails` table).
- [ ] Choose hosting for the API and database; point `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS`, `FRONTEND_URL` and the Google OAuth redirect URI at the real domain.
- [ ] Set real `JWT_SECRET`, `ENCRYPTION_KEY` and database password (`./scripts/docker-prod-check.sh --strict --compose`).
- [ ] Turn on database backups and confirm a restore works.
- [x] Real Gmail scan (12 Oct: 122 emails read, 4 payments imported).
- [ ] Import one real HDFC and one real ICICI statement on the production setup.
- [ ] Rotate the Google client secret and Telegram bot token if the old audit report was ever shared outside this machine.

## Known limitations

- Statement import reads HDFC and ICICI PDFs.
- Bank-mail scanning is tested on HDFC alerts; other banks may miss payments.
- Gmail is scanned every 6 hours or on demand; it is not real time.
- No email verification at sign-up (a password reset or Google sign-in proves the address).
- English only; amounts in rupees; dates use Indian conventions.

## How to rerun the evidence

```bash
cd backend && npm test && TEST_DATABASE_URL=postgres://... npm run test:db
cd frontend && npm test && npm run lint && npm run build
npm install && npx playwright install chromium && E2E_DATABASE_URL=postgres://... npm test
```
Use disposable databases only. Backend tests refuse to open the database named in `backend/.env`.
