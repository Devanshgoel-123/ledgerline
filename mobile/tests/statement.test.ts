import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { BUILT_IN_CATEGORIES } from "@/core/catalog";
import type { Entry } from "@/core/model";
import { checkStatement, readStatement, statementText } from "@/core/statement";
import type { PdfTextItem } from "@/core/shared";
import { addEntry, ignoreLines, listEntries, listIgnoredLines, listRules, saveRule } from "@/db/repo";
import { hdfcStatement } from "@shared/../tests/helpers/statementPdf.js";
import { testDb } from "./helpers/nodeDb";

/** Same item extraction as the phone's PDF reader page. */
async function pdfPages(pdf: Buffer): Promise<PdfTextItem[][]> {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  const pages: PdfTextItem[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(
      content.items.flatMap((item) =>
        "str" in item && item.str.trim() ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }] : [],
      ),
    );
  }
  return pages;
}

const STATEMENT = hdfcStatement(20000, [
  { date: "2026-09-02", narration: "UPI-SWIGGY-swiggy@icici-ICIC0000001-600000000001-Payment", amount: 389, type: "debit" },
  { date: "2026-09-03", narration: "UPI-ASHA RAO-asha.rao@okaxis-UTIB0000001-600000000002-Lunch", amount: 250, type: "debit" },
  { date: "2026-09-05", narration: "UPI-ZOMATO-zomato@hdfcbank-HDFC0000001-600000000003-Order", amount: 640, type: "debit" },
  { date: "2026-09-08", narration: "UPI-KIRAN DAS-kiran@oksbi-SBIN0000001-600000000004-Rent share", amount: 250, type: "debit" },
  { date: "2026-09-10", narration: "NEFT CR-CITI0000001-EXAMPLE TECH-SALARY SEP", amount: 52000, type: "credit" },
]);

async function read() {
  return readStatement(statementText(await pdfPages(STATEMENT)));
}

function entry(partial: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(36),
    date: "2026-09-02",
    amount: 100,
    type: "debit",
    description: "",
    merchant: null,
    payee: null,
    upiId: null,
    providerId: null,
    categorySlug: "other",
    classificationSource: "user_override",
    method: "upi",
    origin: "manual",
    statementRef: null,
    note: null,
    splits: [],
    createdAt: "2026-09-02T10:00:00Z",
    updatedAt: "2026-09-02T10:00:00Z",
    ...partial,
  };
}

const base = { ignored: new Set<string>(), rules: [], categories: BUILT_IN_CATEGORIES };

describe("checking a statement against what you added", () => {
  it("reads every line of an HDFC statement PDF", async () => {
    const statement = await read();
    expect(statement.bank).toMatch(/HDFC/);
    expect(statement.lines).toHaveLength(5);
    expect([statement.from, statement.to]).toEqual(["2026-09-02", "2026-09-10"]);
  });

  it("lists every line when nothing was added, and suggests a category from the shop", async () => {
    const check = checkStatement({ ...base, statement: await read(), entries: [] });
    expect(check.missing).toHaveLength(5);
    const swiggy = check.missing.find((line) => line.amount === 389)!;
    expect(swiggy.suggestedCategory).toBe("food");
    expect(swiggy.merchant).toBe("Swiggy");
    expect(swiggy.upiId).toBe("swiggy@icici");
    expect(check.missing.every((line) => !line.needsCheck)).toBe(true);
    expect(check.missing.find((line) => line.amount === 52000)?.suggestedCategory).toBe("salary");
  });

  it("pairs an entry of the same amount on the day or the day beside it", async () => {
    const check = checkStatement({
      ...base,
      statement: await read(),
      entries: [
        entry({ date: "2026-09-02", amount: 389, description: "Swiggy" }),
        entry({ date: "2026-09-04", amount: 250, description: "Lunch with Asha" }),
        entry({ date: "2026-09-10", amount: 52000, type: "credit", description: "Salary" }),
      ],
    });
    expect(check.matchedCount).toBe(3);
    expect(check.missing.map((line) => line.amount).sort()).toEqual([250, 640]);
    // Two ₹250 lines and one ₹250 entry: one line is still missing (Kiran, 8 Sep).
    expect(check.missing.find((line) => line.amount === 250)?.date).toBe("2026-09-08");
  });

  it("never pairs a cash entry, because cash is not in a statement", async () => {
    const check = checkStatement({
      ...base,
      statement: await read(),
      entries: [entry({ date: "2026-09-05", amount: 640, method: "cash", description: "Cash dinner" })],
    });
    expect(check.missing.some((line) => line.amount === 640)).toBe(true);
  });

  it("does not list lines you skipped or already added from this statement", async () => {
    const db = await testDb();
    const statement = await read();
    const first = checkStatement({ ...base, statement, entries: [] });
    const zomato = first.missing.find((line) => line.amount === 640)!;
    const salary = first.missing.find((line) => line.amount === 52000)!;
    await addEntry(db, {
      date: zomato.date,
      amount: zomato.amount,
      type: zomato.type,
      description: zomato.description,
      merchant: zomato.merchant,
      categorySlug: "outing",
      method: "upi",
      origin: "statement",
      statementRef: zomato.key,
    });
    await ignoreLines(db, [salary.key]);
    const second = checkStatement({
      ...base,
      statement,
      entries: await listEntries(db),
      ignored: await listIgnoredLines(db),
    });
    expect(second.missing.map((line) => line.amount).sort((a, b) => a - b)).toEqual([250, 250, 389]);
    expect(second.ignoredCount).toBe(1);
  });

  it("uses a category rule you made over the shop catalog", async () => {
    const db = await testDb();
    await saveRule(db, {
      name: "Swiggy",
      matchUpiId: "swiggy@icici",
      matchNarrationRe: null,
      setCategorySlug: "outing",
      setPayeeName: null,
    });
    const check = checkStatement({ ...base, statement: await read(), entries: [], rules: await listRules(db) });
    expect(check.missing.find((line) => line.amount === 389)?.suggestedCategory).toBe("outing");
  });

  it("explains a PDF it cannot read", () => {
    expect(() => readStatement("")).toThrow(/scan or a photo/);
    expect(() => readStatement("Some other bank\n01/09/26 thing 10.00")).toThrow(/HDFC and ICICI/);
  });
});
