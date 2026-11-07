/**
 * Bank statements as spreadsheets: the CSV (or tab-separated "XLS") file most
 * Indian banks let you download from net banking. Any bank works: the header
 * row is found and its columns recognised by name, and when a bank names
 * them in a way Ledgerline doesn't know, you pick the columns yourself.
 *
 * The result is the same ReadStatement the PDF reader produces, so the
 * statement check (matching, categories, skipping) is shared.
 */
import type { ReadStatement } from "./statement";
import type { StatementLine } from "./shared";

export type ColumnRole = "date" | "description" | "debit" | "credit" | "amount" | "direction" | "balance";

/** Which column holds what. `amount` + `direction` is the alternative to `debit` + `credit`. */
export type ColumnMap = Partial<Record<ColumnRole, number>>;

export interface CsvTable {
  /** The header row's cells. */
  headers: string[];
  /** Rows below the header, as cells. */
  rows: string[][];
  /** Text above the header row: account details, sometimes the bank's name. */
  preamble: string;
}

// ---------------------------------------------------------------- reading

/** Spreadsheet files that aren't text: real .xls (BIFF) and .xlsx (zip). */
export function looksBinary(text: string): boolean {
  return text.startsWith("PK") || text.startsWith("ÐÏ\u0011à") || text.slice(0, 2000).includes("\u0000");
}

/** Comma, tab, semicolon or pipe: whichever splits the lines most evenly. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 60);
  let best = ",";
  let bestScore = -1;
  for (const delimiter of [",", "\t", ";", "|"]) {
    const counts = lines.map((line) => splitRow(line, delimiter).length).filter((n) => n > 1);
    if (!counts.length) continue;
    // The most common column count, weighted by how often it appears.
    const freq = new Map<number, number>();
    for (const n of counts) freq.set(n, (freq.get(n) ?? 0) + 1);
    const [cols, times] = [...freq].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
    const score = times * Math.min(cols, 12);
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** One line into cells. Quotes, doubled quotes and delimiters inside quotes are handled. */
function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

/** Rows of cells. A quoted cell may run over several lines. */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let pending = "";
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    pending = pending ? `${pending}\n${raw}` : raw;
    // An odd number of quotes means a quoted cell is still open.
    if ((pending.match(/"/g)?.length ?? 0) % 2 === 1) continue;
    if (pending.trim()) rows.push(splitRow(pending, delimiter));
    pending = "";
  }
  if (pending.trim()) rows.push(splitRow(pending, delimiter));
  return rows;
}

// ---------------------------------------------------------------- columns

const norm = (cell: string) => cell.toLowerCase().replace(/[^a-z/]+/g, " ").trim();

const PATTERNS: Record<ColumnRole, RegExp[]> = {
  // Transaction date before value date: the day you paid, not the day it settled.
  date: [/^(txn|tran|transaction|trans) ?date/, /^date$/, /^posting date/, /^value date/, /date/],
  description: [/narration/, /description/, /particulars/, /remarks/, /transaction details/, /^details/],
  debit: [/withdrawal/, /^debit/, /^dr( amount)?$/, /amount ?\(?dr\)?/, /money out/, /paid out/],
  credit: [/deposit/, /^credit/, /^cr( amount)?$/, /amount ?\(?cr\)?/, /money in/, /paid in/],
  amount: [/^(transaction |txn )?amount/, /^amt/],
  direction: [/^(dr ?\/ ?cr|cr ?\/ ?dr)$/, /^(debit ?\/ ?credit|type|txn type|transaction type)$/],
  balance: [/balance/],
};

/** Columns recognised from a header row, or null where none fits. */
export function guessColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const taken = new Set<number>();
  // Debit and credit before amount, so "Withdrawal Amount" isn't read as the amount.
  for (const role of ["date", "debit", "credit", "balance", "direction", "description", "amount"] as ColumnRole[]) {
    for (const pattern of PATTERNS[role]) {
      const index = headers.findIndex((header, i) => !taken.has(i) && pattern.test(norm(header)));
      if (index >= 0) {
        map[role] = index;
        taken.add(index);
        break;
      }
    }
  }
  return map;
}

/** Enough columns to read payments: a date, a description, and money out/in. */
export function mapIsUsable(map: ColumnMap): boolean {
  const money = (map.debit !== undefined || map.credit !== undefined) || map.amount !== undefined;
  return map.date !== undefined && map.description !== undefined && money;
}

/** The header row: the first row that names a date and some money columns. */
export function findTable(rows: string[][]): CsvTable | null {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const map = guessColumns(rows[i]!);
    if (mapIsUsable(map)) {
      return {
        headers: rows[i]!,
        rows: rows.slice(i + 1),
        preamble: rows.slice(0, i).map((row) => row.join(" ")).join("\n"),
      };
    }
  }
  return null;
}

/** Without a recognisable header: the widest row near the top stands in for it. */
export function fallbackTable(rows: string[][]): CsvTable | null {
  if (!rows.length) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const index = rows.findIndex((row) => row.length === width);
  return { headers: rows[index]!, rows: rows.slice(index + 1), preamble: rows.slice(0, index).map((row) => row.join(" ")).join("\n") };
}

// ---------------------------------------------------------------- values

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

function validDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * A statement date as YYYY-MM-DD. Indian banks write the day first:
 * 07/11/2026, 07-11-26, 07-Nov-2026, 07 Nov 26, and sometimes 2026-11-07.
 * A time after the date is ignored.
 */
export function parseStatementDate(cell: string): string | null {
  const text = cell.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i, "");
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(text);
  if (m) return validDate(+m[3]!, +m[2]!, +m[1]!);
  m = /^(\d{1,2})[-/. ]?([a-z]{3,9})[-/., ]+(\d{2}|\d{4})$/i.exec(text);
  if (m) {
    const month = MONTHS[m[2]!.slice(0, 3).toLowerCase()];
    return month ? validDate(+m[3]!, month, +m[1]!) : null;
  }
  m = /^([a-z]{3,9})[ -](\d{1,2}),? (\d{4})$/i.exec(text);
  if (m) {
    const month = MONTHS[m[1]!.slice(0, 3).toLowerCase()];
    return month ? validDate(+m[3]!, month, +m[2]!) : null;
  }
  return null;
}

/** ₹1,23,456.78, 1234.5 Dr, (250.00), -250 → a number; empty or "-" → null. */
export function parseMoney(cell: string | undefined): { value: number; sign: -1 | 1 | 0 } | null {
  if (!cell) return null;
  const text = cell.trim();
  if (!text || /^[-–—]$/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  const marker = /\bdr\.?$/i.test(text) ? -1 : /\bcr\.?$/i.test(text) ? 1 : 0;
  const digits = text.replace(/[^0-9.]/g, "");
  if (!digits || !/\d/.test(digits)) return null;
  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value)) return null;
  return { value: Math.round(value * 100) / 100, sign: negative ? -1 : (marker as -1 | 1 | 0) };
}

function directionOf(cell: string | undefined): "debit" | "credit" | null {
  const text = (cell ?? "").trim().toLowerCase();
  if (/^(dr|d|debit|withdrawal|out)\.?$/.test(text)) return "debit";
  if (/^(cr|c|credit|deposit|in)\.?$/.test(text)) return "credit";
  return null;
}

// ---------------------------------------------------------------- lines

const BANKS: [RegExp, string][] = [
  [/state bank of india|\bsbi\b/i, "SBI"],
  [/axis bank/i, "Axis Bank"],
  [/kotak/i, "Kotak"],
  [/hdfc bank/i, "HDFC Bank"],
  [/icici bank/i, "ICICI Bank"],
  [/yes bank/i, "Yes Bank"],
  [/idfc first/i, "IDFC FIRST Bank"],
  [/indusind/i, "IndusInd Bank"],
  [/bank of baroda/i, "Bank of Baroda"],
  [/punjab national bank|\bpnb\b/i, "PNB"],
  [/canara bank/i, "Canara Bank"],
  [/union bank/i, "Union Bank"],
  [/federal bank/i, "Federal Bank"],
  [/au small finance/i, "AU Bank"],
];

export function bankFromText(text: string): string | null {
  return BANKS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export interface CsvRead {
  statement: ReadStatement;
  /** Rows that had a date but no readable amount: summary rows, or a column mix-up. */
  skipped: number;
}

/** Payments from a table with known columns. Throws a message a person can act on. */
export function linesFromTable(table: CsvTable, map: ColumnMap, fileName = ""): CsvRead {
  if (!mapIsUsable(map)) throw new Error("Pick the date, description and amount columns first.");
  const lines: StatementLine[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const date = parseStatementDate(row[map.date!] ?? "");
    if (!date) continue; // Totals, page breaks, blank lines, the closing note.
    const description = (row[map.description!] ?? "").replace(/\s+/g, " ").trim();
    let amount: number | null = null;
    let type: "debit" | "credit" | null = null;

    const debit = map.debit !== undefined ? parseMoney(row[map.debit]) : null;
    const credit = map.credit !== undefined ? parseMoney(row[map.credit]) : null;
    if (debit && debit.value > 0) {
      amount = debit.value;
      type = "debit";
    } else if (credit && credit.value > 0) {
      amount = credit.value;
      type = "credit";
    } else if (map.amount !== undefined) {
      const money = parseMoney(row[map.amount]);
      if (money && money.value > 0) {
        amount = money.value;
        type =
          directionOf(map.direction !== undefined ? row[map.direction] : undefined) ??
          (money.sign === -1 ? "debit" : money.sign === 1 ? "credit" : null);
        // A plain amount with no direction anywhere: assume money out, the common case.
        if (!type) type = "debit";
      }
    }
    if (amount === null || type === null) {
      skipped++;
      continue;
    }

    const balance = map.balance !== undefined ? parseMoney(row[map.balance]) : null;
    const closingBalance = balance ? balance.value * (balance.sign === -1 ? -1 : 1) : 0;

    lines.push({
      date,
      time: null,
      description: description || (type === "debit" ? "Payment" : "Money in"),
      amount,
      type,
      upiId: null,
      merchant: null,
      payee: null,
      closingBalance,
      // The bank's own numbers, not read off a PDF: nothing to cross-check.
      balanceOk: true,
    } as StatementLine);
  }
  if (!lines.length) {
    throw new Error("No payments found with these columns. Check that the date and amount columns are the right ones.");
  }
  const dates = lines.map((line) => line.date).sort();
  const bank = bankFromText(`${table.preamble}\n${fileName}`) ?? "Bank statement";
  return { statement: { bank, lines, from: dates[0]!, to: dates.at(-1)! }, skipped };
}

/** The whole flow for a file: find the table and its columns. `map` is null if the columns need picking. */
export function readCsvStatement(text: string): { table: CsvTable; map: ColumnMap | null } {
  if (looksBinary(text)) {
    throw new Error("This is an Excel workbook. Open it and save it as CSV, or download the CSV version from net banking.");
  }
  const rows = parseDelimited(text);
  if (rows.length < 2) throw new Error("This file has no rows to read.");
  const table = findTable(rows);
  if (table) return { table, map: guessColumns(table.headers) };
  const fallback = fallbackTable(rows);
  if (!fallback || fallback.headers.length < 3) throw new Error("This doesn't look like a statement. Download the CSV version from net banking.");
  return { table: fallback, map: null };
}
