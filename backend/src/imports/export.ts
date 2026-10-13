import type { RequestHandler } from "express";
import { DEMO_FINGERPRINT_PREFIX } from "../demo/service.js";
import { getStore } from "../db/index.js";
import { getDashboardForUser } from "./service.js";

const COLUMNS = [
  "Date",
  "Time",
  "Type",
  "Amount",
  "Your share",
  "Merchant or person",
  "Category",
  "UPI ID",
  "Description",
  "Split with",
  "Source",
  "Sample",
] as const;

/**
 * One CSV cell. Quotes when needed, and prefixes text that a spreadsheet would run as a
 * formula (=, +, -, @) so a merchant name can never execute in Excel or Sheets.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Every transaction the user has, as the app shows them, oldest first. */
export async function buildTransactionsCsv(userId: string): Promise<string> {
  const store = await getStore();
  const [result, rows] = await Promise.all([
    getDashboardForUser(userId),
    store.listTransactions(userId),
  ]);
  const sampleIds = new Set(
    rows.filter((row) => row.fingerprint.startsWith(DEMO_FINGERPRINT_PREFIX)).map((row) => row.id),
  );
  const lines = [COLUMNS.join(",")];
  const transactions = [...result.transactions].sort((a, b) =>
    `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
  );
  for (const txn of transactions) {
    const full = txn as typeof txn & {
      categoryLabel?: string | null;
      myShare?: number;
      splits?: { name: string; amount: number }[];
    };
    lines.push(
      [
        txn.date,
        txn.time,
        txn.isRefund ? "refund" : txn.type,
        txn.amount,
        full.myShare ?? txn.amount,
        txn.payee ?? txn.merchant,
        full.categoryLabel ?? txn.category,
        txn.upiId,
        txn.description,
        (full.splits ?? []).map((split) => `${split.name} ${split.amount}`).join("; "),
        txn.origin ?? "",
        txn.id && sampleIds.has(txn.id) ? "yes" : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // Byte-order mark so Excel opens rupee signs and non-English names correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const exportTransactionsController: RequestHandler = async (req, res) => {
  const csv = await buildTransactionsCsv(req.user!.id);
  const today = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ledgerline-transactions-${today}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(csv);
};
