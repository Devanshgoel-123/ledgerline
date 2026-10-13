import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bankAdapters, detectAdapter } from "../../src/adapters/index.js";
import { extractTextFromPdf } from "../../src/parser.js";
import { hdfcStatement, iciciStatement, type IciciRow } from "../helpers/statementPdf.js";

/** Made-up rows in the shapes ICICI prints (1 to 4 wrapped PARTICULARS lines). */
const ROWS: IciciRow[] = [
  {
    date: "2026-09-12",
    particulars: [
      "UPI/ASHA RAO/XX0001@axl/Sent using/CANARA",
      "BAN/600000000001/PTM00000000000000000000001",
      "0000000001ASHA RAO",
    ],
    amount: 75,
    type: "debit",
  },
  {
    date: "2026-09-12",
    particulars: [
      "UPI/KIRAN DAS/XX0002@oksbi/UPI/State",
      "Bank/600000000002/SBI0000000000000000000002",
      "000000002KIRAN DAS",
    ],
    amount: 400,
    type: "credit",
  },
  {
    date: "2026-09-13",
    particulars: [
      "UPI/RBP WINE A/XX0003@ybl/Sent using/YES",
      "BANK",
      "L/600000000003/PTM0000000000000000000003",
      "000000003RBP WINE AND SPIRIT MRP",
    ],
    amount: 2605,
    type: "debit",
  },
  {
    date: "2026-09-14",
    particulars: ["UPI/Swiggy Ins/XX.rzp@rxairte/Pay Via Ra/AIRTEL", "PAY/600000000004/PTM000000000000000000004"],
    amount: 129,
    type: "debit",
  },
  { date: "2026-09-23", particulars: ["SMSChgsApr26-Jun26+GST"], amount: 56.64, type: "debit" },
  {
    date: "2026-09-25",
    particulars: [
      "NEFT-CITIN00000000001-EXAMPLE TECH",
      "PRIVATE LIMITED-SALARY - SEP26-0000000001-",
      "CITI0000004EXAMPLE TECH PRIVATE",
    ],
    amount: 90000,
    type: "credit",
  },
  // Second page from here.
  { date: "2026-09-25", particulars: ["ACH/PMPL FIN DIV 25 26/00000001"], amount: 90, type: "credit" },
  {
    date: "2026-09-26",
    particulars: [
      "UPI/CAFE ONE/XX0004@hdfcban/Sent",
      "using/HDFC",
      "BANK/600000000005/PTM0000000000000000005",
      "0000000000004CAFE ONE",
    ],
    amount: 252,
    type: "debit",
  },
];

async function linesFor(pdf: Buffer) {
  const text = await extractTextFromPdf(pdf, "");
  const adapter = detectAdapter(text, bankAdapters);
  return { adapter, text, lines: adapter.extractLines(text) };
}

describe("ICICI statement PDFs", () => {
  it("is read by the ICICI adapter even though narrations mention HDFC", async () => {
    const { adapter, text } = await linesFor(iciciStatement(7072.75, ROWS));
    assert.match(text, /hdfc/i, "the fixture must contain the word that used to fool HDFC detection");
    assert.equal(adapter.id, "icici");
  });

  it("reads every row with the right date, amount, direction and balance", async () => {
    const { lines } = await linesFor(iciciStatement(7072.75, ROWS));
    assert.equal(lines.length, ROWS.length, "B/F is not a payment and no row is lost or split");
    let balance = 7072.75;
    lines.forEach((line, i) => {
      const row = ROWS[i]!;
      balance = Math.round((balance + (row.type === "credit" ? row.amount : -row.amount)) * 100) / 100;
      assert.equal(line.date, row.date, `row ${i} date`);
      assert.equal(line.amount, row.amount, `row ${i} amount`);
      assert.equal(line.type, row.type, `row ${i} direction`);
      assert.equal(line.closingBalance, balance, `row ${i} balance`);
      assert.equal(line.balanceOk, true, `row ${i} balance chain`);
    });
  });

  it("keeps each wrapped description whole and on its own row", async () => {
    const { lines } = await linesFor(iciciStatement(7072.75, ROWS));
    lines.forEach((line, i) => {
      const row = ROWS[i]!;
      assert.ok(line.description.startsWith(row.particulars[0]!), `row ${i} starts with its first line`);
      assert.ok(line.description.endsWith(row.particulars.at(-1)!), `row ${i} ends with its last line`);
      assert.doesNotMatch(line.description, /MR\.TEST|Page \d|ICICI Bank khayaal|PARTICULARS/, `row ${i} has no page furniture`);
    });
    assert.equal(lines[0]!.upiId, "xx0001@axl");
    assert.equal(lines[4]!.description, "SMSChgsApr26-Jun26+GST");
  });

  it("still sends HDFC statements to the HDFC adapter", async () => {
    const { adapter } = await linesFor(
      hdfcStatement(1000, [{ date: "2026-09-01", narration: "UPI-SHOP-shop@ybl-YESB0000001", amount: 50, type: "debit" }]),
    );
    assert.equal(adapter.id, "hdfc");
  });
});
