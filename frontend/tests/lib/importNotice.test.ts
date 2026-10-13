import { describe, expect, it } from "vitest";
import { importNoticeFor } from "@/helpers/importNotice";

describe("importNoticeFor", () => {
  it("keeps the user on Import and explains a repeat upload", () => {
    const notice = importNoticeFor(
      { isDuplicate: true, inserted: 0, message: "You already imported this statement on 3 Oct 2026." },
      "sep.pdf",
    );
    expect(notice).toEqual({ text: "You already imported this statement on 3 Oct 2026.", showOverview: false });
  });

  it("says when a statement adds nothing new", () => {
    expect(importNoticeFor({ inserted: 0 }, "sep.pdf").showOverview).toBe(false);
  });

  it("counts new transactions and moves on", () => {
    expect(importNoticeFor({ inserted: 1 }, "sep.pdf")).toEqual({
      text: "Imported 1 new transaction from sep.pdf.",
      showOverview: true,
    });
  });
});
