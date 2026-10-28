import type { FriendShare, TransactionRow } from "./shared";

export type TxType = "debit" | "credit";

/** How the money moved. Cash never shows up in a bank statement. */
export type PaymentMethod = "upi" | "card" | "cash" | "other";

/** Where a row came from: typed in, added from a statement, or sample data. */
export type Origin = "manual" | "statement" | "sample";

export interface SplitShare extends FriendShare {
  /** When the friend paid you back. */
  settledAt: string | null;
}

/** One payment, as stored on the phone. */
export interface Entry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  type: TxType;
  /** What it was for, as the user typed it or the statement said. */
  description: string;
  /** The app, shop or person paid. */
  merchant: string | null;
  payee: string | null;
  upiId: string | null;
  providerId: string | null;
  categorySlug: string | null;
  classificationSource: string;
  method: PaymentMethod;
  origin: Origin;
  /** The statement line this row was added from. */
  statementRef: string | null;
  note: string | null;
  splits: SplitShare[];
  createdAt: string;
  updatedAt: string;
}

export interface Rule {
  id: string;
  name: string;
  matchUpiId: string | null;
  matchNarrationRe: string | null;
  setCategorySlug: string | null;
  setPayeeName: string | null;
  createdAt: string;
}

/** The backend's row shape, so the shared totals code can read phone data. */
export function toTransactionRow(entry: Entry): TransactionRow {
  return {
    id: entry.id,
    userId: "",
    importId: null,
    accountId: null,
    date: entry.date,
    time: null,
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    upiId: entry.upiId,
    merchant: entry.merchant,
    payee: entry.payee,
    providerId: entry.providerId,
    categorySlug: entry.categorySlug,
    classificationSource: entry.classificationSource,
    fingerprint: entry.id,
    mailMessageId: null,
    origin: entry.origin === "statement" ? "statement" : "manual",
    verifiedAt: entry.origin === "statement" ? entry.createdAt : null,
    splits: entry.splits.map(({ name, amount }) => ({ name, amount })),
  };
}
