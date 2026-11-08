import { formatInr } from "./format";
import type { Entry } from "./model";
import { myShare } from "./shared";

/**
 * Today's numbers for the "Today" Live Activity on the Lock Screen and in the
 * Dynamic Island. The app works them out from your entries; the iOS payment
 * popup adds to them in Swift between app opens
 * (plugins/native/LogBankMessageIntent.swift, TodayStats), so both share this
 * shape and the same wording (tests/today.test.ts checks the Swift copy).
 */
export interface TodayStats {
  /** YYYY-MM-DD the numbers are for. */
  date: string;
  spent: number;
  count: number;
  /** Payments waiting for a category, any day. */
  toSort: number;
  limit: number | null;
  /** The latest payment today, e.g. "₹640 · Swiggy". */
  last: string | null;
}

export interface TodayActivityProps {
  spent: string;
  /** "3 payments · ₹760 left" */
  detail: string;
  /** "2 to sort", or "" when everything is sorted. */
  toSort: string;
  /** Share of the daily limit used, 0 to 1; -1 without a limit. */
  progress: number;
  over: boolean;
  last: string;
}

/** Not spending: moves between your own accounts and investments. */
const NOT_SPENDING = new Set(["investments", "transfers", "self-transfer", "banks", "cash", "brokerage"]);

export function todayStats(entries: Entry[], day: string, limit: number | null): TodayStats {
  const real = entries.filter((entry) => entry.origin !== "sample");
  const spentToday = real.filter(
    (entry) => entry.type === "debit" && entry.date === day && !NOT_SPENDING.has(entry.categorySlug ?? ""),
  );
  const latest = [...spentToday].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    date: day,
    spent: spentToday.reduce((sum, entry) => sum + (entry.splits.length ? myShare(entry.amount, entry.splits) : entry.amount), 0),
    count: spentToday.length,
    toSort: real.filter((entry) => entry.needsReview).length,
    limit: limit && limit > 0 ? limit : null,
    last: latest ? `${formatInr(latest.amount)} · ${latest.merchant ?? latest.description}` : null,
  };
}

export function todayActivityProps(stats: TodayStats): TodayActivityProps {
  const payments = stats.count === 0 ? "No payments yet" : stats.count === 1 ? "1 payment" : `${stats.count} payments`;
  let detail = payments;
  if (stats.limit) {
    const left = stats.limit - stats.spent;
    detail += left >= 0 ? ` · ${formatInr(left)} left` : ` · ${formatInr(-left)} over`;
  }
  return {
    spent: formatInr(stats.spent),
    detail,
    toSort: stats.toSort > 0 ? `${stats.toSort} to sort` : "",
    progress: stats.limit ? Math.min(1, stats.spent / stats.limit) : -1,
    over: stats.limit ? stats.spent > stats.limit : false,
    last: stats.last ? `Last: ${stats.last}` : "",
  };
}
