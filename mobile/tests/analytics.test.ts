import { describe, expect, it } from "vitest";
import { groupCategorySpend, monthAnalytics } from "@/core/analytics";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
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
    expect(household?.children.map((child) => child.slug)).toEqual(expect.arrayContaining(["rent", "grocery"]));
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
