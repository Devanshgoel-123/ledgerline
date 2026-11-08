import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Entry } from "@/core/model";
import { todayActivityProps, todayStats, type TodayStats } from "@/core/today";

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(36),
    date: "2026-11-08",
    amount: 100,
    type: "debit",
    description: "Payment",
    merchant: null,
    payee: null,
    upiId: null,
    providerId: null,
    categorySlug: "food",
    classificationSource: "user_override",
    method: "upi",
    origin: "manual",
    note: null,
    messageRef: null,
    needsReview: false,
    splits: [],
    createdAt: "2026-11-08T10:00:00.000Z",
    updatedAt: "2026-11-08T10:00:00.000Z",
    ...overrides,
  } as Entry;
}

describe("Today on the Lock Screen", () => {
  it("counts today's spending, not transfers, samples or other days", () => {
    const stats = todayStats(
      [
        entry({ amount: 640, merchant: "Swiggy", createdAt: "2026-11-08T12:00:00.000Z" }),
        entry({ amount: 600 }),
        entry({ amount: 5000, categorySlug: "self-transfer" }),
        entry({ amount: 900, date: "2026-11-07", needsReview: true }),
        entry({ amount: 300, origin: "sample" }),
        entry({ amount: 20000, type: "credit", categorySlug: "salary" }),
      ],
      "2026-11-08",
      2000,
    );
    expect(stats).toEqual({ date: "2026-11-08", spent: 1240, count: 2, toSort: 1, limit: 2000, last: "₹640 · Swiggy" });
    expect(todayActivityProps(stats)).toEqual({
      spent: "₹1,240",
      detail: "2 payments · ₹760 left",
      toSort: "1 to sort",
      progress: 0.62,
      over: false,
      last: "Last: ₹640 · Swiggy",
    });
  });

  it("says when you're over the limit, and reads cleanly with nothing yet", () => {
    expect(todayActivityProps({ date: "d", spent: 2500, count: 1, toSort: 0, limit: 2000, last: null })).toMatchObject({
      detail: "1 payment · ₹500 over",
      progress: 1,
      over: true,
      toSort: "",
      last: "",
    });
    expect(todayActivityProps({ date: "d", spent: 0, count: 0, toSort: 0, limit: null, last: null })).toMatchObject({
      spent: "₹0",
      detail: "No payments yet",
      progress: -1,
    });
  });
});

// The popup redraws the activity in Swift (plugins/native/TodayStats.swift).
const run = process.env.CHECK_SWIFT === "1" ? describe : describe.skip;
run("Swift Today numbers", () => {
  it("say the same as the app's", () => {
    const cases: TodayStats[] = [
      { date: "2026-11-08", spent: 1240, count: 2, toSort: 1, limit: 2000, last: "₹640 · Swiggy" },
      { date: "2026-11-08", spent: 125000.5, count: 1, toSort: 0, limit: 2000, last: null },
      { date: "2026-11-08", spent: 0, count: 0, toSort: 3, limit: null, last: null },
    ];
    const dir = mkdtempSync(join(tmpdir(), "ledgerline-today-"));
    const binary = join(dir, "today");
    const compiled = spawnSync(
      "swiftc",
      ["-o", binary, join(__dirname, "..", "plugins", "native", "TodayStats.swift"), join(__dirname, "swift", "today", "main.swift")],
      { encoding: "utf8" },
    );
    expect(compiled.stderr).toBe("");
    const swift = JSON.parse(spawnSync(binary, { input: JSON.stringify(cases), encoding: "utf8" }).stdout) as unknown[];
    cases.forEach((stats, index) => expect(swift[index]).toEqual(todayActivityProps(stats)));
    // A new day starts from zero, then counts the popup's payment.
    expect(swift[3]).toEqual(
      todayActivityProps({ date: "2026-11-09", spent: 640, count: 1, toSort: 2, limit: 2000, last: "₹640 · Food & dining" }),
    );
  }, 120_000);
});
