import { extractUpiId } from "../narration/party.js";
import type { StatementLine } from "../parser.js";
import type { BankAdapter } from "./types.js";

/**
 * ICICI Bank savings statement (NetBanking PDF).
 *
 * Table columns: DATE | MODE** | PARTICULARS | DEPOSITS | WITHDRAWALS | BALANCE.
 * PARTICULARS wraps over one to four lines and the date and amounts sit at the
 * vertical middle of the row, so extracted text interleaves them, e.g.
 *
 *   UPI/SOME SHOP/XX1234@ybl/Sent using/YES
 *   12-09-2026 BANK/6255...  320.00 7,077.75      <- date, middle line, amount, balance
 *   140F4B9D1SOME SHOP
 *
 * With an even number of lines the date gets a line of its own. The first row is
 * "B/F" (brought forward) carrying only the opening balance. Deposit and
 * withdrawal columns are indistinguishable once text is extracted, so direction
 * comes from the running balance.
 */

const HEADER_RE = /^DATE\s+MODE\**\s+PARTICULARS\s+DEPOSITS\s+WITHDRAWALS\s+BALANCE\b/i;
const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})(?:\s+|$)/;
const AMOUNT = String.raw`-?\d{1,3}(?:,\d{2,3})*\.\d{2}`;
const TWO_AMOUNTS_TAIL = new RegExp(String.raw`(?:^|\s)(${AMOUNT})\s+(${AMOUNT})\s*$`);
const ONE_AMOUNT_TAIL = new RegExp(String.raw`(?:^|\s)(${AMOUNT})\s*$`);
/** How a new PARTICULARS cell begins: the payment channel. */
const ROW_START_RE =
  /^(UPI\/|NEFT[-/ ]|IMPS[-/ ]|RTGS[-/ ]|ACH\/|MMT\/|BIL\/|INF\/|BBPS|ATM\/|ATM |POS\/|VPS\/|IPS\/|CMS\/|TRF\/|NFS\/|ECS\/|CLG\/|SMSChgs|Int\.?\s?Pd|INT\.?PD|Interest|REV\/|Rev\/|CASH|Cash Dep|DCARD|DC\s|EBA\/|CHQ|B\/F)/;
/** Text after the last table that must not be glued onto the final row. */
const TABLE_END_RE = /^(Page \d+ of \d+|TOTAL\b|Total\b|Legends?\b|\*\*|Sincerely|This is (a|an) (system|computer))/i;

function amount(raw: string): number {
  return Math.round(Number(raw.replace(/,/g, "")) * 100) / 100;
}

interface Anchor {
  date: string;
  fragment: string;
  amount: number | null;
  closing: number;
  above: string[];
  below: string[];
}

/** Table lines in order: anchors (dated rows) and particulars fragments. */
function tableEntries(text: string): Array<Anchor | string> {
  const entries: Array<Anchor | string> = [];
  let inTable = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (HEADER_RE.test(line)) {
      inTable = true;
      continue;
    }
    if (TABLE_END_RE.test(line)) {
      inTable = false;
      continue;
    }
    if (!inTable) continue;

    const date = line.match(DATE_RE);
    if (!date) {
      entries.push(line);
      continue;
    }
    const rest = line.slice(date[0].length);
    const two = rest.match(TWO_AMOUNTS_TAIL);
    const one = two ? null : rest.match(ONE_AMOUNT_TAIL);
    if (!two && !one) {
      entries.push(line);
      continue;
    }
    const tail = (two ?? one)!;
    entries.push({
      date: `${date[3]}-${date[2]}-${date[1]}`,
      fragment: rest.slice(0, tail.index).trim(),
      amount: two ? amount(two[1]!) : null,
      closing: amount(two ? two[2]! : one![1]!),
      above: [],
      below: [],
    });
  }
  return entries;
}

/** Hand each run of particulars lines to the row above or below it. */
function attachParticulars(entries: Array<Anchor | string>): Anchor[] {
  const anchors: Anchor[] = [];
  let gap: string[] = [];

  const settle = (next: Anchor | null) => {
    const prev = anchors[anchors.length - 1];
    if (!prev) {
      if (next) next.above.push(...gap);
      gap = [];
      return;
    }
    // A single-line row has its whole description on the date line.
    const nextIsOneLine = next ? ROW_START_RE.test(next.fragment) : false;
    let split = gap.findIndex((line) => ROW_START_RE.test(line));
    if (nextIsOneLine || !next) split = -1;
    if (split < 0) {
      // The date is centred, so a row has as many lines below it as above.
      split = nextIsOneLine ? gap.length : Math.min(gap.length, prev.above.length);
    }
    prev.below.push(...gap.slice(0, split));
    if (next) next.above.push(...gap.slice(split));
    gap = [];
  };

  for (const entry of entries) {
    if (typeof entry === "string") {
      gap.push(entry);
      continue;
    }
    settle(entry);
    anchors.push(entry);
  }
  settle(null);
  return anchors;
}

export function parseIciciStatementLines(text: string): StatementLine[] {
  const anchors = attachParticulars(tableEntries(text));
  const rows: StatementLine[] = [];
  let prev: number | null = null;

  for (const anchor of anchors) {
    const description = [...anchor.above, anchor.fragment, ...anchor.below]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (anchor.amount === null) {
      // "B/F": the balance brought forward, not a payment.
      prev = anchor.closing;
      continue;
    }
    const credit = prev !== null && Math.abs(prev + anchor.amount - anchor.closing) <= 0.01;
    const debit = prev !== null && Math.abs(prev - anchor.amount - anchor.closing) <= 0.01;
    const type =
      credit ? "credit" : debit ? "debit" : prev !== null && anchor.closing > prev ? "credit" : "debit";
    rows.push({
      date: anchor.date,
      time: null,
      description: description.slice(0, 240),
      amount: anchor.amount,
      type,
      upiId: extractUpiId(description)?.toLowerCase() ?? null,
      merchant: null,
      payee: null,
      closingBalance: anchor.closing,
      balanceOk: credit || debit,
    });
    prev = anchor.closing;
  }
  return rows;
}

export const iciciAdapter: BankAdapter = {
  id: "icici",
  displayName: "ICICI Bank",
  detect(text: string): boolean {
    if (!/icici\s*bank|icicibank\.com/i.test(text.slice(0, 8000))) return false;
    return text.split("\n").some((line) => HEADER_RE.test(line.replace(/\s+/g, " ").trim()));
  },
  extract(text: string) {
    return parseIciciStatementLines(text)
      .map(({ closingBalance: _c, balanceOk: _b, ...txn }) => txn)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  extractLines(text: string) {
    return parseIciciStatementLines(text);
  },
};
