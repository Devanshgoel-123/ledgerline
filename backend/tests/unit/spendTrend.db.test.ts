import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { NewTransactionInput } from "../../src/db/types.js";
import { startTestApp } from "../helpers/testApp.js";

const pay = (date: string, amount: number, key: string, extra: Partial<NewTransactionInput> = {}): NewTransactionInput => ({
  importId: null, accountId: null, date, time: null, description: `UPI-${key}`, amount, type: "debit",
  upiId: null, merchant: "Shop", payee: null, providerId: null, categorySlug: "food",
  classificationSource: "user_override", fingerprint: `trend-${key}`, mailMessageId: null, origin: "mail",
  verifiedAt: null, ...extra,
});

describe("month-by-month spend on the dashboard", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => app.close());

  it("sends the selected month and the five before it, each by the Total spent rules", async () => {
    const user = await app.newUser("trend");
    const k = user.id.slice(0, 8);
    await app.store.insertTransactions(user.id, [
      pay("2026-02-28", 999, `${k}-feb`), // seven months back: outside the six
      pay("2026-04-30", 400, `${k}-apr`),
      pay("2026-08-31", 1000, `${k}-aug`),
      pay("2026-08-15", 25000, `${k}-rent`, { categorySlug: "rent" }),
      pay("2026-09-01", 300, `${k}-sep`),
      pay("2026-09-02", 50, `${k}-ref`, { type: "credit", description: "REFUND SHOP" }),
      pay("2026-09-03", 5000, `${k}-inv`, { categorySlug: "investments" }),
    ]);
    const res = await app.call<{ summary: { totalSpent: number }; monthlySpend: Array<{ month: string; total: number }>; transactions: unknown[] }>(
      user.token,
      "/api/imports/dashboard?from=2026-09-01&to=2026-09-30",
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.monthlySpend, [
      { month: "2026-04", total: 400 },
      { month: "2026-08", total: 26000 },
      { month: "2026-09", total: 250 },
    ]);
    assert.equal(res.body.summary.totalSpent, 250, "the selected month's bar equals Total spent");
    assert.equal(res.body.transactions.length, 3, "the month's own data stays limited to September");
  });
});
