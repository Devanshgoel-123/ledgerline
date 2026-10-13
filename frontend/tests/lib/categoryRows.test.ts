import { describe, expect, it } from "vitest";
import { buildCategorySpendRows } from "@/helpers/finance";
import type { AmountBand, CategorySummary } from "@/types";

const band = { label: "", min: 0, max: 0, count: 0, total: 0, days: [], dayCounts: {} } as AmountBand;
const cat = (slug: string, parent?: string) =>
  ({ id: slug, slug, label: slug[0]!.toUpperCase() + slug.slice(1), blurb: "", accent: "#000", sortOrder: 0, meta: parent ? { parent } : {} }) as CategorySummary;
const categories = [cat("food"), cat("rent"), cat("household"), cat("grocery", "household"), cat("other")];

describe("buildCategorySpendRows", () => {
  const spend = [
    { slug: "rent", total: 25000, count: 1 },
    { slug: "food", total: 1050.4, count: 4 },
    { slug: "grocery", total: 300, count: 2 },
    { slug: "pets-from-an-old-label", total: 120, count: 1 },
    { slug: "other", total: 900, count: 1 },
  ];
  const rows = buildCategorySpendRows(
    [{ merchant: "Swiggy", total: 1050.4, count: 4, lastDate: "2026-09-30", categorySlug: "food" }],
    band,
    categories,
    spend,
  );

  it("adds up to the total of the API's category figures (Total spent)", () => {
    const sum = Math.round(rows.reduce((acc, row) => acc + row.total, 0) * 100) / 100;
    expect(sum).toBe(27370.4);
  });

  it("keeps rent, rolls sub-categories into their parent, and files unknown labels under Other", () => {
    expect(rows.map((row) => [row.id, row.total])).toEqual([
      ["rent", 25000],
      ["food", 1050.4],
      ["other", 1020],
      ["household", 300],
    ]);
    expect(rows.find((row) => row.id === "household")?.children.map((c) => c.id)).toEqual(["grocery"]);
    expect(rows.find((row) => row.id === "food")?.children.map((c) => c.label)).toEqual(["Swiggy"]);
  });
});

import { monthlySpendRows } from "@/helpers/finance";

describe("monthlySpendRows", () => {
  it("labels each month and keeps the API's totals", () => {
    expect(monthlySpendRows([{ month: "2026-08", total: 26000 }, { month: "2026-09", total: 250 }])).toEqual([
      { month: "2026-08", label: "August 2026", total: 26000 },
      { month: "2026-09", label: "September 2026", total: 250 },
    ]);
  });
});
