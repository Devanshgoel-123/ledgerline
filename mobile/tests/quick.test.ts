import { describe, expect, it } from "vitest";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
import type { Entry } from "@/core/model";
import { pressKey, quickCategories, widgetShortcuts } from "@/core/quick";

function entry(date: string, categorySlug: string, extra: Partial<Entry> = {}): Entry {
  return {
    id: `${date}-${categorySlug}-${Math.random()}`,
    date,
    amount: 100,
    type: "debit",
    description: "x",
    merchant: null,
    payee: null,
    upiId: null,
    providerId: null,
    categorySlug,
    classificationSource: "user_override",
    method: "upi",
    origin: "manual",
    statementRef: null,
    note: null,
    splits: [],
    createdAt: date,
    updatedAt: date,
    ...extra,
  } as Entry;
}

describe("quick add categories", () => {
  const today = "2026-11-05";

  it("puts the asked-for category first, then the most used", () => {
    const entries = [entry("2026-11-01", "rides"), entry("2026-11-02", "rides"), entry("2026-11-03", "grocery")];
    const order = quickCategories(entries, BUILT_IN_CATEGORIES, { type: "debit", preferred: "shopping", today });
    expect(order.slice(0, 3)).toEqual(["shopping", "rides", "grocery"]);
  });

  it("ignores old, sample and other-type entries, and never repeats", () => {
    const entries = [
      entry("2026-08-01", "salon"),
      entry("2026-11-01", "pharmacy", { origin: "sample" }),
      entry("2026-11-01", "salary", { type: "credit" }),
    ];
    const order = quickCategories(entries, BUILT_IN_CATEGORIES, { type: "debit", today });
    expect(order[0]).toBe("food");
    expect(order).not.toContain("banks");
    expect(new Set(order).size).toBe(order.length);
  });

  it("ignores a preferred slug that doesn't exist", () => {
    const order = quickCategories([], BUILT_IN_CATEGORIES, { type: "debit", preferred: "nope", today });
    expect(order[0]).toBe("food");
  });

  it("gives the widget four shortcuts from different groups", () => {
    const entries = [entry("2026-11-01", "dinner"), entry("2026-11-01", "dinner"), entry("2026-11-02", "sports")];
    const shortcuts = widgetShortcuts(entries, BUILT_IN_CATEGORIES, today);
    expect(shortcuts).toHaveLength(4);
    expect(shortcuts[0]).toBe("dinner");
    expect(shortcuts).not.toContain("sports"); // same group as dinner
  });
});

describe("keypad", () => {
  const type = (keys: string[]) => keys.reduce(pressKey, "");

  it("builds amounts", () => {
    expect(type(["1", "2", "0"])).toBe("120");
    expect(type([".", "5"])).toBe("0.5");
    expect(type(["0", "0", "7"])).toBe("7");
  });

  it("keeps two decimals and one point", () => {
    expect(type(["9", ".", "9", "9", "9", "."])).toBe("9.99");
  });

  it("caps whole digits at eight", () => {
    expect(type(["1", "2", "3", "4", "5", "6", "7", "8", "9"])).toBe("12345678");
  });

  it("deletes and clears", () => {
    expect(pressKey("120", "back")).toBe("12");
    expect(pressKey("120", "clear")).toBe("");
  });
});
