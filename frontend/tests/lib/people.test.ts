import { describe, expect, it } from "vitest";
import { peopleFromTransactions, spendAmount } from "@/helpers/finance";
import type { Transaction } from "@/types";

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36),
    date: "2026-09-01",
    time: null,
    description: "",
    amount: 0,
    type: "debit",
    upiId: null,
    merchant: null,
    payee: null,
    ...overrides,
  } as Transaction;
}

describe("peopleFromTransactions", () => {
  it("totals equal the listed rows, across every UPI id of the person", () => {
    const { people, paymentsByName } = peopleFromTransactions(
      ["Tara"],
      [
        txn({ payee: "Tara", amount: 10000, date: "2026-07-21", upiId: "tara.s@oksbi" }),
        txn({ payee: "Tara", amount: 12000, date: "2026-09-02", upiId: "9000000004@ptyes" }),
        txn({ payee: "Tara", amount: 1500, type: "credit", date: "2026-08-10" }),
        txn({ merchant: "Kabir bakery", amount: 34, description: "Paid to VPA q1@ybl (Kabir bakery)" }),
      ],
    );
    const tara = people.find((person) => person.name === "Tara")!;
    const rows = paymentsByName.tara;
    expect(tara).toMatchObject({ paid: 22000, received: 1500, count: 3, lastDate: "2026-09-02" });
    expect(rows).toHaveLength(tara.count);
    expect(rows.filter((row) => row.direction === "paid").reduce((s, row) => s + row.amount, 0)).toBe(
      tara.paid,
    );
    expect(rows.map((row) => row.date)).toEqual(["2026-09-02", "2026-08-10", "2026-07-21"]);
  });

  it("keeps tracked people with no payments and adds unlabelled family merchants", () => {
    const { people } = peopleFromTransactions(
      ["Nikhil"],
      [txn({ merchant: "Mom", category: "family", amount: 500 })],
    );
    expect(people.map((person) => [person.name, person.count])).toEqual([
      ["Nikhil", 0],
      ["Mom", 1],
    ]);
  });
});

describe("spendAmount", () => {
  it("counts money sent to family as spend", () => {
    expect(spendAmount(txn({ amount: 1130, category: "family" }))).toBe(1130);
  });

  it("still leaves salary and bank transfers out", () => {
    expect(spendAmount(txn({ amount: 500, category: "banks" }))).toBe(0);
    expect(spendAmount(txn({ amount: 500, category: "salary" }))).toBe(0);
  });
});
