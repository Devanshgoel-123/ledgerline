import { transactionFingerprint } from "../crypto/secrets.js";
import { getStore } from "../db/index.js";
import { ClassificationSource } from "../enums/classification.js";
import { counterpartyFromNarration } from "../narration/party.js";
import { shiftIsoDate, unrecordedLines, type StatementLine } from "./match.js";

export type MissingLine = StatementLine & {
  categorySlug?: string | null;
};

export async function importMissingLines(
  userId: string,
  lines: MissingLine[],
): Promise<{ inserted: number; skipped: number; previouslyDeleted: number }> {
  const store = await getStore();
  const account = await store.getOrCreateAccount(userId);
  const known = new Set((await store.listCategories(userId)).map((category) => category.slug));
  const existing = await store.listTransactions(userId);
  const notInLedger = unrecordedLines(existing, lines);
  const dates = lines.map((line) => line.date).sort();
  const deleted = dates.length
    ? await store.listDeletedTransactions(userId, {
        from: shiftIsoDate(dates[0]!, -1),
        to: shiftIsoDate(dates[dates.length - 1]!, 1),
      })
    : [];
  // A payment the user deleted stays deleted.
  const fresh = unrecordedLines(deleted, notInLedger);
  const previouslyDeleted = notInLedger.length - fresh.length;
  const alreadyThere = lines.length - notInLedger.length;
  const now = new Date().toISOString();

  // Two identical payments on one day are two payments: number the repeats.
  const seen = new Map<string, number>();
  const rows = fresh.map((line) => {
    const base = transactionFingerprint({
      date: line.date,
      amount: line.amount,
      type: line.type,
      description: line.description,
      upiId: line.upiId,
    });
    const repeat = seen.get(base) ?? 0;
    seen.set(base, repeat + 1);
    const requested = line.categorySlug?.trim() || null;
    const categorySlug = requested && known.has(requested) ? requested : null;
    const party = counterpartyFromNarration(line.description);
    return {
      importId: null,
      accountId: account.id,
      date: line.date,
      time: null,
      description: line.description,
      amount: line.amount,
      type: line.type,
      upiId: line.upiId,
      merchant: party.name,
      payee: null,
      providerId: null,
      categorySlug,
      classificationSource: categorySlug
        ? ClassificationSource.UserOverride
        : ClassificationSource.Parser,
      fingerprint: repeat ? `${base}#${repeat + 1}` : base,
      mailMessageId: null,
      origin: "statement" as const,
      verifiedAt: now,
    };
  });

  const result = await store.insertTransactions(userId, rows);
  await store.audit(userId, "statement.missing_imported", {
    inserted: result.inserted,
    skipped: result.skipped + alreadyThere,
    previouslyDeleted,
  });
  return { inserted: result.inserted, skipped: result.skipped + alreadyThere, previouslyDeleted };
}
