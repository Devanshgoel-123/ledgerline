import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureMessage } from "@/core/capture";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
import type { Entry } from "@/core/model";
import { popupCategories, quickCategories } from "@/core/quick";
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

  it("the action's built-in list is exactly the app's list before any history", () => {
    const swift = readFileSync(join(__dirname, "..", "plugins", "native", "LogBankMessageIntent.swift"), "utf8");
    const block = swift.slice(swift.indexOf("static let fallback"), swift.indexOf("static func choices"));
    const section = (key: string) => {
      const from = block.indexOf(`"${key}": [`);
      const to = block.indexOf("].map", from);
      return [...block.slice(from, to).matchAll(/\("([^"]+)", "([^"]+)", "([^"]+)"\)/g)].map(([, slug, label, root]) => ({ slug, label, root }));
    };
    const lists = popupCategories([], BUILT_IN_CATEGORIES, "2026-11-05");
    expect(section("debit")).toEqual(lists.debit);
    expect(section("credit")).toEqual(lists.credit);
  });

  it("matches Quick add's order, with every category and none cut off", () => {
    const entries = [
      ...Array.from({ length: 3 }, (_, index) => entry({ id: `c${index}`, categorySlug: "cafes" })),
      entry({ id: "r", categorySlug: "rent" }),
    ];
    const lists = popupCategories(entries, BUILT_IN_CATEGORIES, "2026-11-05");
    const quick = quickCategories(entries, BUILT_IN_CATEGORIES, { type: "debit", today: "2026-11-05" });
    expect(lists.debit.map((choice) => choice.slug)).toEqual([...quick.filter((slug) => slug !== "other"), "other"]);
    expect(lists.debit.slice(0, 3).map((choice) => choice.slug)).toEqual(["cafes", "rent", "food"]);
    expect(lists.debit.map((choice) => choice.slug)).toEqual(expect.arrayContaining(["emi", "insurance", "fees", "vices"]));
  });
});

describe("repeat messages for one payment", () => {
  const UPI = "Rs 250.00 debited from a/c **1234 on 05-11-26 to VPA swiggy@icici. UPI Ref 999912345678. -HDFC Bank";

  it("files a repeat as the same payment, not a second one", async () => {
    const { db, ctx } = await setup();
    await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED, answer: { type: "debit", categorySlug: "dinner" } }, await ctx());
    const outcome = await captureMessage(db, { text: UPI, receivedAt: RECEIVED, answer: { type: "debit", categorySlug: "dinner", repeat: true } }, await ctx());
    expect(outcome.status).toBe("duplicate");
    expect(await listEntries(db)).toHaveLength(1);
  });

  it("still adds a repeat when the first message never arrived", async () => {
    const { db, ctx } = await setup();
    const outcome = await captureMessage(db, { text: UPI, receivedAt: RECEIVED, answer: { type: "debit", repeat: true } }, await ctx());
    expect(outcome.status).toBe("added");
  });

  it("trusts the app's reader on money in or out over the popup's guess", async () => {
    const { db, ctx } = await setup();
    const refund = "Rs 499.00 credited to your a/c XX1234 on 05-11-26. Refund from AMAZON. -HDFC Bank";
    await captureMessage(db, { text: refund, receivedAt: RECEIVED, answer: { type: "debit" } }, await ctx());
    expect((await listEntries(db))[0]).toMatchObject({ type: "credit" });
  });
});

const run = process.env.CHECK_SWIFT === "1" ? describe : describe.skip;
run("the popup's paging and repeat rules in Swift", () => {
  it("pages long lists without a lone leftover, and spots repeats for three minutes", () => {
    const dir = mkdtempSync(join(tmpdir(), "ledgerline-swift-"));
    const binary = join(dir, "paging");
    const compiled = spawnSync(
      "swiftc",
      ["-o", binary, join(__dirname, "..", "plugins", "native", "CapturePaging.swift"), join(__dirname, "swift", "paging", "main.swift")],
      { encoding: "utf8" },
    );
    expect(compiled.stderr).toBe("");
    const out = JSON.parse(spawnSync(binary, { encoding: "utf8" }).stdout) as { pages: Record<string, number[][]>[]; decisions: Record<string, boolean> };
    expect(Object.assign({}, ...out.pages)).toEqual({
      "3": [[0, 3, 0]],
      "5": [[0, 5, 0]],
      "6": [[0, 6, 0]],
      "7": [[0, 5, 1], [5, 7, 0]],
      "12": [[0, 5, 1], [5, 12, 0]],
      "20": [[0, 5, 1], [5, 11, 1], [11, 17, 1], [17, 20, 0]],
    });
    expect(out.decisions).toEqual({ sameSoon: true, sameLater: false, otherAmount: false, otherWay: false, askedSoon: true, askedLater: false });
  }, 120_000);
});

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: "e", date: "2026-11-04", amount: 100, type: "debit", description: "Payment", merchant: null, payee: null, upiId: null,
    providerId: null, categorySlug: "food", classificationSource: "user_override", method: "upi", origin: "manual", note: null,
    messageRef: null, needsReview: false, splits: [], createdAt: "2026-11-04T10:00:00.000Z", updatedAt: "2026-11-04T10:00:00.000Z",
    ...overrides,
  } as Entry;
}
