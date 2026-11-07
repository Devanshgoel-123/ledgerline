import { describe, expect, it } from "vitest";
import {
  detectDelimiter,
  guessColumns,
  linesFromTable,
  looksBinary,
  parseDelimited,
  parseMoney,
  parseStatementDate,
  readCsvStatement,
} from "@/core/csvStatement";

// Header rows and a few lines in the shape each bank's net-banking export uses.
const SBI = [
  "Account Name\t:\tMr. Test Person",
  "Account Number\t:\t_00000012345",
  "State Bank of India",
  "",
  "Txn Date\tValue Date\tDescription\tRef No./Cheque No.\tDebit\tCredit\tBalance",
  "1 Nov 2026\t1 Nov 2026\tTO TRANSFER-UPI/DR/630512345678/SWIGGY/YESB/swiggy@ybl/Payment--\tTRANSFER TO 4897\t452.00\t\t10,048.00",
  "3 Nov 2026\t3 Nov 2026\tBY TRANSFER-NEFT*ACME CORP*SALARY OCT--\tTRANSFER FROM 1234\t\t65,000.00\t75,048.00",
  "**This is a computer generated statement**",
].join("\n");

const HDFC = [
  "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
  '02/11/26,"UPI-ZOMATO LTD-ZOMATO.PAYU@HDFCBANK-HDFC0MERUPI-630611111111-ORDER",0000630611111111,02/11/26,"1,249.50",,"8,750.50"',
  "04/11/26,ATW-512345XXXXXX1234-S1ANBG12-BENGALURU,0000000001234,04/11/26,2000.00,,6750.50",
].join("\n");

const ICICI = [
  "S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )",
  "1,05/11/2026,05/11/2026,-,UPI/630733333333/Uber India/uber@icici/Payment,312.00,0.00,4500.00",
  "2,06/11/2026,06/11/2026,-,UPI/630744444444/Refund/flipkart@axis/Refund,0.00,999.00,5499.00",
].join("\n");

const AXIS = [
  "Tran Date,CHQNO,PARTICULARS,DR,CR,BAL,SOL",
  "07-11-2026,,UPI/P2M/630755555555/BLINKIT/Groceries,689.00,,9311.00,1234",
  "07-11-2026,,UPI/P2A/630766666666/RAHUL KUMAR/Dinner split,,500.00,9811.00,1234",
].join("\n");

const KOTAK = [
  "Sl. No.,Transaction Date,Value Date,Description,Chq / Ref No.,Amount,Dr / Cr,Balance,Dr / Cr",
  "1,08-11-2026,08-11-2026,UPI/NETFLIX/630777777777,UPI-630777777777,649.00,DR,12000.00,CR",
  "2,09-11-2026,09-11-2026,IMPS-REFUND-AMAZON,IMPS-630788888888,1200.00,CR,13200.00,CR",
].join("\n");

describe("reading the table", () => {
  it("detects tabs, commas, and quoted commas inside amounts", () => {
    expect(detectDelimiter(SBI)).toBe("\t");
    expect(detectDelimiter(HDFC)).toBe(",");
    const rows = parseDelimited(HDFC);
    expect(rows[1]![4]).toBe("1,249.50");
    expect(rows[1]).toHaveLength(7);
  });

  it("keeps a quoted cell that runs over two lines together", () => {
    const rows = parseDelimited('Date,Narration,Debit\n01/11/2026,"UPI line one\nline two",10');
    expect(rows).toHaveLength(2);
    expect(rows[1]![1]).toBe("UPI line one\nline two");
  });

  it("refuses real Excel workbooks with a way out", () => {
    expect(looksBinary("PK\u0003\u0004rest")).toBe(true);
    expect(() => readCsvStatement("PK\u0003\u0004rest")).toThrow(/save it as CSV/);
  });
});

describe("columns", () => {
  it("prefers the transaction date and reads debit before a plain amount", () => {
    const map = guessColumns(["S No.", "Value Date", "Transaction Date", "Transaction Remarks", "Withdrawal Amount (INR )", "Deposit Amount (INR )", "Balance (INR )"]);
    expect(map).toEqual({ date: 2, description: 3, debit: 4, credit: 5, balance: 6 });
  });

  it("finds amount plus Dr/Cr, taking the first Dr/Cr column", () => {
    const map = guessColumns(KOTAK.split("\n")[0]!.split(","));
    expect(map.amount).toBe(5);
    expect(map.direction).toBe(6);
    expect(map.balance).toBe(7);
  });
});

describe("values", () => {
  it.each([
    ["07/11/2026", "2026-11-07"],
    ["07-11-26", "2026-11-07"],
    ["7 Nov 2026", "2026-11-07"],
    ["07-Nov-2026", "2026-11-07"],
    ["07 November 26", "2026-11-07"],
    ["2026-11-07", "2026-11-07"],
    ["Nov 7, 2026", "2026-11-07"],
    ["07/11/2026 14:32:10", "2026-11-07"],
  ])("reads %s as %s", (cell, iso) => {
    expect(parseStatementDate(cell)).toBe(iso);
  });

  it("rejects things that aren't dates", () => {
    expect(parseStatementDate("31/02/2026")).toBeNull();
    expect(parseStatementDate("Opening Balance")).toBeNull();
    expect(parseStatementDate("")).toBeNull();
  });

  it("reads Indian amounts, markers and blanks", () => {
    expect(parseMoney("₹1,23,456.78")).toEqual({ value: 123456.78, sign: 0 });
    expect(parseMoney("250.00 Dr")).toEqual({ value: 250, sign: -1 });
    expect(parseMoney("250 CR")).toEqual({ value: 250, sign: 1 });
    expect(parseMoney("(99.5)")).toEqual({ value: 99.5, sign: -1 });
    expect(parseMoney("-")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
});

describe("whole statements", () => {
  const read = (text: string, name = "") => {
    const { table, map } = readCsvStatement(text);
    expect(map).not.toBeNull();
    return linesFromTable(table, map!, name);
  };

  it("SBI: tab-separated with an account preamble", () => {
    const { statement } = read(SBI);
    expect(statement.bank).toBe("SBI");
    expect(statement.lines).toHaveLength(2);
    expect(statement.lines[0]).toMatchObject({ date: "2026-11-01", amount: 452, type: "debit" });
    expect(statement.lines[1]).toMatchObject({ date: "2026-11-03", amount: 65000, type: "credit" });
    expect(statement.from).toBe("2026-11-01");
    expect(statement.to).toBe("2026-11-03");
  });

  it("HDFC: two-digit years and quoted amounts", () => {
    const { statement } = read(HDFC, "HDFC_Statement_Nov.csv");
    expect(statement.lines.map((line) => [line.date, line.amount, line.type])).toEqual([
      ["2026-11-02", 1249.5, "debit"],
      ["2026-11-04", 2000, "debit"],
    ]);
    expect(statement.lines[0]!.closingBalance).toBe(8750.5);
  });

  it("ICICI: zero in the other column doesn't count", () => {
    const { statement } = read(ICICI);
    expect(statement.lines.map((line) => [line.amount, line.type])).toEqual([
      [312, "debit"],
      [999, "credit"],
    ]);
  });

  it("Axis: DR and CR columns", () => {
    const { statement } = read(AXIS);
    expect(statement.lines.map((line) => line.type)).toEqual(["debit", "credit"]);
  });

  it("Kotak: one amount column with Dr/Cr beside it", () => {
    const { statement } = read(KOTAK);
    expect(statement.bank).toBe("Bank statement");
    expect(statement.lines.map((line) => [line.amount, line.type])).toEqual([
      [649, "debit"],
      [1200, "credit"],
    ]);
  });

  it("asks for the columns when the header names are unknown", () => {
    const text = "When,What,Out,In\n01/11/2026,Coffee,120,\n02/11/2026,Refund,,50";
    const { table, map } = readCsvStatement(text);
    expect(map).toBeNull();
    const { statement } = linesFromTable(table, { date: 0, description: 1, debit: 2, credit: 3 });
    expect(statement.lines).toHaveLength(2);
  });

  it("explains a wrong column choice", () => {
    const { table } = readCsvStatement(HDFC);
    expect(() => linesFromTable(table, { date: 1, description: 0, debit: 4 })).toThrow(/No payments found/);
  });
});
