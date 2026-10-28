import { describe, expect, it } from "vitest";
import { userInitials } from "@/helpers/userInitials";

describe("userInitials", () => {
  it("uses display name when present", () => {
    expect(userInitials({ displayName: "Devansh Goel" })).toBe("DG");
  });

  it("falls back to the Ledgerline initials", () => {
    expect(userInitials({ displayName: null })).toBe("LL");
  });
});
