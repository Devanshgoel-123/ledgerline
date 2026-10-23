# Ledgerline

> Track your UPI spending with bank statements and Gmail alerts. Understand where your money goes.

A privacy-first, open-source expense tracker built for UPI users in India. Import HDFC bank statements as PDFs, connect Gmail for real-time alerts, and analyze spending patterns with rich visualizations and smart categorization.

**Status:** Beta | Free and open source (MIT) | Self-host it, or use a hosted instance

---

## ✨ Features

### Core
- **PDF Import** — Upload HDFC bank statement PDFs (password-protected is fine); every line is checked against the running balance before it is added
- **Gmail Integration (optional)** — Read-only scan of bank alert emails. Tested on HDFC; SBI, ICICI and Axis are marked early
- **Smart Categorization** — Auto-categorize transactions; create custom rules for merchants
- **Bill Splitting** — Split expenses with friends; track who owes what
- **Spending Analytics** — Daily spend trends, category breakdowns, merchant analysis
- **Daily Limits** — Set daily budgets; track days over limit and weekly patterns

### Technical
- **Multi-tenant** — Isolated user data with tenant context enforcement
- **Privacy-first** — No third-party tracking; all data stays in your database
- **Self-hosted** — Deploy to your own server; full control over infrastructure
- **Type-safe** — Full TypeScript, strict mode; zero type errors
- **Accessible** — Keyboard and screen-reader support on the main screens (not yet formally audited)
- **Mobile-optimized** — Touch-friendly inputs; responsive layout

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- Node.js 20+ (for local development)
- PostgreSQL 15+ (included in Docker Compose)

### 1. Clone & Setup

```bash
git clone https://github.com/Devanshgoel-123/ledgerline.git
cd ledgerline
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` and set the two required secrets (generate them like this):
```bash
# Security (required)
JWT_SECRET=$(openssl rand -hex 32)        # paste the output
ENCRYPTION_KEY=$(openssl rand -hex 32)    # must be 64 hex characters

# Database: the default DATABASE_URL already points at the bundled Postgres,
# which COMPOSE_PROFILES=local-db starts. If you change POSTGRES_PASSWORD,
# change it inside DATABASE_URL too. Using hosted Postgres (Neon etc.)?
# Set DATABASE_URL to it and delete the COMPOSE_PROFILES line.

# Optional: Google OAuth & Telegram
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=@your_bot_name
```

The API long-polls Telegram, so the bot works on a laptop with no public URL or
ngrok tunnel. Run one API per bot token. To have Telegram push updates instead,
set `TELEGRAM_WEBHOOK_URL` to the API's public https address and
`TELEGRAM_WEBHOOK_SECRET` to 16+ random characters. Settings shows "Connected"
only when the bot is receiving updates and Telegram accepts messages for your chat.

### 3. Run with Docker

```bash
docker compose up --build
```

Access:
- **Web:** http://localhost:3000
- **API:** http://localhost:4000/health

### 4. Run Locally (without Docker)

```bash
# Start Postgres only
docker compose up -d postgres

# Setup backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev

# Setup frontend (new terminal)
cd frontend
npm install
npm run dev
```

Access: http://localhost:3000 (API at http://localhost:4000)

---

## 📖 User Guide

### First time
1. **Sign up** with an email and password, or continue with Google. Google sign-in also asks for read-only Gmail access; email sign-in never touches your inbox.
2. The **welcome screen** offers three things: import your transactions, explore with sample data, or read this guide.

### Importing a statement PDF
1. Go to **Import** and choose an HDFC statement PDF.
2. Enter its password if it has one (for HDFC this is usually your customer ID). A wrong password says so and keeps you signed in.
3. A report shows how many lines were read, already recorded, added, and held back because they did not add up against the closing balance. Uploading the same file again adds nothing.
4. Choose **View <month>** to see the results.

### Scanning bank mail (optional)
1. Go to **Import** → **Connect Gmail and scan**, and pick your bank.
2. Ledgerline searches only mail from that bank's addresses. It rescans every 6 hours, or whenever you press **Scan bank mail**.
3. Statement PDFs found in mail are usually locked. They are listed on Import under **Statements waiting for a password**; type the password once to import each one. The password is not saved.

### Pages
- **Overview** — total spent, money in, daily average and daily limit for the month.
- **Lifestyle** — spending by category; expand a category to see who or what it went to.
- **Apps** — apps and shops you paid this month, their category and UPI IDs. Apps with no spending are hidden behind a button.
- **People** — money sent to and received from people.
- **Transactions** — every payment: search, filter (a parent category includes its subcategories), change category, split a bill, add an expense by hand, or delete.
- **Settings** — daily limit, profile, Telegram, **Download all transactions (CSV)**, clear imported data, delete account.

### Bill splitting
Open a payment on **Transactions** → split, add friends and their shares. Only your share counts toward your spending.

### Sample data
Choose **Explore with sample data** on the welcome screen. A month of made-up transactions is added and clearly labelled; a banner with **Remove sample data** stays visible until you remove them. Your real imports are never touched.

---

## 🏗 Architecture

### System diagram

```mermaid
flowchart LR
    U["User"] --> Web["Next.js 16 web app<br/>dashboard · imports · rules<br/>splits · analytics"]
    TG["Telegram"] <--> Bot

    subgraph API["Express 5 API (TypeScript)"]
        Auth["/api/auth<br/>JWT + bcrypt"]
        Imp["/api/imports<br/>HDFC PDF statements<br/>(pdf.js parser)"]
        Gm["/api/gmail<br/>OAuth + alert parser"]
        Rules["/api/rules · /api/categories<br/>auto-categorisation"]
        SM["/api/statement-match<br/>reconcile alerts vs statements"]
        Bot["/api/telegram<br/>commands · daily briefing"]
        Misc["/api/accounts · /api/providers<br/>/api/preferences · /api/admin"]
    end

    Worker["Polling worker<br/>Gmail sync jobs"]

    Web -->|REST| Auth & Imp & Rules & SM & Misc
    Web --> Gm
    Gm <--> Google["Gmail API"]
    Worker <--> Google
    Worker --> DB
    Imp --> Rules
    Auth & Imp & Gm & Rules & SM & Bot & Misc --> DB[("PostgreSQL 15<br/>Drizzle ORM")]
```

**Data flow:** bank statement PDFs and Gmail transaction alerts are each parsed into transactions. Rules then categorise them by merchant, and statement matching de-duplicates and reconciles the two sources. The dashboard, analytics, and Telegram briefings all read from the same Postgres data.


### Tech Stack

**Frontend**
- Next.js 16 (App Router)
- React 19 with hooks
- Tailwind CSS 4 + custom design system
- Framer Motion (animations)
- Recharts (visualizations)

**Backend**
- Express 5
- TypeScript (strict mode)
- Drizzle ORM + PostgreSQL 15
- JWT auth with bcrypt
- Domain-driven modules

**Infrastructure**
- Docker & Docker Compose
- PostgreSQL (data)

### Project Structure

```
ledgerline/
├── frontend/              # Next.js web app
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components
│   │   ├── features/     # Feature modules (imports, dashboard)
│   │   ├── lib/          # Utilities (auth, API, hooks)
│   │   └── styles/       # Global & responsive CSS
│   └── package.json
│
├── backend/               # Express API
│   ├── src/
│   │   ├── auth/         # JWT auth, login
│   │   ├── imports/      # PDF/Gmail import logic
│   │   ├── gmail/        # Gmail OAuth & pooling
│   │   ├── rules/        # Auto-categorization rules
│   │   ├── providers/    # Merchant database
│   │   ├── splits/       # Bill splitting
│   │   ├── db/           # Schema & migrations
│   │   ├── middleware/   # Auth, rate limiting, validation
│   │   └── errors/       # Error handling
│   ├── tests/            # Vitest unit & integration tests
│   └── package.json
│
├── docs/                  # Documentation
├── scripts/              # Docker setup & checks
└── docker-compose.yml    # Full stack definition
```

### Data Model

**Core Tables**
- `users` — Account info, auth
- `transactions` — Imported/manual expenses
- `imports` — Import history (PDF, Gmail)
- `splits` — Bill split records
- `categories` — Spending categories
- `providers` — Merchant database
- `rules` — Categorization rules

**Design Principles**
- Tenant isolation (explicit `userId` on all queries)
- Soft deletes (keep audit trail)
- Normalized schema (avoid data duplication)
- Indexes on common queries (date, category, merchant)

---

## 🛠 Development

### Run Tests

```bash
cd backend
npm test
```

Postgres-only tests (need a disposable database, never your real one):

```bash
cd backend
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/scratch npm run test:db
```

Frontend unit tests: `cd frontend && npm test`.

Browser journeys (Playwright) start their own in-memory API and frontend; set
`E2E_DATABASE_URL` to a disposable Postgres to test persistence:

```bash
npm install && npx playwright install chromium
npm test
```

### Type Checking

```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm run build
```

Both must pass with 0 errors.

### Git Workflow

1. Create feature branch: `git checkout -b feat/description`
2. Make small, focused commits
3. Test locally before pushing
4. Create PR on GitHub

`main` is protected: every change lands through a pull request, and it
can merge only when **Backend tests**, **Frontend tests**, **Browser
journeys**, and **Dependency review** pass on the latest `main`. Pull
requests are squash-merged. Workflows on a first-time contributor's pull
request run after a maintainer approves them.

Commit style:
```
feat: add demo data endpoint

- Create /api/demo/load POST endpoint
- Include 19 sample transactions
- Help new users understand app
```

### Making Changes

**Add a new API endpoint:**
1. Create `backend/src/module/controller.ts`
2. Create `backend/src/module/service.ts` (business logic)
3. Create `backend/src/module/routes.ts`
4. Add route to `backend/src/app.ts`
5. Test in `backend/tests/`

**Add a new page:**
1. Create `frontend/src/app/(dashboard)/path/page.tsx`
2. Add to navigation (`dashboardViews.ts`)
3. Add styling if needed
4. Test mobile layout

---

## 📦 Deployment

### Self-Hosted (Recommended)

**1. Generate Secrets**
```bash
./scripts/generate-docker-secrets.sh
```

**2. Set Production Environment**
```bash
cp .env.example .env
# Edit .env with secure values
./scripts/docker-prod-check.sh --strict --compose
```

**3. Run Production Stack**
```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up --build -d
```

Features in prod:
- No published database port (internal only)
- Strict secret validation
- Optional Gmail worker container

### Web app on Vercel

The Next.js app (`frontend/`) deploys to Vercel: a merge to `main`
deploys to production and every pull request gets a preview. The API is
a long-running server (Gmail scanning and the Telegram bot keep running),
so host `backend/` with Docker as above.

1. Import the repository in Vercel and set **Root Directory** to `frontend`.
2. Set `NEXT_PUBLIC_API_URL` to your API's public URL, then redeploy:
   the value is built into the page.
3. On the API, add the Vercel domain to `CORS_ORIGINS` and set
   `FRONTEND_URL` to it, so sign-in and email links come back to the app.

### Production Checklist

- [ ] JWT_SECRET is ≥16 random characters
- [ ] ENCRYPTION_KEY is 64 hex characters
- [ ] Database password is strong (not default)
- [ ] CORS_ORIGINS restricted to your domain
- [ ] HTTPS enabled (use reverse proxy like nginx)
- [ ] Backups configured for Postgres
- [ ] Logs monitored (check `/api/health`)
- [ ] Rate limiting configured (see config.ts)

### Monitoring

Health checks:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
curl http://localhost:4000/live
```

Logs:
```bash
docker compose logs -f api
docker compose logs -f web
```

---

## 🔒 Security

### Data Privacy
- All data stored in your database
- No analytics or telemetry sent externally
- Passwords hashed with bcrypt (12 rounds)
- JWTs expire after 7 days

### Best Practices
1. **Keep secrets secure** — Never commit `.env`
2. **Use HTTPS** — Always in production
3. **Backup database** — Daily snapshots recommended
4. **Monitor logs** — Watch for suspicious activity
5. **Update dependencies** — Run `npm audit` regularly

### Reporting Security Issues
See [SECURITY.md](SECURITY.md) for responsible disclosure.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code style & conventions
- How to submit PRs
- Issue reporting

---

## ❓ Troubleshooting

### "PDF password incorrect"
HDFC sends the password separately from the statement. Check your email or account settings.

### "Gmail connection failed"
1. Check Google OAuth credentials in `.env`
2. Ensure redirect URI matches: `http://localhost:3000/api/auth/callback/google`
3. Verify email is Gmail (not corporate G Suite)

### "Transactions not showing"
1. Go to **Import** → check import history
2. Verify PDF or Gmail scan completed
3. Check **Transactions** tab — may need manual review

### "High memory usage"
1. Reduce `MAX_POOL_SIZE` in `.env` (default: 20)
2. Reduce Gmail scan frequency (default: 5 min)
3. Archive old transactions to reduce dataset size

### Tests failing locally
```bash
cd backend
rm -rf node_modules
npm install
npm test
```

### TypeScript errors in build
```bash
cd frontend
npm run build
# Check error messages
# Fix issues and retry
```

---

## 📊 Performance

### Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Page load | <2s | 1.2s |
| API response | <200ms | ~100ms |
| PDF parse | <5s | 2-4s |
| Gmail scan | <30s | 8-15s |

### Optimization Tips

1. **Database** — Add indexes for custom queries
2. **Frontend** — Use `<Suspense>` for large components
3. **Images** — Optimize with `next/image`
4. **API** — Cache frequently accessed data

---

## 📝 License

[MIT](LICENSE) © 2026 Devansh Goel

Ledgerline is open-source software. You're free to use, modify, and distribute it under the MIT license.

---

## 🔗 Links

- **Source Code:** https://github.com/Devanshgoel-123/ledgerline
- **Issues:** GitHub Issues tab
- **Docs:** [docs/](docs/) folder
- **Demo:** Try demo data in app

---

## 🙋 Support

- Check [Troubleshooting](#troubleshooting) section
- Search [GitHub Issues](https://github.com/Devanshgoel-123/ledgerline/issues)
- Review [SECURITY.md](SECURITY.md) for security questions
- File a new issue with details
