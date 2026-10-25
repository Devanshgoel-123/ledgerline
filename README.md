# Ledgerline

> Where your UPI money actually went, worked out on your own computer.

Ledgerline is a free, open-source (MIT) spending tracker for UPI users in India.
It reads your bank statement PDFs and bank alert emails, sorts every payment by
app, shop, person and category, and shows the month as a picture you can act on.

It runs only on your computer. There is no account to create, no cloud, no
analytics. Your data sits in a database on your machine, and the app only
answers your own browser.

---

## Install

You need **Docker**. Use Docker Desktop on macOS or Windows, or Docker Engine
with the Compose plugin on Linux. On Windows, run the commands below in a
**WSL (Ubuntu) terminal** with Docker Desktop's WSL integration turned on.

Choose one of three ways. All of them end with the same command.

**1. One line**

```bash
curl -fsSL https://raw.githubusercontent.com/Devanshgoel-123/ledgerline/main/install.sh | sh
```

This downloads Ledgerline into `~/ledgerline` and starts it. To use another
folder, set `LEDGERLINE_DIR=/path` first. You can read
[install.sh](install.sh) before you run it.

**2. Clone**

```bash
git clone https://github.com/Devanshgoel-123/ledgerline.git
cd ledgerline
./ledgerline start
```

**3. Download**

Download the [zip](https://github.com/Devanshgoel-123/ledgerline/archive/refs/heads/main.zip)
and unzip it. Open a terminal in that folder, then run `./ledgerline start`.

### What `./ledgerline start` does

1. Checks that Docker is installed and running, and that ports 3000 and 4000 are free.
2. On the first run, creates `.env` with random secrets. You don't edit anything.
3. Builds and starts three containers: Postgres, the API and the web app. All of
   them listen on `127.0.0.1` only. The first build takes a few minutes; later
   starts take seconds.
4. Waits until everything answers, then opens <http://localhost:3000>.

### Everyday commands

| Command | What it does |
|---|---|
| `./ledgerline start` | Start Ledgerline and open it |
| `./ledgerline stop` | Stop it. Your data is kept |
| `./ledgerline status` | Show whether each part is running |
| `./ledgerline logs` | Follow the logs (`logs api` for one part) |
| `./ledgerline open` | Open it in your browser |
| `./ledgerline update` | Back up, get the latest version, restart |
| `./ledgerline backup` | Save your data to `./backups` |
| `./ledgerline restore <file>` | Replace your data with a backup |
| `./ledgerline uninstall` | Remove the containers. Asks before deleting your data |

Docker restarts Ledgerline when your computer restarts, as long as Docker itself
starts.

---

## Using it

1. Open <http://localhost:3000>. The welcome screen offers three things: import
   a statement, look around with sample data, or read how your data stays private.
2. **Statement PDFs.** Go to **Import** and choose an HDFC or ICICI statement.
   Password-protected files are fine; for HDFC the password is usually your
   customer ID. The password is used once and never saved. Each line is checked
   against the running balance before it's added, and uploading the same file
   twice adds nothing.
3. **Bank alert emails (optional).** Under **Import → Bank alert emails**, enter your
   email address and an *app password* from your mail provider. Ledgerline
   connects over IMAP, reads only mail from your bank's addresses, and never
   changes your mailbox. The app password is encrypted with the key in your
   `.env` and stored only in your local database. Ledgerline rescans every 6
   hours, or when you press **Scan bank mail**.
4. **Things your bank can't see.** UPI Lite payments, cash and other wallets
   don't appear in statements or alerts. Add them under **Transactions → Add
   expense**.

The pages:

- **Overview**: spent, money in, daily average and your daily limit.
- **Lifestyle**: spending by category, and who or what each category went to.
- **Apps**: the apps and shops you paid, with their UPI IDs.
- **People**: money sent to and received from people.
- **Transactions**: search, filter, recategorise, split a bill, add or delete.
- **Settings**: daily limit, rules, CSV export, Telegram, and erasing everything.

### What it supports today

| Source | Status |
|---|---|
| HDFC statement PDF | Supported |
| ICICI statement PDF | Supported (built from the real layout; few real files tested) |
| HDFC alert emails | Supported |
| SBI, ICICI, Axis alert emails | Early: some payments may be missed |
| Other banks | Not yet. Add them by hand, or [open an issue](https://github.com/Devanshgoel-123/ledgerline/issues) |

---

## Privacy

- **No account and no sign-in.** Ledgerline is for the one person using this computer.
- **Nothing is sent anywhere** except the connections you turn on. Ledgerline
  reads your mailbox over IMAP if you connect it. The optional Telegram bot is
  the one feature that sends data off your computer: to Telegram, and only if
  you add a bot token.
- **Only your browser can reach it.** All ports bind to `127.0.0.1`. The API
  also rejects requests addressed to any other host name (which blocks DNS
  rebinding), and requests that don't carry the web app's header (so other
  websites open in your browser can't use it).
- **Secrets stay local.** `.env` holds the keys. A mail app password is
  encrypted before it's stored. Statement passwords are never stored.
- **Erasing is real.** **Settings → Erase everything** deletes every
  transaction, rule and connection. `./ledgerline uninstall` can delete the
  database too.

Back up with `./ledgerline backup`. To restore on another computer you also
need the same `.env`, because it unlocks the stored mail password (or you can
just reconnect your mail).

---

## Troubleshooting

**"Docker is not running".** Start Docker Desktop, wait until it says it's
running, then run `./ledgerline start` again.

**"Port 3000 is already in use".** Another program is using that port. Set
`WEB_PORT=3001` (or `API_PORT` for 4000) in `.env`, then start again.

**The page says "Ledgerline is not running".** The web page couldn't reach the
API on your computer. Run `./ledgerline status`, then `./ledgerline logs api`.

**The mail app password is refused.** Gmail, Yahoo and iCloud only issue app
passwords once 2-step verification is on. Create a new app password and paste
it without spaces. Your normal email password won't work.

**A statement isn't recognised.** Only HDFC and ICICI PDFs are read for now.
Check that the file is the statement PDF from net banking, not a screenshot or
a printout.

---

## How it fits together

```mermaid
flowchart LR
    B["Your browser<br/>localhost:3000"] --> Web["Web app<br/>Next.js"]
    B -->|"X-Ledgerline-Client"| API["API<br/>Express + TypeScript"]
    API --> DB[("Postgres<br/>Docker volume")]
    API -->|"IMAP, read-only<br/>(optional)"| Mail["Your mailbox"]
    API -.->|"optional bot"| TG["Telegram"]
```

Statement PDFs and alert emails are each parsed into transactions. Rules then
categorise them by merchant, and statement matching reconciles the two sources
so a payment is never counted twice. Every page reads the same Postgres data.

| Part | Where | Notes |
|---|---|---|
| Web app | `frontend/` | Next.js 16, React 19. It also builds the public website when `NEXT_PUBLIC_LEDGERLINE_MODE=site` |
| API | `backend/` | Express 5, TypeScript strict, Drizzle ORM, pdf.js parser |
| Database | Docker volume `ledgerline_pg` | Postgres 16. Migrations run on start |
| CLI | `ledgerline`, `install.sh` | Bash; no dependencies beyond Docker |

---

## Development

```bash
docker run -d --name ledgerline-dev-db -e POSTGRES_PASSWORD=dev -p 127.0.0.1:5432:5432 postgres:16-alpine

cd backend && npm install
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npm run dev    # API on :4000

cd frontend && npm install && npm run dev                                   # web on :3000
```

With `DATABASE_URL=memory`, the API runs with no database at all, using an
in-memory store that's lost on restart.

Tests:

```bash
cd backend && npm run typecheck && npm test
cd backend && TEST_DATABASE_URL=postgres://... npm run test:db   # disposable database only
cd frontend && npm run typecheck && npm run lint && npm test
npm install && npx playwright install chromium && npm test       # browser journeys, from the repo root
```

The public website is the same frontend, built with
`NEXT_PUBLIC_LEDGERLINE_MODE=site` (on Vercel, set the root directory to
`frontend`). In that mode it shows the landing and install pages and never
calls an API.

See [CONTRIBUTING.md](CONTRIBUTING.md) to send changes, and
[SECURITY.md](SECURITY.md) to report a vulnerability.

## License

MIT
