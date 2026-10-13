import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnalyticsFromRows } from "../../src/analytics/fromStore.js";
import type { CategoryRow, TransactionRow } from "../../src/db/types.js";

let n = 0;
function row(input: Partial<TransactionRow> & Pick<TransactionRow, "date" | "type" | "amount">): TransactionRow {
  n += 1;
  return {
    id: `t${n}`, userId: "u", importId: null, accountId: null, time: null, description: "",
    upiId: null, merchant: null, payee: null, providerId: null, categorySlug: null,
    classificationSource: "user_override", fingerprint: `f${n}`, mailMessageId: null,
    origin: "mail", verifiedAt: null, splits: [], ...input,
  };
}

const categories: CategoryRow[] = [
  "food", "rent", "salary", "investments", "self-transfer", "family", "other", "banks", "passed-on",
].map((slug, i) => ({
  id: `c${i}`, userId: null, slug, label: slug, blurb: "", accent: "#000", sortOrder: i,
  meta: slug === "self-transfer" ? { parent: "investments" } : {}, isGlobal: true,
}));

/**
 * Worked by hand:
 *   spend    1000.10 + 25000 + (300 − 100 friend) + 0.20 + 0.10 − 150 refund = 26050.40
 *   invested 5000 (self-transfer 2000 is neither)
 *   money in 50000 salary + 100 friend back = 50100 (refund lowers spend instead)
 *   cash     in 50000 + 150 + 100 = 50250; out 1000.10 + 25000 + 300 + 5000 + 0.20 + 0.10 = 31300.40
 *            net 18949.60 (passed-on 700 in and out is excluded both ways)
 *   payments 5 counted in spend
 *   avg/day  (26050.40 − 25000 rent) / 4 days with spend = 262.60
 */
const rows = [
  row({ date: "2026-09-01", type: "debit", amount: 1000.1, description: "UPI-SWIGGY", merchant: "Swiggy", categorySlug: "food" }),
  row({ date: "2026-09-01", type: "debit", amount: 25000, description: "RENT", merchant: "Landlord", categorySlug: "rent" }),
  row({ date: "2026-09-02", type: "debit", amount: 300, description: "DINNER", merchant: "Cafe", categorySlug: "food", splits: [{ name: "Amit", amount: 100 }] }),
  row({ date: "2026-09-03", type: "credit", amount: 50000, description: "NEFT CR ACME PAYROLL", merchant: "Acme", categorySlug: "salary" }),
  row({ date: "2026-09-03", type: "credit", amount: 150, description: "REFUND SWIGGY", merchant: "Swiggy", categorySlug: "food" }),
  row({ date: "2026-09-04", type: "debit", amount: 5000, description: "ZERODHA", merchant: "Zerodha", categorySlug: "investments" }),
  row({ date: "2026-09-04", type: "debit", amount: 2000, description: "TO OWN ICICI", merchant: "Self", categorySlug: "self-transfer" }),
  row({ date: "2026-09-04", type: "credit", amount: 2000, description: "FROM OWN ICICI", merchant: "Self", categorySlug: "self-transfer" }),
  row({ date: "2026-09-05", type: "credit", amount: 100, description: "UPI-AMIT", payee: "Amit" }),
  row({ date: "2026-09-06", type: "credit", amount: 700, description: "UPI-KABIR RENT SHARE", categorySlug: "passed-on" }),
  row({ date: "2026-09-06", type: "debit", amount: 700, description: "UPI-LANDLORD", categorySlug: "passed-on" }),
  row({ date: "2026-09-30", type: "debit", amount: 0.2, description: "CHAI", merchant: "Chai", categorySlug: "food" }),
  row({ date: "2026-10-01", type: "debit", amount: 0.1, description: "CHAI", merchant: "Chai", categorySlug: "food" }),
];

describe("summary totals against a hand-worked month", () => {
  const { summary, daily, categorySpend } = buildAnalyticsFromRows(rows, [], [], categories, { dailySpendLimit: null });

  it("category totals add up to total spent, rent and refunds included", () => {
    const sum = Math.round((categorySpend ?? []).reduce((acc, row) => acc + row.total, 0) * 100) / 100;
    assert.equal(sum, summary.totalSpent);
    assert.deepEqual(
      (categorySpend ?? []).map((row) => [row.slug, row.total, row.count]),
      [["rent", 25000, 1], ["food", 1050.4, 4]],
    );
  });

  it("spend includes rent and your share, less refunds", () => assert.equal(summary.totalSpent, 26050.4));
  it("invested leaves self-transfers out", () => assert.equal(summary.totalInvested, 5000));
  it("money in includes salary, not refunds or own transfers", () => assert.equal(summary.totalReceived, 50100));
  it("net is cash in less cash out", () => assert.equal(summary.net, 18949.6));
  it("payment count matches what total spent counts", () => assert.equal(summary.transactionCount, 5));
  it("a refund on a day with no spending still lowers the daily average", () => {
    assert.equal(daily.length, 4);
    assert.equal(summary.avgDailySpend, 262.6);
  });
  it("month boundary keeps 30 Sep and 1 Oct apart", () => {
    assert.deepEqual(
      daily.filter((d) => d.date >= "2026-09-30").map((d) => [d.date, d.amount]),
      [["2026-09-30", 0.2], ["2026-10-01", 0.1]],
    );
  });
});

describe("category totals keep payments the merchant list leaves out", () => {
  const hdfc = {
    id: "p-hdfc", userId: null, canonicalName: "HDFC Bank", aliases: ["HDFC"], upiHandles: [],
    senderDomains: [], websiteDomain: null, logoUrl: null, categorySlug: "banks", isGlobal: true,
  };
  const extra = [
    ...categories,
    { id: "c-pets", userId: "u", slug: "pets", label: "Pets", blurb: "", accent: "#000", sortOrder: 99, meta: {}, isGlobal: false },
  ];
  const month = [
    // Sent over the bank rail with no vendor: not a merchant, still money spent.
    row({ date: "2026-09-01", type: "debit", amount: 900, description: "NEFT DR-X", merchant: "HDFC Bank", categorySlug: "other", classificationSource: "parser" }),
    // A custom category of the user's own.
    row({ date: "2026-09-02", type: "debit", amount: 300, description: "VET", merchant: "Vet", categorySlug: "pets" }),
    // A refund larger than this month's spend at that merchant.
    row({ date: "2026-09-03", type: "debit", amount: 100, description: "UPI-SHOP", merchant: "Shop", categorySlug: "food" }),
    row({ date: "2026-09-04", type: "credit", amount: 250, description: "REFUND SHOP", merchant: "Shop", categorySlug: "food" }),
  ];
  const result = buildAnalyticsFromRows(month, [hdfc], [], extra, { dailySpendLimit: null });

  it("adds up to total spent", () => {
    const sum = Math.round((result.categorySpend ?? []).reduce((acc, r) => acc + r.total, 0) * 100) / 100;
    assert.equal(result.summary.totalSpent, 1050);
    assert.equal(sum, 1050);
  });
});
