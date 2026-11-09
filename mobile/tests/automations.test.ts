import { describe, expect, it } from "vitest";
import { captureStatus, noteMessages, NOTHING_SEEN, whenSeen } from "@/core/automations";

const at = (iso: string) => new Date(iso);

describe("which iOS automations have fired", () => {
  it("ticks each word when a message with it arrives, keeping the latest", () => {
    let seen = noteMessages(NOTHING_SEEN, [{ text: "INR 5.00 debited A/c no. XX0483", receivedAt: at("2026-11-09T10:00:00Z") }], new Date());
    seen = noteMessages(seen, [
      { text: "Rs.600 Credited to A/c ...1234 thru UPI", receivedAt: at("2026-11-09T11:00:00Z") },
      { text: "AutoPay for Netflix processed", receivedAt: at("2026-11-09T09:00:00Z") },
      { text: "INR 9.00 debited", receivedAt: at("2026-11-08T10:00:00Z") },
    ], new Date());
    expect(seen).toEqual({
      lastRun: "2026-11-09T11:00:00.000Z",
      words: { debited: "2026-11-09T10:00:00.000Z", credited: "2026-11-09T11:00:00.000Z", autopay: "2026-11-09T09:00:00.000Z" },
    });
  });

  it("is off until something arrives, on after, and flags a run without the message", () => {
    expect(captureStatus(NOTHING_SEEN, { emptySince: null, lastCaptured: null }).state).toBe("off");
    // Set up before this screen tracked words: still on.
    const before = captureStatus(NOTHING_SEEN, { emptySince: null, lastCaptured: "2026-11-09T10:00:00Z" });
    expect(before).toMatchObject({ state: "on", lastRun: "2026-11-09T10:00:00Z" });
    expect(before.automations.map((automation) => automation.seenAt)).toEqual([null, null, null]);
    expect(captureStatus(NOTHING_SEEN, { emptySince: "2026-11-09T12:00:00Z", lastCaptured: "2026-11-09T10:00:00Z" }).state).toBe("no-text");
  });

  it("says when, the short way", () => {
    const now = new Date(2026, 10, 9, 20, 0);
    expect(whenSeen(new Date(2026, 10, 9, 19, 12).toISOString(), now)).toBe("today, 7:12 PM");
    expect(whenSeen(new Date(2026, 10, 8, 9, 0).toISOString(), now)).toBe("yesterday");
    expect(whenSeen(new Date(2026, 10, 2, 9, 0).toISOString(), now)).toMatch(/2 Nov/);
  });
});
