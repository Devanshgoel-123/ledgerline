import { describe, expect, it } from "vitest";
import { backupAge, backupStatus } from "@/core/backupStatus";

const now = new Date("2026-11-07T12:00:00Z");

describe("backupStatus", () => {
  it("nudges when there's data and never a backup", () => {
    expect(backupStatus(null, 25, now)).toEqual({ daysSince: null, due: true });
  });

  it("stays quiet with only a few payments", () => {
    expect(backupStatus(null, 3, now).due).toBe(false);
  });

  it("is fine for a month, then due again", () => {
    expect(backupStatus("2026-10-20T12:00:00Z", 50, now)).toEqual({ daysSince: 18, due: false });
    expect(backupStatus("2026-10-07T11:00:00Z", 50, now)).toEqual({ daysSince: 31, due: true });
  });

  it("treats a broken date as never", () => {
    expect(backupStatus("not a date", 50, now).daysSince).toBeNull();
  });

  it("says when in words", () => {
    expect(backupAge(null)).toBe("never");
    expect(backupAge(0)).toBe("today");
    expect(backupAge(1)).toBe("yesterday");
    expect(backupAge(12)).toBe("12 days ago");
  });
});
