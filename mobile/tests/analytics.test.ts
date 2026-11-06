import { describe, expect, it } from "vitest";
import { groupCategorySpend, monthAnalytics } from "@/core/analytics";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
import { classify } from "@/core/classify";
import { sampleEntries } from "@/core/sample";
import { addEntries, addEntry, listEntries } from "@/db/repo";
import { testDb } from "./helpers/nodeDb";

const OCT_28 = new Date("2026-10-28T12:00:00+05:30");

async function sampleMonth() {
  const db = await testDb();
  const { month, entries } = sampleEntries(OCT_28);
  await addEntries(db, entries);
  return { db, month };
}

describe("month totals on the phone", () => {
  it("match the web app's rules for the sample month", async () => {
    const { db, month } = await sampleMonth();
    const result = monthAnalytics({
      entries: await listEntries(db),
      month,
      categories: BUILT_IN_CATEGORIES,
      dailyLimit: null,
      people: [],
    });
    expect(month).toBe("2026-10");
    // Every debit including rent, less the ₹299 Amazon refund. The SIP and salary stay out.
    expect(result.summary.totalSpent).toBe(38023);
    expect(result.summary.totalInvested).toBe(5000);
    expect(result.summary.totalReceived).toBe(52000);
  });

  it("counts only your share of a split bill", async () => {
    const { db, month } = await sampleMonth();
    await addEntry(db, {
      date: "2026-10-27",
      amount: 1800,
      type: "debit",
      description: "Dinner",
      categorySlug: "dinner",
      method: "upi",
      splits: [
        { name: "Asha", amount: 600 },
        { name: "Kiran", amount: 600 },
      ],
    });
    const result = monthAnalytics({
      entries: await listEntries(db),
      month,
      categories: BUILT_IN_CATEGORIES,
      dailyLimit: null,
      people: [],
    });
    expect(result.summary.totalSpent).toBe(38023 + 600);
  });

  it("rolls categories up to their parents and still adds up to total spent", async () => {
    const { db, month } = await sampleMonth();
    const result = monthAnalytics({
      entries: await listEntries(db),
      month,
      categories: BUILT_IN_CATEGORIES,
      dailyLimit: null,
      people: [],
    });
    const groups = groupCategorySpend(result.categorySpend ?? [], BUILT_IN_CATEGORIES);
    const sum = groups.reduce((total, group) => total + group.total, 0);
    expect(Math.round(sum * 100) / 100).toBe(result.summary.totalSpent);
    const household = groups.find((group) => group.slug === "household");
    expect(household?.children.map((child) => child.slug)).toEqual(expect.arrayContaining(["rent"]));
    expect(groups.some((group) => group.slug === "rent")).toBe(false);
  });

  it("gives six months of trend ending at the chosen month", async () => {
    const { db, month } = await sampleMonth();
    const result = monthAnalytics({
      entries: await listEntries(db),
      month,
      categories: BUILT_IN_CATEGORIES,
      dailyLimit: 1000,
      people: [],
    });
    expect(result.monthlySpend?.map((row) => row.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(result.monthlySpend?.at(-1)?.total).toBe(38023);
    expect(result.dailyInsights.enabled).toBe(true);
    expect(result.dailyInsights.daysOverLimit.length).toBeGreaterThan(0);
  });
});

describe("the phone's category tree", () => {
  it("leaves a cash withdrawal out of spending, like a transfer between your accounts", async () => {
    const { db, month } = await sampleMonth();
    const before = monthAnalytics({ entries: await listEntries(db), month, categories: BUILT_IN_CATEGORIES, dailyLimit: null, people: [] });
    await addEntry(db, {
      date: "2026-10-27",
      amount: 4000,
      type: "debit",
      description: "ATM withdrawal",
      merchant: null,
      payee: null,
      upiId: null,
      categorySlug: "cash",
      classificationSource: "user_override",
      method: "other",
      origin: "manual",
    });
    const after = monthAnalytics({ entries: await listEntries(db), month, categories: BUILT_IN_CATEGORIES, dailyLimit: null, people: [] });
    expect(after.summary.totalSpent).toBe(before.summary.totalSpent);
  });

  it("recognises everyday billers and files them in the new categories", () => {
    const tx = (description: string, upiId: string | null = null) =>
      classify({ description, upiId, merchant: null, payee: null, amount: 499, type: "debit" }, [], BUILT_IN_CATEGORIES);
    expect(tx("UPI-NETFLIX-NETFLIXUPI@HDFCBANK-HDFC0000001-612345678901-PAYMENT").categorySlug).toBe("subscriptions");
    expect(tx("UPI-BLINKIT-BLINKIT.PAYU@HDFCBANK-HDFC0000001-612345678902-ORDER").categorySlug).toBe("grocery");
    expect(tx("BBPS BESCOM ELECTRICITY BILL 1234567").categorySlug).toBe("electricity");
    expect(tx("POS INDIAN OIL PETROL PUMP KORAMANGALA").categorySlug).toBe("petrol");
    expect(tx("NACH LIC OF INDIA PREMIUM").categorySlug).toBe("insurance");
  });
});
