import type { StatementLine } from "../parser.js";
import type { Transaction } from "../types/index.js";

export interface BankAdapter {
  id: string;
  displayName: string;
  /** Return true if this adapter can parse the extracted text. */
  detect(text: string): boolean;
  /** Parse statement text into normalized transactions. */
  extract(text: string): Transaction[];
  /** Statement rows in statement order with closing balance and chain check. */
  extractLines(text: string): StatementLine[];
}

export function detectAdapter(text: string, adapters: BankAdapter[]): BankAdapter {
  const matched = adapters.find((a) => a.detect(text));
  if (!matched) {
    throw new Error(
      // Keep "Unsupported": pdfErrors.ts uses it to treat this as the user's fixable mistake (400).
      "Unsupported statement. Ledgerline can read HDFC and ICICI bank statement PDFs downloaded from NetBanking. For other banks, add expenses by hand on Transactions or scan bank mail.",
    );
  }
  return matched;
}

export interface AdapterMatch {
  adapter: BankAdapter;
  transactions: Transaction[];
}

export function runAdapters(
  text: string,
  adapters: BankAdapter[],
): AdapterMatch {
  const matched = detectAdapter(text, adapters);
  const transactions = matched.extract(text);
  if (!transactions.length) {
    throw new Error(`No transactions found with ${matched.displayName} adapter.`);
  }
  return { adapter: matched, transactions };
}
