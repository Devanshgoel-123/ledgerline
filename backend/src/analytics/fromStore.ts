import type { CategoryRow, ProviderRow, TransactionRow } from "../db/types.js";
import { myShare } from "../splits/share.js";
import { resolveAmountBand } from "../categories/heuristics.js";
import { ClassificationSource } from "../enums/classification.js";
import { CategorySlug } from "../enums/category.js";
import { counterpartyFromNarration, isAccountBank, merchantIsAccountBank } from "../narration/party.js";
import { detectFromProviders } from "../rules/engine.js";
import { buildDailyInsights } from "./dailyInsights.js";
import type {
  AmountBand,
  CategorySpend,
  DailySpend,
  MerchantSpend,
  ParseResult,
  PayeeSpend,
  Summary,
  Transaction,
  UpiRanking,
} from "../types/index.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function countedAmount(row: TransactionRow): number {
  if (row.type !== "debit") return row.amount;
  return myShare(row.amount, row.splits ?? []);
}

function signedAmount(row: TransactionRow): number {
  const amount = countedAmount(row);
  return row.type === "credit" ? -amount : amount;
}

interface SpendIdentity {
  merchant: string;
  upiId: string | null;
  categorySlug: string | null;
  providerId: string | null;
  logoUrl: string | null;
}

function isManualClassification(source: string): boolean {
  return (
    source === ClassificationSource.UserOverride ||
    source === ClassificationSource.Telegram ||
    source.startsWith("rule:")
  );
}

/** Banks named in the alert template are not the merchant. Use the VPA or app. */
function resolveSpendIdentity(
  row: TransactionRow,
  providers: ProviderRow[],
): SpendIdentity {
  const bankNames = new Set(
    providers
      .filter(isAccountBank)
      .flatMap((provider) => [provider.canonicalName, ...provider.aliases])
      .map((name) => name.toLowerCase()),
  );
  const storedIsBank =
    row.merchant != null && bankNames.has(row.merchant.toLowerCase());
  const party = counterpartyFromNarration(row.description);
  const detected = detectFromProviders(
    {
      description: row.description,
      upiId: row.upiId ?? party.upiId,
      merchant: storedIsBank ? party.name : row.merchant,
      payee: row.payee ?? party.name,
    },
    providers,
  );
  const provider =
    providers.find((item) => item.id === (detected.providerId ?? row.providerId)) ??
    providers.find(
      (item) =>
        item.categorySlug &&
        item.canonicalName.toLowerCase() ===
          (detected.merchant ?? row.merchant ?? "").toLowerCase(),
    ) ??
    null;
  const merchant =
    detected.merchant ??
    (storedIsBank ? party.name : row.merchant) ??
    party.name ??
    "Other";
  if (isManualClassification(row.classificationSource)) {
    // The user's choice stands, including a cleared category; never re-detect over it.
    const chosen = row.providerId
      ? providers.find((item) => item.id === row.providerId) ?? null
      : null;
    const keepStoredMerchant = !storedIsBank || row.categorySlug === "banks";
    // Only default to family if no category is set AND there's a payee; never override an explicit category
    const categorySlug = !row.categorySlug && row.payee ? "family" : row.categorySlug;
    return {
      merchant: keepStoredMerchant ? (row.merchant ?? merchant) : merchant,
      upiId: row.upiId ?? party.upiId,
      categorySlug,
      providerId: row.providerId,
      logoUrl: chosen?.logoUrl ?? null,
    };
  }
  const storedCategory = row.categorySlug;
  const genericCategory = !storedCategory || storedCategory === "other";
  const categorySlug = storedIsBank
    ? (detected.categorySlug ?? storedCategory ?? "other")
    : genericCategory
      ? (detected.categorySlug ?? provider?.categorySlug ?? storedCategory ?? "other")
      : storedCategory;
  // Only default to family if category is truly empty/generic AND there's a payee
  const resolvedCategory =
    row.payee && !categorySlug ? "family" : categorySlug;
  return {
    merchant,
    upiId: row.upiId ?? party.upiId,
    categorySlug: resolvedCategory,
    providerId: detected.providerId ?? (storedIsBank ? null : row.providerId) ?? provider?.id ?? null,
    logoUrl: provider?.logoUrl ?? null,
  };
}

/**
 * Money that only moved through the account bank is not spend at that bank.
 * A resolved vendor or a real category still counts.
 */
function isBankRailTransfer(
  row: TransactionRow,
  providers: ProviderRow[],
  identity: SpendIdentity,
): boolean {
  const resolved = identity.providerId
    ? providers.find((item) => item.id === identity.providerId) ?? null
    : null;
  if (resolved && resolved.categorySlug && resolved.categorySlug !== "banks") return false;
  if (
    identity.categorySlug &&
    identity.categorySlug !== "other" &&
    identity.categorySlug !== "banks"
  ) {
    return false;
  }
  if (identity.categorySlug === "banks") return true;
  if (merchantIsAccountBank(identity.merchant, providers)) return true;
  return (
    merchantIsAccountBank(row.merchant, providers) &&
    (identity.merchant === "Other" || !identity.providerId)
  );
}

const PASSED_ON = "passed-on";

/** Someone else's money that arrived and left again. It is not spend and not income. */
function isPassedOn(
  row: Pick<TransactionRow, "categorySlug">,
  identity: Pick<SpendIdentity, "categorySlug">,
): boolean {
  return row.categorySlug === PASSED_ON || identity.categorySlug === PASSED_ON;
}

function tiedToInvestments(
  slug: string | null | undefined,
  categories: CategoryRow[],
): boolean {
  // Self-transfer sits under investments in the category tree, but moving money
  // between your own accounts is not investing.
  if (!slug || slug === CategorySlug.SelfTransfer) return false;
  if (slug === CategorySlug.Investments) return true;
  return categories.some(
    (category) => category.slug === slug && category.meta?.parent === CategorySlug.Investments,
  );
}

/** Money moved into investments is not expenditure. Includes child categories other than self-transfer. */
function isInvestment(
  row: Pick<TransactionRow, "categorySlug" | "providerId">,
  identity: Pick<SpendIdentity, "categorySlug" | "providerId">,
  providers: ProviderRow[],
  categories: CategoryRow[] = [],
): boolean {
  if (
    tiedToInvestments(row.categorySlug, categories) ||
    tiedToInvestments(identity.categorySlug, categories)
  ) {
    return true;
  }
  const providerId = identity.providerId ?? row.providerId;
  const provider = providerId
    ? providers.find((item) => item.id === providerId) ?? null
    : null;
  if (!provider || !tiedToInvestments(provider.categorySlug, categories)) return false;
  // A category the user actually chose, other than investments, still counts as spend.
  const chosen = row.categorySlug;
  return !chosen || chosen === "other" || tiedToInvestments(chosen, categories);
}

/** Salary, bank, and self-transfers are not expenditure. Rent and family payments stay in the total. */
function isNonSpendable(
  row: Pick<TransactionRow, "categorySlug">,
  identity: Pick<SpendIdentity, "categorySlug">,
): boolean {
  const slug = identity.categorySlug ?? row.categorySlug;
  if (!slug) return false;

  return (
    slug === CategorySlug.Salary ||
    slug === CategorySlug.Banks ||
    slug === CategorySlug.SelfTransfer
  );
}

/** Rent is an expense, but one payment would dwarf every other day on the chart. */
function isRent(
  row: Pick<TransactionRow, "categorySlug">,
  identity: Pick<SpendIdentity, "categorySlug">,
): boolean {
  return identity.categorySlug === CategorySlug.Rent || row.categorySlug === CategorySlug.Rent;
}

const REFUND_RE = /\b(refund|reversal|reversed|cashback|chargeback)\b/i;

const BANK_RAIL_RE = /\b(neft|imps|rtgs|payroll|salary)\b/i;

/** Money back from a purchase: refund wording, or a credit from a merchant app. Salary, tax refunds, and other bank credits are not refunds. */
export function isRefund(
  row: Pick<TransactionRow, "type" | "description">,
  identity: Pick<SpendIdentity, "providerId">,
  providers: ProviderRow[],
): boolean {
  if (row.type !== "credit") return false;
  if (BANK_RAIL_RE.test(row.description)) return false;
  if (REFUND_RE.test(row.description)) return true;
  const provider = identity.providerId
    ? providers.find((item) => item.id === identity.providerId) ?? null
    : null;
  return Boolean(provider && provider.categorySlug && !isAccountBank(provider));
}

function rowToApiTransaction(
  row: TransactionRow,
  providers: ProviderRow[],
  categories: CategoryRow[] = [],
): Transaction & {
  id: string;
  providerId: string | null;
  category: string | null;
  categoryLabel: string | null;
  logoUrl: string | null;
  myShare: number;
  splits: { name: string; amount: number }[];
} {
  const provider = providers.find((p) => p.id === row.providerId) ?? null;
  const identity = resolveSpendIdentity(row, providers);
  const categorySlug = isInvestment(row, identity, providers, categories)
    ? CategorySlug.Investments
    : identity.categorySlug;
  const category = categories.find((c) => c.slug === categorySlug) ?? null;
  return {
    isRefund: isRefund(row, identity, providers),
    origin: row.origin,
    verified: row.verifiedAt != null,
    id: row.id,
    date: row.date,
    time: row.time,
    description: row.description,
    amount: row.amount,
    type: row.type,
    myShare: row.type === "debit" ? countedAmount(row) : row.amount,
    splits: row.splits ?? [],
    upiId: identity.upiId,
    merchant: identity.merchant,
    payee: row.payee,
    providerId: identity.providerId ?? provider?.id ?? null,
    category: categorySlug,
    categoryLabel: category?.label ?? null,
    logoUrl: identity.logoUrl ?? provider?.logoUrl ?? null,
  };
}

function buildAmountBand(
  rows: TransactionRow[],
  categories: CategoryRow[],
): AmountBand | null {
  const config = resolveAmountBand(categories);
  if (!config) return null;

  const debits = rows.filter((t) => t.type === "debit");
  const bandDayCounts: Record<string, number> = {};
  let bandCount = 0;
  let bandTotal = 0;

  for (const t of debits) {
    if (t.categorySlug !== config.slug) continue;
    bandCount += 1;
    bandTotal += countedAmount(t);
    bandDayCounts[t.date] = (bandDayCounts[t.date] ?? 0) + 1;
  }

  return {
    label: config.label,
    min: config.min,
    max: config.max,
    count: bandCount,
    total: Math.round(bandTotal * 100) / 100,
    days: Object.keys(bandDayCounts).sort(),
    dayCounts: bandDayCounts,
  };
}

export function buildAnalyticsFromRows(
  rows: TransactionRow[],
  providers: ProviderRow[],
  trackedPayees: string[] = [],
  categories: CategoryRow[] = [],
  options?: { dailySpendLimit?: number | null },
): ParseResult {
  const identities = new Map(rows.map((row) => [row.id, resolveSpendIdentity(row, providers)]));
  const identityOf = (row: TransactionRow) => identities.get(row.id)!;
  const mine = (row: TransactionRow) => !isPassedOn(row, identityOf(row));
  const invested = (row: TransactionRow) =>
    isInvestment(row, identityOf(row), providers, categories);
  const nonSpend = (row: TransactionRow) => isNonSpendable(row, identityOf(row));
  const spendable = (row: TransactionRow) => mine(row) && !invested(row) && !nonSpend(row);
  const rent = (row: TransactionRow) => isRent(row, identityOf(row));
  const ownTransfer = (row: TransactionRow) =>
    (identityOf(row).categorySlug ?? row.categorySlug) === CategorySlug.SelfTransfer;
  const debits = rows.filter((t) => t.type === "debit" && spendable(t));
  const chartDebits = debits.filter((t) => !rent(t));
  const credits = rows.filter((t) => t.type === "credit" && spendable(t));
  const investedDebits = rows.filter((t) => t.type === "debit" && mine(t) && invested(t));
  const refunds = credits.filter((row) => isRefund(row, identityOf(row), providers));

  const spendByDay = new Map<string, number>();
  for (const t of chartDebits) {
    const share = countedAmount(t);
    if (share <= 0) continue;
    spendByDay.set(t.date, (spendByDay.get(t.date) ?? 0) + share);
  }
  for (const t of refunds) {
    spendByDay.set(t.date, (spendByDay.get(t.date) ?? 0) - Math.abs(t.amount));
  }
  const daily: DailySpend[] = [...spendByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: round2(amount) }))
    .filter((day) => day.amount > 0);

  const upiMap = new Map<string, UpiRanking>();
  for (const t of rows) {
    if (t.type !== "debit" && t.type !== "credit") continue;
    if (!spendable(t)) continue;
    const identity = identityOf(t);
    if (!identity.upiId) continue;
    const existing = upiMap.get(identity.upiId);
    if (!existing) {
      upiMap.set(identity.upiId, {
        upiId: identity.upiId,
        total: signedAmount(t),
        count: t.type === "debit" ? 1 : 0,
        lastDate: t.date,
      });
    } else {
      existing.total = round2(existing.total + signedAmount(t));
      if (t.type === "debit") existing.count += 1;
      if (t.date > existing.lastDate) existing.lastDate = t.date;
    }
  }
  const upiRanking = [...upiMap.values()]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  // One bucket per merchant and category: a Swiggy payment moved to Outing counts under Outing, not Food.
  const bucketKey = (merchant: string, categorySlug: string | null) =>
    `${merchant}\u0000${categorySlug ?? ""}`;
  const logoByMerchant = new Map(
    providers
      .filter((p) => p.logoUrl)
      .map((p) => [p.canonicalName, { logoUrl: p.logoUrl, providerId: p.id }]),
  );
  const merchantMap = new Map<
    string,
    MerchantSpend & { logoUrl: string | null; providerId: string | null }
  >();
  const tracked = new Set(
    trackedPayees.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const refundIds = new Set(refunds.map((row) => row.id));
  // Category totals come from exactly the payments and refunds in totalSpent,
  // so the breakdown always adds up to it.
  const categoryMap = new Map<string, CategorySpend>();
  for (const t of rows) {
    if (!mine(t) || invested(t)) continue;
    if (t.type !== "debit" && !refundIds.has(t.id)) continue;
    const base = identityOf(t);
    const payee = t.payee?.trim() ?? "";
    // A tracked person only overrides an unset category; a payment tagged rent stays rent.
    const toPerson =
      base.categorySlug === CategorySlug.Family ||
      (tracked.has(payee.toLowerCase()) &&
        (!base.categorySlug || base.categorySlug === CategorySlug.Other));
    const identity =
      toPerson && payee
        ? { ...base, merchant: payee, categorySlug: CategorySlug.Family, providerId: null, logoUrl: null }
        : toPerson
          ? { ...base, categorySlug: CategorySlug.Family }
          : base;
    if (spendable(t)) {
      const slug = identity.categorySlug ?? CategorySlug.Other;
      const entry = categoryMap.get(slug) ?? { slug, total: 0, count: 0 };
      entry.total = round2(entry.total + signedAmount(t));
      if (t.type === "debit") entry.count += 1;
      categoryMap.set(slug, entry);
    }
    // Payments to people are listed per person, even when sent over a bank rail.
    if (!toPerson && !spendable(t)) continue;
    if (!toPerson && isBankRailTransfer(t, providers, identity)) continue;
    const key = bucketKey(identity.merchant, identity.categorySlug);
    let bucket = merchantMap.get(key);
    if (!bucket) {
      const known = logoByMerchant.get(identity.merchant);
      bucket = {
        merchant: identity.merchant,
        total: 0,
        count: 0,
        lastDate: "",
        categorySlug: identity.categorySlug,
        logoUrl: identity.logoUrl ?? known?.logoUrl ?? null,
        providerId: identity.providerId ?? known?.providerId ?? null,
      };
      merchantMap.set(key, bucket);
    }
    bucket.total = round2(bucket.total + signedAmount(t));
    if (t.type === "debit") bucket.count += 1;
    if (!bucket.logoUrl && identity.logoUrl) bucket.logoUrl = identity.logoUrl;
    if (!bucket.lastDate || t.date > bucket.lastDate) bucket.lastDate = t.date;
  }
  const merchantSpend = [...merchantMap.values()]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const payeeNames = new Set<string>([
    ...trackedPayees,
    ...rows.map((r) => r.payee).filter((p): p is string => Boolean(p)),
  ]);
  const payeeMap = new Map<string, PayeeSpend>();
  for (const name of payeeNames) {
    payeeMap.set(name, {
      name,
      total: 0,
      paid: 0,
      received: 0,
      count: 0,
      lastDate: "",
      days: [],
    });
  }
  for (const t of rows) {
    if (!t.payee) continue;
    if (!mine(t)) continue;
    if (t.type !== "debit" && t.type !== "credit") continue;
    const bucket = payeeMap.get(t.payee);
    if (!bucket) continue;
    bucket.total = round2(bucket.total + signedAmount(t));
    bucket.count += 1;
    if (t.type === "debit") bucket.paid = round2(bucket.paid + countedAmount(t));
    else bucket.received = round2(bucket.received + t.amount);
    if (!bucket.days.includes(t.date)) bucket.days.push(t.date);
    if (!bucket.lastDate || t.date > bucket.lastDate) bucket.lastDate = t.date;
  }
  for (const bucket of payeeMap.values()) bucket.days.sort();
  const payeeSpend = [...payeeMap.values()].sort((a, b) => b.total - a.total);

  const amountBand25to60 =
    buildAmountBand(rows, categories) ??
    ({
      label: "",
      min: 0,
      max: 0,
      count: 0,
      total: 0,
      days: [],
      dayCounts: {},
    } satisfies AmountBand);

  const grossSpent = round2(debits.reduce((sum, t) => sum + countedAmount(t), 0));
  const totalInvested = round2(investedDebits.reduce((sum, t) => sum + countedAmount(t), 0));
  const totalRefunded = round2(refunds.reduce((sum, t) => sum + t.amount, 0));
  // Each month's figure uses the same rules as totalSpent, so the latest bar equals it.
  const byMonth = new Map<string, number>();
  for (const t of debits) byMonth.set(t.date.slice(0, 7), (byMonth.get(t.date.slice(0, 7)) ?? 0) + countedAmount(t));
  for (const t of refunds) byMonth.set(t.date.slice(0, 7), (byMonth.get(t.date.slice(0, 7)) ?? 0) - t.amount);
  const monthlySpend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: round2(total) }));
  const totalSpent = round2(grossSpent - totalRefunded);
  // Money in: salary, people paying you back, interest. Refunds already lower spend,
  // and moving your own money between accounts is not money in.
  const moneyIn = rows.filter(
    (t) => t.type === "credit" && mine(t) && !ownTransfer(t) && !refundIds.has(t.id),
  );
  const totalReceived = round2(moneyIn.reduce((sum, t) => sum + t.amount, 0));
  // Cash flow: everything that came in less everything that went out, at full amounts.
  const cashIn = rows
    .filter((t) => t.type === "credit" && mine(t) && !ownTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);
  const cashOut = rows
    .filter((t) => t.type === "debit" && mine(t) && !ownTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);
  // The daily chart leaves rent off; a refund on a day with no spending still counts here.
  const rentSpent = round2(debits.filter(rent).reduce((sum, t) => sum + countedAmount(t), 0));
  const days = daily.length || 1;

  const summary: Summary = {
    totalSpent,
    totalInvested,
    totalReceived,
    net: round2(cashIn - cashOut),
    transactionCount: debits.length,
    upiPayees: upiRanking.length,
    avgDailySpend: round2(Math.max(0, totalSpent - rentSpent) / days),
    dateFrom: daily[0]?.date ?? null,
    dateTo: daily[daily.length - 1]?.date ?? null,
  };

  const dailyInsights = buildDailyInsights(daily, options?.dailySpendLimit);

  return {
    summary,
    daily,
    dailyInsights,
    upiRanking,
    merchantSpend,
    payeeSpend,
    categorySpend: [...categoryMap.values()].sort((a, b) => b.total - a.total),
    monthlySpend,
    amountBand25to60,
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      label: category.label,
      blurb: category.blurb,
      accent: category.accent,
      sortOrder: category.sortOrder,
      meta: { ...category.meta } as Record<string, unknown>,
    })),
    transactions: rows
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => rowToApiTransaction(r, providers, categories)),
    meta: {
      pagesTextChars: 0,
      parsedCount: rows.length,
    },
  };
}
