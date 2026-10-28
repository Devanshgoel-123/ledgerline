import { categoryLabel, type Category } from "./catalog";
import type { Entry } from "./model";
import { myShare } from "./shared";

const HEADER = [
  "Date",
  "Type",
  "Amount",
  "Your share",
  "Description",
  "Paid to",
  "UPI ID",
  "Category",
  "Paid by",
  "Source",
  "Split with",
  "Note",
];

function cell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  // Quote, and stop a spreadsheet reading "=..." as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) || safe !== text ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Every entry as CSV, oldest first. */
export function entriesCsv(entries: Entry[], categories: Category[]): string {
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((entry) =>
      [
        entry.date,
        entry.type === "debit" ? "Spent" : "Received",
        entry.amount.toFixed(2),
        entry.type === "debit" ? myShare(entry.amount, entry.splits).toFixed(2) : "",
        entry.description,
        entry.merchant ?? entry.payee ?? "",
        entry.upiId ?? "",
        categoryLabel(entry.categorySlug, categories),
        entry.method === "upi" ? "UPI" : entry.method === "card" ? "Card" : entry.method === "cash" ? "Cash" : "Other",
        entry.origin === "statement" ? "Statement" : entry.origin === "sample" ? "Sample" : "Added by you",
        entry.splits.map((share) => `${share.name} ${share.amount}${share.settledAt ? " (paid back)" : ""}`).join("; "),
        entry.note ?? "",
      ]
        .map(cell)
        .join(","),
    );
  return [HEADER.join(","), ...rows].join("\n") + "\n";
}
