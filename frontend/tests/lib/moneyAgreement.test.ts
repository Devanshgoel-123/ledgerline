import { describe, expect, it } from "vitest";
import { chartSpendAmount, debitDailySpend, moneyInAmount, spendAmount } from "@/helpers/finance";
import type { CategorySummary, Transaction } from "@/types";

/**
 * The same hand-worked month as backend tests/unit/summaryTotals.test.ts,
 * in the shape the API returns. The chart and the summary cards must agree.
 *   spend 26050.40 · money in 50100 · avg/day (26050.40 − 25000 rent) / 4 = 262.60
 */
let n = 0;
const txn = (t: Partial<Transaction>): Transaction =>
  ({ id: `t${++n}`, time: null, upiId: null, merchant: null, payee: null, description: "", isRefund: false, ...t }) as Transaction;

const categories = [
  { slug: "investments", meta: {} },
  { slug: "self-transfer", meta: { parent: "investments" } },
] as unknown as CategorySummary[];

const month: Transaction[] = [
  txn({ date: "2026-09-01", type: "debit", amount: 1000.1, myShare: 1000.1, category: "food" }),
  txn({ date: "2026-09-01", type: "debit", amount: 25000, myShare: 25000, category: "rent" }),
  txn({ date: "2026-09-02", type: "debit", amount: 300, myShare: 200, category: "food" }),
  txn({ date: "2026-09-03", type: "credit", amount: 50000, category: "salary" }),
  txn({ date: "2026-09-03", type: "credit", amount: 150, category: "food", isRefund: true }),
  txn({ date: "2026-09-04", type: "debit", amount: 5000, myShare: 5000, category: "investments" }),
  txn({ date: "2026-09-04", type: "debit", amount: 2000, myShare: 2000, category: "self-transfer" }),
  txn({ date: "2026-09-04", type: "credit", amount: 2000, category: "self-transfer" }),
  txn({ date: "2026-09-05", type: "credit", amount: 100, payee: "Amit", category: "family" }),
  txn({ date: "2026-09-06", type: "credit", amount: 700, category: "passed-on" }),
  txn({ date: "2026-09-06", type: "debit", amount: 700, myShare: 700, category: "passed-on" }),
  txn({ date: "2026-09-30", type: "debit", amount: 0.2, myShare: 0.2, category: "food" }),
  txn({ date: "2026-10-01", type: "debit", amount: 0.1, myShare: 0.1, category: "food" }),
];

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

describe("frontend money helpers agree with the API summary", () => {
  it("total spent", () => expect(sum(month.map((t) => spendAmount(t, categories)))).toBe(26050.4));
  it("money in leaves refunds, own transfers, and passed-on money out", () =>
    expect(sum(month.map(moneyInAmount))).toBe(50100));
  it("daily average includes a refund on a day with no spending", () => {
    const days = debitDailySpend(month, categories);
    const chartSpent = sum(month.map((t) => chartSpendAmount(t, categories)));
    expect(days.length).toBe(4);
    expect(Math.round((chartSpent / days.length) * 100) / 100).toBe(262.6);
  });
});
