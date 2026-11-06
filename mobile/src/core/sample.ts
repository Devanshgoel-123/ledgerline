import type { EntryInput } from "@/db/repo";
import { buildDemoTransactions } from "./shared";

/** The web app's sample month, as phone entries. Every one is labelled "(sample)". */
export function sampleEntries(now = new Date()): { month: string; entries: EntryInput[] } {
  const { month, rows } = buildDemoTransactions(now);
  return {
    month,
    entries: rows.map((row) => ({
      date: row.date,
      amount: row.amount,
      type: row.type,
      description: row.description,
      merchant: row.merchant,
      payee: row.payee,
      upiId: row.upiId,
      categorySlug: row.categorySlug,
      classificationSource: row.classificationSource,
      method: row.upiId ? "upi" : row.type === "credit" ? "other" : "cash",
      origin: "sample",
    })),
  };
}
