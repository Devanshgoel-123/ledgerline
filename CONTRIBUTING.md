# Contributing to Ledgerline

Thank you for your interest in contributing to Ledgerline! This guide will help you get started.

---

## 🎯 Code of Conduct

Be respectful, inclusive, and constructive. We're building a welcoming community.

---

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork the repo on GitHub
git clone https://github.com/YOUR-USERNAME/ledgerline.git
cd ledgerline
git remote add upstream https://github.com/Devanshgoel-123/ledgerline.git
```

### 2. Setup Development Environment

**Option A: the full app in Docker**
```bash
./ledgerline start
```

**Option B: run the API and web app yourself (hot reload)**
```bash
docker run -d --name ledgerline-dev-db -e POSTGRES_PASSWORD=dev -p 127.0.0.1:5432:5432 postgres:16-alpine
cd backend && npm install
# Separate terminals:
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npm --prefix backend run dev
npm --prefix frontend install && npm --prefix frontend run dev
```
Never point a dev server at the database of the Ledgerline you actually use: migrations run on every restart.

### 3. Create Feature Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
# or
git checkout -b docs/documentation-update
```

Branch naming:
- `feat/` — New feature
- `fix/` — Bug fix
- `docs/` — Documentation
- `test/` — Tests only
- `refactor/` — Code cleanup

---

## 📝 Development Workflow

### Make Your Changes

**Frontend Changes**
```bash
cd frontend
npm run dev
# Edit src/ files
# Browser auto-refreshes
npm run build  # Verify production build
```

**Backend Changes**
```bash
cd backend
npm run dev
# Edit src/ files
# Server auto-restarts
npm test  # Run tests
npm run build  # Verify TypeScript
```

### Code Style

#### TypeScript
- Use strict mode (enabled by default)
- Explicit return types on functions
- Avoid `any` — use `unknown` and narrow
- Export types for public APIs

```typescript
// ✓ Good
export function processTransaction(id: string): Promise<Transaction> {
  return fetchTransaction(id);
}

// ✗ Avoid
export function processTransaction(id: any) {
  return fetchTransaction(id);
}
```

#### React
- Use functional components + hooks
- Prefer `useEffect` over class lifecycles
- Keep components under 150 lines (split if larger)
- Use `forwardRef` for DOM access, not `ref` on components

```typescript
// ✓ Good
export function MyComponent({ value }: Props) {
  const [state, setState] = useState(value);
  return <div>{state}</div>;
}

// ✗ Avoid
export class MyComponent extends React.Component {
  render() { return <div>...</div>; }
}
```

#### Naming
- `camelCase` for variables, functions, hooks
- `PascalCase` for components, types
- `UPPER_CASE` for constants
- Prefix boolean hooks with `is` or `has` → `isLoading`, `hasData`

```typescript
// ✓ Good
const [isLoading, setIsLoading] = useState(false);
function TransactionList() { }
type TransactionData = { };
const MAX_TRANSACTIONS = 1000;

// ✗ Avoid
const [loading, setLoading] = useState(false);
function transactionlist() { }
type transaction = { };
const maxTransactions = 1000;
```

#### Comments
- NO docstrings (code should be self-documenting)
- Only comment the **WHY**, not the **WHAT**
- Explain non-obvious constraints or workarounds

```typescript
// ✓ Good
// Retry failed imports after 5 minutes (rate limit resets)
await delay(5 * 60 * 1000);

// ✗ Avoid
// Wait for 5 minutes
await delay(5 * 60 * 1000);

// ✗ Avoid
/**
 * Processes a transaction
 * @param txn The transaction
 * @returns The processed transaction
 */
function processTransaction(txn: Transaction): Transaction { }
```

### Commit Messages

Use clear, specific messages that explain the **why**.

**Format:**
```
type: short summary (under 60 chars)

Optional longer explanation with more context.
Explain why this change was made, not what it does.
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `test:` Add/improve tests
- `docs:` Documentation only
- `refactor:` Code organization (no behavior change)
- `perf:` Performance improvement
- `style:` Formatting only

**Examples:**
```
feat: add demo data loading endpoint

- Create /api/demo/load endpoint
- Include 19 sample transactions
- Help new users explore features without real data

fix: prevent duplicate transaction imports on refresh

- Add unique constraint on (userId, attachmentHash)
- Show user "already imported on [date]" message
- Resolves issue #42

test: add integration tests for bill splitting

docs: improve mobile section in README

refactor: extract spending calculation to helper

- Move logic from multiple files to financials.ts
- Improve testability and reusability
```

**Commit size:**
- Small, focused commits (1-3 logical changes)
- Easier to review
- Easier to revert if needed
- Better git history

---

## 🧪 Testing

### Run Backend Tests

```bash
cd backend
npm test                    # All tests
npm test -- --grep "auth"  # Specific tests
npm test -- --watch        # Watch mode
```

**Test coverage:** 157 tests across parser, email, rules, splits, Telegram.

### Run Frontend TypeScript

```bash
cd frontend
npm run build  # Full build + type check
```

**Goal:** 0 errors, strict mode enabled.

### When to Add Tests

✓ Add tests for:
- New business logic (calculations, parsing)
- Public APIs
- Bug fixes (write test that reproduces bug)
- Edge cases (empty data, invalid input)

✗ Skip tests for:
- UI-only components (test through integration)
- Styling changes
- One-off utilities not used elsewhere

### Test Structure

```typescript
describe("parseHDFCAlert", () => {
  it("extracts amount and merchant from alert", () => {
    const result = parseHDFCAlert(SAMPLE_ALERT);
    expect(result.amount).toBe(450);
    expect(result.merchant).toBe("Swiggy");
  });

  it("handles international transactions", () => {
    const result = parseHDFCAlert(INTL_ALERT);
    expect(result).toHaveProperty("currencyCode");
  });

  it("throws on invalid format", () => {
    expect(() => parseHDFCAlert("invalid")).toThrow();
  });
});
```

---

## 🔄 Submitting a Pull Request

### 1. Push to Your Fork

```bash
git push origin feat/your-feature-name
```

### 2. Create PR on GitHub

**Title:** Short summary
```
Add demo data loading for onboarding
```

**Description:**
```markdown
## What
Added demo data endpoint and UI integration to help new users explore features.

## Why
New users had no way to try the app without real financial data. This reduces friction.

## How
- Created /api/demo/load endpoint (19 sample transactions)
- Integrated with OnboardingWelcome component
- Added demo data clearing option in settings

## Testing
- [x] Backend tests passing (157/157)
- [x] Frontend builds with 0 TypeScript errors
- [x] Tested on mobile (iOS Safari, Android Chrome)
- [x] Tested demo data load and clear flows

## Checklist
- [x] Code follows style guide
- [x] Tests added/updated
- [x] Documentation updated
- [x] No breaking changes
```

### 3. Respond to Feedback

- Be open to suggestions
- Ask clarifying questions
- Push changes to same branch (PR auto-updates)

### 4. Merge

Once approved:
- Rebase on main: `git rebase origin/main`
- Merge button on GitHub (or ask maintainer to merge)

---

## 🐛 Reporting Bugs

### Check First

1. Search [existing issues](https://github.com/Devanshgoel-123/ledgerline/issues)
2. Check [Troubleshooting](README.md#troubleshooting) section

### File a New Issue

**Title:** Short description
```
ICICI statement import adds no rows
```

**Description:**
```markdown
## Reproduce
1. ./ledgerline start on a fresh install
2. Import → choose an ICICI statement PDF (do not attach it: it is private)
3. Press Import statement

## Expected
The report lists the new payments

## Actual
"New payments added 0" (paste ./ledgerline logs api, with amounts and names removed)

## Environment
- Browser: Firefox 120
- OS: macOS 14.1
- App version: main branch
- Steps to reproduce: [same as above]
```

---

## 🎨 Feature Requests

**Title:** Clear, specific request
```
Add transaction tags/labels for custom grouping
```

**Description:**
```markdown
## Problem
Categories are fixed. Users want flexible grouping (e.g., "vacation", "project xyz").

## Solution
Add tags/labels feature:
- Create custom tags
- Assign tags to transactions (multiple tags per transaction)
- Filter/group by tags

## Benefit
More flexible expense organization without modifying categories.

## Alternatives Considered
- Add more built-in categories (limited scalability)
- Use merchant names (not flexible enough)
```

---

## 📚 Architecture Guidelines

### When Adding a New Feature

**1. Create a module** (e.g., `backend/src/featureName/`)
```
featureName/
├── controller.ts   # HTTP handlers
├── service.ts      # Business logic
├── routes.ts       # Express routes
└── types.ts        # Feature-specific types (optional)
```

**2. Add database schema** (if needed)
```typescript
// backend/src/db/schema.ts
export const featureTable = pgTable("feature_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**3. Add migration**
Add the next numbered pair in `backend/src/db/migrations/`, e.g.
`065_feature_table.up.sql` and `065_feature_table.down.sql`. They run on API start.

**4. Add routes**
```typescript
// backend/src/featureName/routes.ts
export const featureRouter = Router();
// app.ts mounts every /api route behind localOnly + requireLocalUser, so req.user is set.
featureRouter.post("/", createFeatureHandler);
```

**5. Register in app**
```typescript
// backend/src/app.ts
import { featureRouter } from "./featureName/routes.js";
app.use("/api/feature", featureRouter);
```

**6. Add tests**
```bash
cd backend
# Tests go in tests/ directory
npm test
```

**7. Add frontend integration**
```typescript
// frontend/src/lib/api/client.ts
export function createApiClient() {
  return {
    createFeature: (body: FeatureBody) =>
      requestJson<FeatureResponse>("/api/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}
```

### Design Principles

✓ **Do**
- Validate all inputs (use Zod schemas)
- Scope queries by `userId` (the local profile), as the existing stores do
- Use descriptive type names
- Keep services focused (single responsibility)
- Test edge cases
- Document complex algorithms

✗ **Avoid**
- `any` types (use `unknown` and narrow)
- Sending data off the computer. Anything that does must be optional, off by default, and say so in the UI
- Mutable global state
- Callback hell (use async/await)
- Over-abstraction (YAGNI principle)

---

## 📊 Performance Considerations

### Backend
- Database queries should use indexes
- Avoid N+1 queries (use JOINs)
- Rate limit mutation endpoints
- Cache frequently accessed data

### Frontend
- Code-split large features
- Lazy-load images
- Memoize expensive computations
- Use `<Suspense>` for async content

---

## 🔒 Security Guidelines

### General
- Validate all user input
- Never log sensitive data (secrets, tokens)
- Use parameterized queries (Drizzle handles this)
- Encrypt any stored credential with `crypto/secrets.ts`

### When Adding Features
1. Keep new routes under `/api`, behind the local guard (see [SECURITY.md](SECURITY.md))
2. Never add a network call to a third party without an off-by-default setting
3. Review for XSS/SQL injection
4. Don't log transaction details, mail bodies or secrets

---

## ❓ Need Help?

- **Setup issues?** Check [README](README.md)
- **Code questions?** File an issue with `question` label
- **Design feedback?** Share in Discussions
- **Security?** Email instead of public issue (see [SECURITY.md](SECURITY.md))

---

## 🎓 Learning Resources

### Project
- [README.md](README.md) — Setup & architecture
- [SECURITY.md](SECURITY.md) — Security practices
- [docs/DEMO.md](docs/DEMO.md) — Product walkthrough

### Technologies
- [Next.js](https://nextjs.org/docs)
- [Express](https://expressjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Best Practices
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [React Docs](https://react.dev)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

---

## 🙏 Thank You!

Your contributions make Ledgerline better. We appreciate your time and effort.
