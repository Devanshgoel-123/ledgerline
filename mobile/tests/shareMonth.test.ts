import { describe, expect, it } from "vitest";
import { buildMonthPost, sharePercent, X_LIMIT, xComposeUrl, xLength } from "@/core/shareMonth";

const groups = [
  { slug: "food", label: "Food", total: 12000 },
  { slug: "shopping", label: "Shopping", total: 8000 },
  { slug: "transport", label: "Transport", total: 5000 },
  { slug: "bills", label: "Bills", total: 3000 },
  { slug: "subscriptions", label: "Subscriptions", total: 1500 },
  { slug: "family", label: "Family", total: 400 },
  { slug: "gifts", label: "Gifts & donations", total: 100 },
];
const base = { monthTitle: "October 2026", totalSpent: 30000, avgDailySpend: 967.7, groups };

describe("buildMonthPost", () => {
  it("shows shares only, no rupees, by default", () => {
    const post = buildMonthPost({ ...base, showAmounts: false });
    expect(post).toContain("Where my money went in October 2026");
    expect(post).toContain("🍔 Food 40%");
    expect(post).toContain("🛍️ Shopping 27%");
    expect(post).not.toContain("₹");
  });

  it("adds amounts and the daily average when asked", () => {
    const post = buildMonthPost({ ...base, showAmounts: true });
    expect(post).toContain("Food 40% · ₹12,000");
    expect(post).toMatch(/₹30,000 spent, about ₹968 a day/);
  });

  it("lists at most five categories and always fits X's limit", () => {
    for (const showAmounts of [false, true]) {
      const post = buildMonthPost({ ...base, showAmounts });
      expect(post.split("\n").filter((line) => /\d+%/.test(line))).toHaveLength(5);
      expect(xLength(post)).toBeLessThanOrEqual(X_LIMIT);
    }
  });

  it("drops categories rather than run past the limit", () => {
    const long = groups.map((group) => ({ ...group, label: `${group.label} with a very long custom name` }));
    const post = buildMonthPost({ ...base, groups: long, showAmounts: true });
    expect(xLength(post)).toBeLessThanOrEqual(X_LIMIT);
    expect(post).toContain("Food with a very long custom name");
  });

  it("skips empty categories", () => {
    const post = buildMonthPost({ ...base, groups: [groups[0]!, { slug: "bills", label: "Bills", total: 0 }], showAmounts: false });
    expect(post).not.toContain("Bills");
  });
});

describe("helpers", () => {
  it("never rounds a small share down to 0%", () => {
    expect(sharePercent(10, 30000)).toBe("<1%");
    expect(sharePercent(0, 100)).toBe("0%");
  });

  it("counts emoji and ₹ as two, joiners as nothing", () => {
    expect(xLength("abc")).toBe(3);
    expect(xLength("₹")).toBe(2);
    expect(xLength("🛍️")).toBe(2);
    expect(xLength("👨‍👩‍👧")).toBe(6);
  });

  it("builds an X compose link with the text encoded", () => {
    expect(xComposeUrl("a b&c")).toBe("https://x.com/intent/post?text=a%20b%26c");
  });
});
