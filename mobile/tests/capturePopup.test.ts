import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureMessage } from "@/core/capture";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
import { popupCategories } from "@/core/quick";
import { listEntries } from "@/db/repo";
import { testDb } from "./helpers/nodeDb";

/**
 * The iOS popup ("₹640 spent. What was it for?") answers in the App Group
 * inbox next to the message; these check the app files the payment the way
 * you answered.
 */
const SWIGGY = "Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 05/11/26 Ref 532912345678 Not You? Call 18002586161";
const RECEIVED = new Date("2026-11-05T13:00:00+05:30");

async function setup() {
  const db = await testDb();
  const ctx = async () => ({ entries: await listEntries(db), rules: [], categories: BUILT_IN_CATEGORIES });
  return { db, ctx };
}

describe("payments answered in the iOS popup", () => {
  it("uses the category you picked, with nothing left to review", async () => {
    const { db, ctx } = await setup();
    await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED, answer: { type: "debit", categorySlug: "dinner" } }, await ctx());
    const [entry] = await listEntries(db);
    expect(entry).toMatchObject({ amount: 250, categorySlug: "dinner", classificationSource: "user_override", needsReview: false });
  });

  it("adds a payment typed in when no message text came through", async () => {
    const { db, ctx } = await setup();
    await captureMessage(db, { text: "", receivedAt: RECEIVED, answer: { amount: 640.456, categorySlug: "grocery" } }, await ctx());
    await captureMessage(db, { text: "", receivedAt: new Date(RECEIVED.getTime() + 60_000), answer: { amount: 640.456 } }, await ctx());
    const entries = await listEntries(db);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => [entry.amount, entry.type, entry.date, entry.categorySlug, entry.needsReview])).toEqual(
      expect.arrayContaining([
        [640.46, "debit", "2026-11-05", "grocery", false],
        [640.46, "debit", "2026-11-05", "other", true],
      ]),
    );
    expect(entries[0]!.note).toBe("Added from the payment popup");
  });

  it("adds a bank message it couldn't read, with the amount you typed", async () => {
    const { db, ctx } = await setup();
    const odd = "Your a/c XX1234 was used for a txn at DMART on 05-11. Avl bal 10,000. -Some Bank";
    const outcome = await captureMessage(db, { text: odd, receivedAt: RECEIVED, answer: { amount: 1200 } }, await ctx());
    expect(outcome.status).toBe("added");
    const again = await captureMessage(db, { text: odd, receivedAt: RECEIVED, answer: { amount: 1200 } }, await ctx());
    expect(again.status).toBe("duplicate");
  });

  it("ignores a category that doesn't fit the payment", async () => {
    const { db, ctx } = await setup();
    await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED, answer: { categorySlug: "salary" } }, await ctx());
    const [entry] = await listEntries(db);
    expect(entry).toMatchObject({ categorySlug: "food", needsReview: true });
  });

  it("still skips non-payments with no answer", async () => {
    const { db, ctx } = await setup();
    expect((await captureMessage(db, { text: "", answer: null }, await ctx())).status).toBe("not-a-payment");
    expect((await captureMessage(db, { text: "See you at 7?", answer: { amount: 0 } }, await ctx())).status).toBe("not-a-payment");
  });
});

describe("the popup's categories", () => {
  it("offers top-level categories, with Other last", () => {
    const lists = popupCategories([], BUILT_IN_CATEGORIES, "2026-11-05");
    expect(lists.debit[0]).toEqual({ slug: "food", label: "Food & dining", root: "food" });
    expect(lists.debit.at(-1)?.slug).toBe("other");
    expect(lists.credit.at(-1)?.slug).toBe("other-income");
    expect(lists.credit.map((choice) => choice.slug)).toEqual(["salary", "refunds", "from-home", "interest", "transfers", "investments", "other-income"]);
  });

  it("the action's built-in list only uses real categories", () => {
    const swift = readFileSync(join(__dirname, "..", "plugins", "native", "LogBankMessageIntent.swift"), "utf8");
    const block = swift.slice(swift.indexOf("static let fallback"), swift.indexOf("static func choices"));
    const rows = [...block.matchAll(/\("([^"]+)", "([^"]+)", "([^"]+)"\)/g)];
    expect(rows.length).toBeGreaterThan(10);
    const known = new Map(BUILT_IN_CATEGORIES.map((category) => [category.slug, category.label]));
    for (const [, slug, label, root] of rows) {
      expect(known.get(slug!), slug).toBe(label);
      expect(known.has(root!), root).toBe(true);
    }
  });
});
