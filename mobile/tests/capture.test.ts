import { describe, expect, it } from "vitest";
import { captureMessage, captureMessages } from "@/core/capture";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
import { exportBackup, parseBackup, restoreBackup } from "@/db/backup";
import { addEntry, clearIgnoredLines, dismissCaptured, listEntries, listIgnoredLines, markReviewed, updateEntry } from "@/db/repo";
import { testDb } from "./helpers/nodeDb";

const SWIGGY = "Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 05/11/26 Ref 532912345678 Not You? Call 18002586161";
const RECEIVED = new Date("2026-11-05T13:00:00+05:30");

async function setup() {
  const db = await testDb();
  const ctx = async () => ({ entries: await listEntries(db), rules: [], categories: BUILT_IN_CATEGORIES });
  return { db, ctx };
}

describe("capturing bank messages", () => {
  it("adds a payment, marked for review, with a category", async () => {
    const { db, ctx } = await setup();
    const outcome = await captureMessage(db, { text: SWIGGY, sender: "AD-HDFCBK", receivedAt: RECEIVED }, await ctx());
    expect(outcome.status).toBe("added");
    const [entry] = await listEntries(db);
    expect(entry).toMatchObject({
      amount: 250,
      type: "debit",
      date: "2026-11-05",
      description: "SWIGGY",
      categorySlug: "food",
      needsReview: true,
      messageRef: "ref:532912345678",
      method: "upi",
    });
  });

  it("names a known shop by its own name, even when the SMS only has a UPI id", async () => {
    const { db, ctx } = await setup();
    const netflix = "Sent Rs.649.00 from Kotak Bank AC X1234 to netflix@hdfcbank on 07-11-26.UPI Ref 630777777777. Not you, https://kotak.com/KBANKT/Fraud";
    await captureMessage(db, { text: netflix, sender: "AD-KOTAKB", receivedAt: RECEIVED }, await ctx());
    await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    const names = (await listEntries(db)).map((entry) => [entry.merchant, entry.categorySlug, entry.note]);
    expect(names).toContainEqual(["Netflix", "subscriptions", "From Kotak SMS · 1234"]);
    expect(names.map((row) => row[0])).toContain("Swiggy");
  });

  it("never adds the same message twice", async () => {
    const { db, ctx } = await setup();
    await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    const again = await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    expect(again.status).toBe("duplicate");
    expect(await listEntries(db)).toHaveLength(1);
  });

  it("links to a payment you already added by hand instead of adding it again", async () => {
    const { db, ctx } = await setup();
    const id = await addEntry(db, { date: "2026-11-04", amount: 250, type: "debit", description: "Lunch", categorySlug: "food", method: "upi" });
    const outcome = await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    expect(outcome).toMatchObject({ status: "linked", entryId: id });
    const entries = await listEntries(db);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ description: "Lunch", messageRef: "ref:532912345678", needsReview: false });
  });

  it("doesn't link to cash, or to a different amount", async () => {
    const { db, ctx } = await setup();
    await addEntry(db, { date: "2026-11-05", amount: 250, type: "debit", description: "Chai", categorySlug: "food", method: "cash" });
    await addEntry(db, { date: "2026-11-05", amount: 251, type: "debit", description: "Other", categorySlug: "food", method: "upi" });
    expect((await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx())).status).toBe("added");
  });

  it("ignores messages that aren't payments", async () => {
    const { db, ctx } = await setup();
    const otp = "123456 is your OTP for txn of Rs 500.00 at AMAZON. Do not share OTP";
    expect((await captureMessage(db, { text: otp, receivedAt: RECEIVED }, await ctx())).status).toBe("not-a-payment");
    expect(await listEntries(db)).toHaveLength(0);
  });

  it("a dismissed capture stays gone, even after clearing skipped statement lines", async () => {
    const { db, ctx } = await setup();
    const first = await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    await dismissCaptured(db, first.status === "added" ? first.entryId : "");
    await clearIgnoredLines(db);
    expect((await listIgnoredLines(db)).size).toBe(0);
    expect((await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx())).status).toBe("duplicate");
    expect(await listEntries(db)).toHaveLength(0);
  });

  it("reviewing or editing clears the review mark", async () => {
    const { db, ctx } = await setup();
    const a = await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    const b = await captureMessage(
      db,
      { text: "ICICI Bank Acct XX123 debited for Rs 450.00 on 04-Nov-26; Zomato credited. UPI:532912345680.", receivedAt: RECEIVED },
      await ctx(),
    );
    if (a.status !== "added" || b.status !== "added") throw new Error("expected both added");
    await markReviewed(db, [a.entryId]);
    const zomato = (await listEntries(db)).find((e) => e.id === b.entryId)!;
    await updateEntry(db, zomato.id, { ...zomato, categorySlug: "dinner" });
    expect((await listEntries(db)).every((e) => !e.needsReview)).toBe(true);
  });

  it("captures a batch in order without double counting", async () => {
    const { db, ctx } = await setup();
    const outcomes = await captureMessages(
      db,
      [{ text: SWIGGY, receivedAt: RECEIVED }, { text: SWIGGY, receivedAt: RECEIVED }, { text: "hello", receivedAt: RECEIVED }],
      await ctx(),
      () => listEntries(db),
    );
    expect(outcomes.map((o) => o.status)).toEqual(["added", "duplicate", "not-a-payment"]);
  });

  it("survives a backup and restore", async () => {
    const { db, ctx } = await setup();
    await captureMessage(db, { text: SWIGGY, receivedAt: RECEIVED }, await ctx());
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    const other = await testDb();
    await restoreBackup(other, backup);
    expect((await listEntries(other))[0]).toMatchObject({ messageRef: "ref:532912345678", needsReview: true });
    expect((await captureMessage(other, { text: SWIGGY, receivedAt: RECEIVED }, await ctx())).status).toBe("duplicate");
  });
});
