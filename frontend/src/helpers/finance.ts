import { ISO_MONTH_RE } from "@/constants/dates";
import { INR_LOCALE } from "@/constants/currency";
import { CategorySlug } from "@/enums/category";
import { TxType } from "@/enums/transaction";
import {
  dateSortKey,
  parseLedgerDate,
  toIsoDate,
} from "@/helpers/dates";
import { logoForAppName, logoForCategory } from "@/helpers/apps";
import type {
  AmountBand,
  CategorySpend,
  CategorySummary,
  DailySpend,
  MerchantSpend,
  PayeeSpend,
  Transaction,
} from "@/types";

export interface CategorySpendChild {
  id: string;
  label: string;
  total: number;
  count: number;
  logoUrl: string | null;
}

export interface CategorySpendRow {
  id: string;
  label: string;
  total: number;
  count: number;
  accent: string;
  children: CategorySpendChild[];
}

export interface MonthlySpendRow {
  month: string;
  label: string;
  total: number;
}

export interface WeekendInsight {
  weekendAvg: number;
  weekdayAvg: number;
  percentHigher: number;
  topDays: string[];
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(INR_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthTitle(month: string): string {
  return formatMonthLabel(month);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Category rows for the breakdown. Totals and counts come from `spend`, the
 * API's per-category figures built from the same payments as Total spent, so
 * the rows add up to it. Rent counts. A category the list does not know is
 * filed under Other. Merchants only fill in the detail under each row.
 */
export function buildCategorySpendRows(
  merchants: MerchantSpend[],
  _cigaretteBand: AmountBand,
  categories: CategorySummary[],
  spend: CategorySpend[] = [],
): CategorySpendRow[] {
  const known = new Map(categories.map((category) => [category.slug, category]));
  const topOf = (slug: string): string => {
    let current = known.get(slug);
    const seen = new Set<string>();
    while (current?.meta?.parent && known.has(current.meta.parent) && !seen.has(current.slug)) {
      seen.add(current.slug);
      current = known.get(current.meta.parent);
    }
    return current?.slug ?? CategorySlug.Other;
  };
  const spendBySlug = new Map<string, { total: number; count: number }>();
  for (const row of spend) {
    const slug = known.has(row.slug) ? row.slug : CategorySlug.Other;
    const entry = spendBySlug.get(slug) ?? { total: 0, count: 0 };
    entry.total = roundMoney(entry.total + row.total);
    entry.count += row.count;
    spendBySlug.set(slug, entry);
  }
  const merchantsBySlug = new Map<string, MerchantSpend[]>();
  for (const row of merchants) {
    const slug = row.categorySlug && known.has(row.categorySlug) ? row.categorySlug : CategorySlug.Other;
    merchantsBySlug.set(slug, [...(merchantsBySlug.get(slug) ?? []), row]);
  }

  const tops = new Map<string, CategorySpendRow>();
  const ensureTop = (slug: string): CategorySpendRow => {
    let row = tops.get(slug);
    if (!row) {
      const category = known.get(slug);
      row = {
        id: slug,
        label: category?.label ?? "Other",
        total: 0,
        count: 0,
        accent: category?.accent ?? "var(--cat-other)",
        children: [],
      };
      tops.set(slug, row);
    }
    return row;
  };

  for (const [slug, spent] of spendBySlug) {
    const top = ensureTop(topOf(slug));
    top.total = roundMoney(top.total + spent.total);
    top.count += spent.count;
    if (slug !== top.id) {
      top.children.push({
        id: slug,
        label: known.get(slug)?.label ?? slug,
        total: spent.total,
        count: spent.count,
        logoUrl: logoForCategory(slug),
      });
    }
  }
  for (const [slug, list] of merchantsBySlug) {
    const top = tops.get(topOf(slug));
    if (!top || topOf(slug) !== slug) continue;
    for (const merchant of list) {
      if (merchant.total <= 0) continue;
      top.children.push({
        id: merchant.providerId ?? merchant.merchant,
        label: merchant.merchant === "Other" ? "Unlabeled" : merchant.merchant,
        total: merchant.total,
        count: merchant.count,
        logoUrl: merchant.logoUrl ?? logoForAppName(merchant.merchant),
      });
    }
  }

  return [...tops.values()]
    .map((row) => ({
      ...row,
      children: row.children.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    }))
    .filter((row) => row.total !== 0 || row.count > 0)
    .sort((a, b) => b.total - a.total);
}

/** Share denominator for category and merchant charts. Net spend subtracts salary and makes one bucket look larger than 100%. */
export function positiveTotal(amounts: number[]): number {
  return Math.round(amounts.reduce((sum, amount) => sum + (amount > 0 ? amount : 0), 0) * 100) / 100;
}

function isAccountBankName(name: string): boolean {
  return /\b(hdfc|icici|axis|sbi|state bank)\b/i.test(name);
}

export interface PersonPayment {
  id: string;
  date: string;
  amount: number;
  direction: "paid" | "received";
  upiId: string | null;
  category?: CategorySlug;
}

/**
 * Totals and the payment list come from the same rows, so a card can never
 * show a total its own list does not add up to. A row belongs to its payee,
 * or for unlabelled family rows, to its merchant.
 */
export function peopleFromTransactions(
  names: string[],
  transactions: Transaction[],
): { people: PayeeSpend[]; paymentsByName: Record<string, PersonPayment[]> } {
  const map = new Map<string, PayeeSpend>();
  const paymentsByName: Record<string, PersonPayment[]> = {};
  const ensure = (name: string) => {
    const key = name.toLowerCase();
    let person = map.get(key);
    if (!person) {
      person = { name, total: 0, paid: 0, received: 0, count: 0, lastDate: "", days: [] };
      map.set(key, person);
      paymentsByName[key] = [];
    }
    return person;
  };
  for (const name of names) ensure(name);

  // Categories that represent expenses/transfers, not personal payments
  const nonPersonalCategories = new Set<string>([
    CategorySlug.PassedOn,
    CategorySlug.Rent,
    CategorySlug.Investments,
    CategorySlug.SelfTransfer,
    CategorySlug.Banks,
    CategorySlug.Salary,
    CategorySlug.Food,
    CategorySlug.Shopping,
    CategorySlug.Travel,
    CategorySlug.Healthcare,
    CategorySlug.Pharmacy,
    CategorySlug.Furniture,
    CategorySlug.Household,
    CategorySlug.Grocery,
    CategorySlug.Outing,
    CategorySlug.Dinner,
    CategorySlug.Sports,
    CategorySlug.FunActivity,
    CategorySlug.Vices,
    CategorySlug.Booze,
    CategorySlug.Cigarettes,
    CategorySlug.Personal,
    CategorySlug.Salon,
    CategorySlug.RandomExpense,
    CategorySlug.CookMaid,
    CategorySlug.Brokerage,
    CategorySlug.Petrol,
    CategorySlug.ScootyRental,
    CategorySlug.Rides,
    CategorySlug.Stays,
    CategorySlug.FromHome,
    CategorySlug.Other,
  ]);

  for (const txn of transactions) {
    // Skip transactions in non-personal categories, even if they have a payee
    if (txn.category && nonPersonalCategories.has(txn.category)) continue;
    if (txn.type !== TxType.Debit && txn.type !== TxType.Credit) continue;
    let name = txn.payee?.trim() ?? "";
    if (!name && txn.category === CategorySlug.Family) {
      const merchant = txn.merchant?.trim() ?? "";
      if (merchant && merchant !== "Other" && !isAccountBankName(merchant)) name = merchant;
    }
    if (!name) continue;
    const person = ensure(name);
    const paid = txn.type === TxType.Debit;
    const share = txn.myShare ?? txn.amount;
    person.count += 1;
    if (paid) person.paid = Math.round((person.paid + share) * 100) / 100;
    else person.received = Math.round((person.received + txn.amount) * 100) / 100;
    person.total = Math.round((person.paid - person.received) * 100) / 100;
    if (!person.days.includes(txn.date)) person.days.push(txn.date);
    if (txn.date > person.lastDate) person.lastDate = txn.date;
    paymentsByName[name.toLowerCase()].push({
      id: txn.id ?? `${txn.date}-${person.count}`,
      date: txn.date,
      amount: txn.amount,
      direction: paid ? "paid" : "received",
      upiId: txn.upiId ?? null,
      category: (txn.category as CategorySlug | undefined) ?? undefined,
    });
  }

  for (const [key, person] of map) {
    person.days.sort();
    paymentsByName[key].sort((a, b) => b.date.localeCompare(a.date));
  }
  return { people: [...map.values()], paymentsByName };
}

type CategoryParent = { slug: string; meta?: { parent?: string } | null };

/** Investments and any category nested under them, except self-transfer. */
export function isInvestmentCategory(
  slug: string | null | undefined,
  categories: CategoryParent[] = [],
): boolean {
  // Self-transfer sits under investments in the category tree, but moving money
  // between your own accounts is not investing.
  if (!slug || slug === CategorySlug.SelfTransfer) return false;
  if (slug === CategorySlug.Investments) return true;
  return categories.some(
    (category) => category.slug === slug && category.meta?.parent === CategorySlug.Investments,
  );
}

/**
 * Money out, less refunds. Rent counts. Investments (including child categories),
 * self-transfers, passed-on, salary, and bank transfers do not. Family payments count.
 */
export function spendAmount(
  txn: Pick<Transaction, "type" | "amount" | "isRefund" | "category" | "myShare">,
  categories: CategoryParent[] = [],
): number {
  if (isInvestmentCategory(txn.category, categories)) return 0;
  const excludedCategories = new Set<string>([
    CategorySlug.PassedOn,
    CategorySlug.SelfTransfer,
    CategorySlug.Salary,
    CategorySlug.Banks,
  ]);

  if (txn.category && excludedCategories.has(txn.category)) return 0;
  if (txn.type === TxType.Debit) return Math.abs(txn.myShare ?? txn.amount);
  if (txn.type === TxType.Credit && txn.isRefund) return -Math.abs(txn.amount);
  return 0;
}

/**
 * Money in, the same rule as the API's totalReceived: credits other than
 * refunds (they lower spend), own-account transfers, and passed-on money.
 */
export function moneyInAmount(
  txn: Pick<Transaction, "type" | "amount" | "isRefund" | "category">,
): number {
  if (txn.type !== TxType.Credit || txn.isRefund) return 0;
  if (txn.category === CategorySlug.PassedOn || txn.category === CategorySlug.SelfTransfer) return 0;
  return Math.abs(txn.amount);
}

/** Daily bars leave rent off so one housing payment does not dwarf the month. */
export function chartSpendAmount(
  txn: Pick<Transaction, "type" | "amount" | "isRefund" | "category" | "myShare">,
  categories: CategoryParent[] = [],
): number {
  if (txn.category === CategorySlug.Rent) return 0;
  return spendAmount(txn, categories);
}

/** Monthly bars from the API's monthlySpend: the same rules as Total spent, rent included. */
export function monthlySpendRows(
  months: Array<{ month: string; total: number }> = [],
): MonthlySpendRow[] {
  return months
    .filter((row) => ISO_MONTH_RE.test(row.month))
    .map((row) => ({ month: row.month, label: formatMonthLabel(row.month), total: row.total }));
}

/** Each plotted day leaves out rent and investments. Other credits stay on Received. */
export function debitDailySpend(
  transactions: Transaction[],
  categories: CategoryParent[] = [],
): DailySpend[] {
  const debits = new Map<string, number>();
  for (const txn of transactions) {
    const signed = chartSpendAmount(txn, categories);
    if (signed === 0) continue;
    debits.set(txn.date, (debits.get(txn.date) ?? 0) + signed);
  }
  return [...debits.entries()]
    .filter(([date]) => toIsoDate(date) != null)
    .sort(([a], [b]) => dateSortKey(a).localeCompare(dateSortKey(b)))
    .map(([date, amount]) => ({ date, amount: roundMoney(amount) }))
    .filter((day) => day.amount > 0);
}

/** Normalize daily rows for charts — valid dates, chronological order. */
export function normalizeDailySpend(rows: DailySpend[]): DailySpend[] {
  return [...rows]
    .filter((row) => toIsoDate(row.date) != null)
    .sort((a, b) => dateSortKey(a.date).localeCompare(dateSortKey(b.date)));
}

export function monthOverMonthDelta(
  rows: MonthlySpendRow[],
): { percent: number; direction: "up" | "down" | "flat" } | null {
  if (rows.length < 2) return null;
  const current = rows[rows.length - 1]!.total;
  const previous = rows[rows.length - 2]!.total;
  if (previous === 0) return null;
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.05) return { percent: 0, direction: "flat" };
  return {
    percent: Math.abs(percent),
    direction: percent > 0 ? "up" : "down",
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function spendingByWeekday(daily: DailySpend[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const d of daily) {
    const parsed = parseLedgerDate(d.date);
    if (!parsed) continue;
    const day = parsed.getUTCDay();
    const list = map.get(day) ?? [];
    list.push(d.amount);
    map.set(day, list);
  }
  return map;
}

export function weekendInsight(daily: DailySpend[]): WeekendInsight | null {
  if (daily.length === 0) return null;
  const byDay = spendingByWeekday(daily);
  const weekend = [0, 6].flatMap((d) => byDay.get(d) ?? []);
  const weekday = [1, 2, 3, 4, 5].flatMap((d) => byDay.get(d) ?? []);
  if (weekend.length === 0 || weekday.length === 0) return null;

  const weekendAvg = weekend.reduce((s, n) => s + n, 0) / weekend.length;
  const weekdayAvg = weekday.reduce((s, n) => s + n, 0) / weekday.length;
  const percentHigher =
    weekdayAvg > 0 ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0;

  const dayTotals = [...byDay.entries()].map(([day, amounts]) => ({
    day,
    total: amounts.reduce((s, n) => s + n, 0),
  }));
  dayTotals.sort((a, b) => b.total - a.total);
  const topDays = dayTotals.slice(0, 2).map((d) => DAY_NAMES[d.day]!);

  return {
    weekendAvg: Math.round(weekendAvg),
    weekdayAvg: Math.round(weekdayAvg),
    percentHigher: Math.round(percentHigher),
    topDays,
  };
}

export function dailySpendMap(daily: DailySpend[]): Map<string, number> {
  return new Map(daily.map((d) => [d.date, d.amount]));
}
