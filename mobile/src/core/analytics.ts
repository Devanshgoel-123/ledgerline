import { PROVIDERS, rootCategory, toCategoryRows, type Category } from "./catalog";
import { monthRange, shiftMonth } from "./dates";
import { toTransactionRow, type Entry } from "./model";
import { buildAnalyticsFromRows, type ParseResult } from "./shared";
import { NOT_SPENDING } from "./taxonomy";

/** Cash withdrawals and other transfers are moves of your own money, like a self-transfer. */
function forTotals(entry: Entry) {
  const row = toTransactionRow(entry);
  return row.categorySlug && NOT_SPENDING.has(row.categorySlug) ? { ...row, categorySlug: "self-transfer" } : row;
}

const TREND_MONTHS = 6;

/**
 * One month's numbers, worked out by the backend's own totals code: spend
 * includes rent and nets out refunds, investments and transfers between your
 * own accounts stay off it, and friends' shares of a split bill are not yours.
 */
export function monthAnalytics(input: {
  entries: Entry[];
  month: string;
  categories: Category[];
  dailyLimit: number | null;
  /** Names the user tracks as people, so payments to them group under People. */
  people: string[];
}): ParseResult {
  const { from, to } = monthRange(input.month);
  const trendFrom = monthRange(shiftMonth(input.month, -TREND_MONTHS + 1)).from;
  const categoryRows = toCategoryRows(input.categories);
  const wide = input.entries.filter((entry) => entry.date >= trendFrom && entry.date <= to);
  const rows = wide.filter((entry) => entry.date >= from).map(forTotals);
  const options = { dailySpendLimit: input.dailyLimit };
  const result = buildAnalyticsFromRows(rows, PROVIDERS, input.people, categoryRows, options);
  const trend = buildAnalyticsFromRows(wide.map(forTotals), PROVIDERS, input.people, categoryRows, options);
  const byMonth = new Map((trend.monthlySpend ?? []).map((row) => [row.month, row.total]));
  result.monthlySpend = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const month = shiftMonth(input.month, i - TREND_MONTHS + 1);
    return { month, total: byMonth.get(month) ?? 0 };
  });
  return result;
}

export interface CategoryGroup {
  slug: string;
  total: number;
  count: number;
  children: { slug: string; total: number; count: number }[];
}

/** Category spend rolled up to top-level categories, biggest first. Adds up to total spent. */
export function groupCategorySpend(
  spend: { slug: string; total: number; count: number }[],
  categories: Category[],
): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const row of spend) {
    const known = categories.some((category) => category.slug === row.slug);
    const root = known ? rootCategory(row.slug, categories) : "other";
    const group = groups.get(root) ?? { slug: root, total: 0, count: 0, children: [] };
    group.total = Math.round((group.total + row.total) * 100) / 100;
    group.count += row.count;
    if (row.slug !== root) group.children.push(row);
    groups.set(root, group);
  }
  return [...groups.values()]
    .filter((group) => Math.abs(group.total) >= 0.005)
    .map((group) => ({ ...group, children: group.children.sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);
}
