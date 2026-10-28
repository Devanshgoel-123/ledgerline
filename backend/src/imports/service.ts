import { buildAnalyticsFromRows } from "../analytics/fromStore.js";
import { randomUUID } from "node:crypto";
import { getStore } from "../db/index.js";
import type {
  CategoryRow,
  ProviderRow,
  TransactionRow,
  UserRuleRow,
} from "../db/types.js";
import { ClassificationSource, ImportSource, ruleClassificationSource } from "../enums/index.js";
import { AppError } from "../errors/AppError.js";
import { poolingScanWindow } from "../helpers/index.js";
import { buildMatchFieldsFromText, matchRule } from "../rules/engine.js";
import {
  ingestStatementPdf,
  type ReconcileSummary,
  type RescanAlerts,
} from "../statementMatch/reconcile.js";
import {
  SplitInputError,
  assertSharesFit,
  normalizeFriends,
  roundMoney,
} from "../splits/share.js";
import type { ParseResult } from "../types/index.js";
import { DEMO_FINGERPRINT_PREFIX } from "../demo/service.js";
import {
  buildTrackedPayees,
  loadClassificationContext,
} from "./context.js";

async function loadAnalyticsResult(input: {
  userId: string;
  rows: TransactionRow[];
  providers: ProviderRow[];
  categories: CategoryRow[];
  rules: UserRuleRow[];
}): Promise<ParseResult> {
  return analyticsForUser(
    input.userId,
    input.rows,
    input.providers,
    buildTrackedPayees(input.rules),
    input.categories,
  );
}

async function analyticsForUser(
  userId: string,
  rows: Parameters<typeof buildAnalyticsFromRows>[0],
  providers: Parameters<typeof buildAnalyticsFromRows>[1],
  trackedPayees: string[],
  categories: Parameters<typeof buildAnalyticsFromRows>[3],
): Promise<ParseResult> {
  const store = await getStore();
  const user = await store.findUserById(userId);
  return buildAnalyticsFromRows(rows, providers, trackedPayees, categories, {
    dailySpendLimit: user?.dailySpendLimit ?? null,
  });
}

/** What one statement upload did, in counts a person can check against the PDF. */
export type ImportReport = {
  duplicate: boolean;
  previousImportDate: string | null;
  /** Statement lines read inside the tracked window. */
  lines: number;
  /** Lines that matched a payment already in the ledger. */
  alreadyRecorded: number;
  /** New payments added from the statement. */
  added: number;
  /** Existing payments whose debit/credit direction the statement corrected. */
  directionCorrected: number;
  /** Lines not added: the closing balance did not add up, or a nearby payment may be the same one. */
  needsReview: number;
  /** Lines matching a payment the user deleted; not added back. */
  previouslyDeleted: number;
  /** Lines dated outside the tracked window, left out. */
  outsideWindow: number;
  statementFrom: string | null;
  statementTo: string | null;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Plain-language lines for an import report (chat messages). */
export function importReportLines(report: ImportReport): string[] {
  if (report.duplicate) return ["Nothing changed: this exact file was imported before."];
  return [
    `${plural(report.lines, "line")} read`,
    `${plural(report.alreadyRecorded, "payment")} already recorded`,
    `${plural(report.added, "new payment")} added`,
    ...(report.directionCorrected ? [`${plural(report.directionCorrected, "payment")} switched between paid and received`] : []),
    ...(report.needsReview ? [`${plural(report.needsReview, "line")} not added: the balance did not add up or a similar payment exists`] : []),
    ...(report.previouslyDeleted ? [`${plural(report.previouslyDeleted, "payment")} you deleted before, not added back`] : []),
    ...(report.outsideWindow ? [`${plural(report.outsideWindow, "line")} outside the tracked dates`] : []),
  ];
}

/** Upload or mailed statement: store its lines as evidence and reconcile the mail ledger. */
export async function processPdfImport(input: {
  userId: string;
  buffer: Buffer;
  filename: string;
  password?: string;
  source?: ImportSource;
  mailMessageId?: string | null;
  rescan?: RescanAlerts;
}): Promise<{
  importId: string;
  result: ParseResult;
  report: ImportReport;
}> {
  const store = await getStore();
  const ingest = await ingestStatementPdf({
    userId: input.userId,
    buffer: input.buffer,
    filename: input.filename,
    password: input.password,
    source: input.source ?? ImportSource.Upload,
    mailMessageId: input.mailMessageId ?? null,
    rescan: input.rescan,
  });
  const rows = await store.listTransactions(input.userId);
  const { providers, categories, rules } = await loadClassificationContext(input.userId);
  const result = await loadAnalyticsResult({
    userId: input.userId,
    rows,
    providers,
    categories,
    rules,
  });
  result.meta.parsedCount = ingest.parsed;
  const summary = ingest.summary;
  return {
    importId: ingest.importId,
    result,
    report: {
      duplicate: summary?.isDuplicate ?? false,
      previousImportDate: summary?.previousImportDate ?? null,
      lines: summary?.lines ?? 0,
      alreadyRecorded: Math.max(0, (summary?.verified ?? 0) - (summary?.typeCorrected ?? 0)),
      added: summary?.inserted ?? 0,
      directionCorrected: summary?.typeCorrected ?? 0,
      needsReview: summary?.unresolved ?? 0,
      previouslyDeleted: summary?.previouslyDeleted ?? 0,
      outsideWindow: summary?.outsideWindow ?? 0,
      statementFrom: summary?.statementFrom ?? null,
      statementTo: summary?.statementTo ?? null,
    },
  };
}

export async function getDashboardForUser(
  userId: string,
  options?: { from?: string; to?: string },
): Promise<ParseResult> {
  const store = await getStore();
  const { providers, categories, rules } = await loadClassificationContext(userId);
  // Read the five months before the selected range too, for the month-by-month trend.
  const trendFrom = options?.from ? `${shiftMonth(options.from.slice(0, 7), -TREND_MONTHS + 1)}-01` : undefined;
  const wide = await store.listTransactions(userId, { from: trendFrom, to: options?.to });
  const rows = options?.from ? wide.filter((row) => row.date >= options.from!) : wide;
  const result = await loadAnalyticsResult({ userId, rows, providers, categories, rules });
  if (rows.length !== wide.length) {
    const trend = await loadAnalyticsResult({ userId, rows: wide, providers, categories, rules });
    result.monthlySpend = trend.monthlySpend;
  }
  return result;
}

const TREND_MONTHS = 6;

/** YYYY-MM moved by whole months. */
function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year! * 12 + (m! - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Lightweight bootstrap status — no analytics rebuild. */
export async function getImportStatusForUser(userId: string): Promise<{
  hasTransactions: boolean;
  latestMonth: string | null;
  transactionCount: number;
  /** Sample rows added by the demo, which the user can remove in one step. */
  sampleCount: number;
  scanWindow: { from: string; to: string };
}> {
  const store = await getStore();
  const scanWindow = poolingScanWindow();
  const rows = await store.listTransactions(userId);
  if (rows.length === 0) {
    return {
      hasTransactions: false,
      latestMonth: null,
      transactionCount: 0,
      sampleCount: 0,
      scanWindow,
    };
  }
  const latestDate = rows[0]?.date ?? null;
  const latestMonth =
    latestDate && latestDate.length >= 7 ? latestDate.slice(0, 7) : null;
  return {
    hasTransactions: true,
    latestMonth,
    transactionCount: rows.length,
    sampleCount: rows.filter((row) => row.fingerprint.startsWith(DEMO_FINGERPRINT_PREFIX)).length,
    scanWindow,
  };
}

export async function clearImportedDataForUser(userId: string) {
  const store = await getStore();
  const deleted = await store.clearUserRecords(userId);
  await store.audit(userId, "imports.cleared", deleted);
  return { ok: true as const, scanWindow: poolingScanWindow(), deleted };
}

export async function listImportsForUser(userId: string) {
  const store = await getStore();
  return store.listImports(userId);
}

export async function deleteTransactionForUser(
  userId: string,
  transactionId: string,
): Promise<{ ok: true }> {
  const store = await getStore();
  const existing = await store.getTransaction(userId, transactionId);
  if (!existing) {
    throw AppError.notFound("Transaction not found");
  }
  await store.deleteTransaction(userId, transactionId);
  await store.audit(userId, "transaction.deleted", { transactionId });
  return { ok: true };
}

export async function correctTransactionForUser(input: {
  userId: string;
  transactionId: string;
  payee?: string;
  merchant?: string;
  categorySlug?: string | null;
  providerId?: string | null;
  applyFuture?: boolean;
}): Promise<{
  transaction: TransactionRow | null;
  reclassified: number;
}> {
  const store = await getStore();
  const tx = await store.getTransaction(input.userId, input.transactionId);
  if (!tx) {
    throw AppError.notFound("Transaction not found");
  }

  let merchant = input.merchant;
  let categorySlug = input.categorySlug;
  if (input.providerId) {
    // Only shared apps or this user's own; another user's private app must not leak its name.
    const provider = await store.getProviderForUser(input.userId, input.providerId);
    if (!provider) throw AppError.notFound("App not found");
    if (categorySlug !== null) {
      merchant = merchant ?? provider.canonicalName;
      categorySlug = categorySlug ?? provider.categorySlug ?? undefined;
    }
  }

  const updated = await store.updateTransaction(input.userId, tx.id, {
    payee: input.payee,
    merchant,
    ...(categorySlug !== undefined ? { categorySlug } : {}),
    ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
    classificationSource: ClassificationSource.UserOverride,
  });

  let reclassified = 0;
  if (input.applyFuture) {
    const matchFields = tx.upiId
      ? { matchNarrationRe: null, matchUpiId: tx.upiId }
      : buildMatchFieldsFromText(tx.description.slice(0, 40));
    const rule = await store.createRule({
      userId: input.userId,
      name: `Correction for ${input.payee || merchant || categorySlug || tx.id}`,
      priority: 10,
      enabled: true,
      matchNarrationRe: matchFields.matchNarrationRe,
      matchUpiId: matchFields.matchUpiId,
      matchMerchantAlias: null,
      matchAmountMin: null,
      matchAmountMax: null,
      matchType: null,
      setProviderId: input.providerId ?? null,
      setPayeeName: input.payee ?? null,
      setCategorySlug: categorySlug ?? null,
      setTags: [],
    });

    reclassified = await store.reclassifyByRule(
      input.userId,
      (candidate) =>
        candidate.id !== tx.id &&
        candidate.classificationSource !== ClassificationSource.UserOverride &&
        matchRule(rule, candidate),
      {
        payee: input.payee,
        merchant,
        categorySlug,
        providerId: input.providerId ?? undefined,
        classificationSource: ruleClassificationSource(rule.id),
      },
    );
  }

  await store.audit(input.userId, "transaction.corrected", {
    transactionId: tx.id,
    applyFuture: Boolean(input.applyFuture),
    reclassified,
  });

  return {
    transaction: updated,
    reclassified,
  };
}

export async function createManualExpense(
  userId: string,
  input: { date: string; amount: number; categorySlug: string; description: string },
) {
  const description = input.description.trim();
  if (!description || description.length > 200) {
    throw AppError.badRequest("Say what this expense was, in 200 characters or fewer");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 10_000_000) {
    throw AppError.badRequest("Amount has to be more than zero");
  }
  const store = await getStore();
  const categories = await store.listCategories(userId);
  const category = categories.find((item) => item.slug === input.categorySlug);
  if (!category) throw AppError.badRequest("Pick a category that exists");
  const amount = roundMoney(input.amount);
  const inserted = await store.insertTransactions(userId, [
    {
      importId: null,
      accountId: null,
      date: input.date,
      time: null,
      description,
      amount,
      type: "debit",
      upiId: null,
      merchant: description,
      payee: null,
      providerId: null,
      categorySlug: category.slug,
      classificationSource: ClassificationSource.UserOverride,
      fingerprint: `manual:${randomUUID()}`,
      mailMessageId: null,
      origin: "manual",
      verifiedAt: null,
    },
  ]);
  const id = inserted.ids[0];
  if (!id) throw AppError.badRequest("Could not save that expense");
  await store.audit(userId, "transaction.manual", { transactionId: id });
  return store.getTransaction(userId, id);
}

export async function setBillSplit(
  userId: string,
  transactionId: string,
  friendsInput: Array<{ name: string; amount: number }>,
) {
  const store = await getStore();
  const tx = await store.getTransaction(userId, transactionId);
  if (!tx) throw AppError.notFound("Transaction not found");
  if (tx.type !== "debit") throw AppError.badRequest("Only a payment can be split");
  let friends;
  try {
    friends = normalizeFriends(friendsInput);
    assertSharesFit(tx.amount, friends);
  } catch (error) {
    if (error instanceof SplitInputError) throw AppError.badRequest(error.message);
    throw error;
  }
  const saved = await store.replaceTransactionSplits(userId, transactionId, friends);
  await store.audit(userId, "transaction.split", {
    transactionId,
    friends: friends.length,
  });
  return saved;
}
