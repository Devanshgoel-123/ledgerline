import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStatementLines } from "../../src/parser.js";

const rows = (text: string) =>
  parseStatementLines(text).map((l) => [l.date, l.type, l.amount, l.closingBalance, l.balanceOk]);

describe("statement row formats", () => {
  it("reads DD/MM/YYYY dates", () => {
    assert.deepEqual(
      rows([
        "Opening Balance 1,000.00",
        "05/09/2026 UPI-X-x@okaxis 0000123456789017 05/09/2026 100.00 900.00",
        "06/09/2026 NEFT CR-ACME 0000123456789018 06/09/2026 2,000.00 2,900.00",
      ].join("\n")),
      [
        ["2026-09-05", "debit", 100, 900, true],
        ["2026-09-06", "credit", 2000, 2900, true],
      ],
    );
  });

  it("reads whole-rupee and one-decimal amounts in the amount columns", () => {
    assert.deepEqual(
      rows([
        "Opening Balance 1,000.00",
        "05/09/26 UPI-X-x@okaxis 0000123456789017 05/09/26 500 500",
        "06/09/26 UPI-Y-y@okaxis 0000123456789018 06/09/26 99.5 400.5",
        "07/09/26 NEFT CR-ACME 0000123456789019 07/09/26 1,00,000 1,00,400.5",
      ].join("\n")),
      [
        ["2026-09-05", "debit", 500, 500, true],
        ["2026-09-06", "debit", 99.5, 400.5, true],
        ["2026-09-07", "credit", 100000, 100400.5, true],
      ],
    );
  });

  it("does not take numbers inside the narration for amounts", () => {
    assert.deepEqual(
      rows([
        "Opening Balance 1,000.00",
        "05/09/26 UPI-RAVI 9876543210-9876543210@ybl 0000123456789017 05/09/26 250 750",
      ].join("\n")),
      [["2026-09-05", "debit", 250, 750, true]],
    );
  });

  it("still joins a wrapped narration onto its row", () => {
    const parsed = parseStatementLines(
      [
        "Opening Balance 1,000.00",
        "05/09/2026 UPI-SWIGGY-swiggy@icici-ICIC0000001 0000123456789017 05/09/2026 100 900",
        "TRIP-12345 food order",
        "06/09/2026 UPI-ZEPTO-zepto@ybl 0000123456789018 06/09/2026 50 850",
      ].join("\n"),
    );
    assert.equal(parsed.length, 2);
    assert.match(parsed[0]!.description, /SWIGGY/);
    assert.equal(parsed[1]!.amount, 50);
  });
});
