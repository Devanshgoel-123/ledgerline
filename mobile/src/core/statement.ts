import type { Category } from "./catalog";
import { classify } from "./classify";
import type { Entry, Rule } from "./model";
import {
  bankAdapters,
  counterpartyFromNarration,
  detectAdapter,
  pageTextFromItems,
  shiftIsoDate,
  unrecordedLines,
  type PdfTextItem,
  type StatementLine,
} from "./shared";

const SALARY_RE = /\b(salary|payroll|sal cr)\b/i;

/** Statement text, read the same way the backend reads it. */
export function statementText(pages: PdfTextItem[][]): string {
  return pages.map(pageTextFromItems).join("\n");
}

export interface ReadStatement {
  bank: string;
  lines: StatementLine[];
  from: string;
  to: string;
}

/** Bank lines from statement text. Throws a message a person can act on. */
export function readStatement(text: string): ReadStatement {
  if (!text.trim()) {
    throw new Error(
      "This PDF has no text to read. It may be a scan or a photo. Download the statement PDF from net banking instead.",
    );
  }
  const adapter = detectAdapter(text, bankAdapters);
  const lines = adapter.extractLines(text);
  if (!lines.length) {
    // HDFC is the fallback reader, so another bank's PDF lands here too.
    throw new Error(
      "No payments found in this PDF. Ledgerline reads HDFC and ICICI statements downloaded from net banking. For other banks, add expenses by hand.",
    );
  }
  const dates = lines.map((line) => line.date).sort();
  return { bank: adapter.displayName, lines, from: dates[0]!, to: dates[dates.length - 1]! };
}

/** A stable key for a statement line; repeats of the same line get #2, #3. */
export function lineKeys(lines: StatementLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const base = `${line.date}|${line.type}|${Math.round(line.amount * 100)}|${hash(line.description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export interface MissingLine {
  key: string;
  date: string;
  amount: number;
  type: "debit" | "credit";
  description: string;
  upiId: string | null;
  /** Who the statement says was paid, when it names them. */
  party: string | null;
  suggestedCategory: string;
  merchant: string | null;
  providerId: string | null;
  classificationSource: string;
  /** The running balance did not add up on this line: check it against the PDF. */
  needsCheck: boolean;
}

export interface StatementCheck {
  bank: string;
  from: string;
  to: string;
  lineCount: number;
  /** Lines with a matching entry already on the phone. */
  matchedCount: number;
  missing: MissingLine[];
  /** Lines the user said to skip on an earlier check. */
  ignoredCount: number;
}

/**
 * Statement lines with no entry on the phone. An entry pairs with a line of
 * the same amount and direction on that day or the day beside it, using the
 * backend's matching. Cash entries never pair: cash is not in a statement,
 * and pairing one would hide a real missing line.
 */
export function checkStatement(input: {
  statement: ReadStatement;
  entries: Entry[];
  ignored: Set<string>;
  rules: Rule[];
  categories: Category[];
}): StatementCheck {
  const { statement } = input;
  const keys = lineKeys(statement.lines);
  const keyOf = new Map(statement.lines.map((line, index) => [line, keys[index]!]));
  const from = shiftIsoDate(statement.from, -1);
  const to = shiftIsoDate(statement.to, 1);
  const ledger = input.entries.filter(
    (entry) => entry.method !== "cash" && entry.date >= from && entry.date <= to,
  );
  // Lines already added from an earlier check count as recorded by key, even if edited since.
  const addedRefs = new Set(input.entries.map((entry) => entry.statementRef).filter(Boolean));
  const fresh = statement.lines.filter((line) => !addedRefs.has(keyOf.get(line)!));
  const unpaired = unrecordedLines(
    ledger.filter((entry) => !entry.statementRef || !keys.includes(entry.statementRef)),
    fresh,
  );
  const ignoredLines = unpaired.filter((line) => input.ignored.has(keyOf.get(line)!));
  const missing = unpaired
    .filter((line) => !input.ignored.has(keyOf.get(line)!))
    .map((line): MissingLine => {
      const party = counterpartyFromNarration(line.description);
      const upiId = line.upiId ?? party.upiId;
      const classified = classify(
        {
          description: line.description,
          upiId,
          merchant: party.name,
          payee: null,
          amount: line.amount,
          type: line.type,
        },
        input.rules,
        input.categories,
      );
      return {
        key: keyOf.get(line)!,
        date: line.date,
        amount: line.amount,
        type: line.type,
        description: line.description,
        upiId,
        party: classified.merchant ?? party.name,
        suggestedCategory:
          line.type === "credit" && classified.categorySlug === "other" && SALARY_RE.test(line.description)
            ? "salary"
            : classified.categorySlug,
        merchant: classified.merchant ?? party.name,
        providerId: classified.providerId,
        classificationSource: classified.classificationSource,
        needsCheck: !line.balanceOk,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);

  return {
    bank: statement.bank,
    from: statement.from,
    to: statement.to,
    lineCount: statement.lines.length,
    matchedCount: statement.lines.length - unpaired.length,
    missing,
    ignoredCount: ignoredLines.length,
  };
}
