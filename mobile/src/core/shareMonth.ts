/**
 * A month's spending as a post for X: where the money went, by share, and
 * the totals only if you choose to show them. Built on the phone; nothing is
 * sent anywhere until you post it from X yourself.
 */
import { formatInr } from "./format";

export interface ShareGroup {
  slug: string;
  label: string;
  total: number;
}

export interface MonthPostInput {
  monthTitle: string;
  totalSpent: number;
  avgDailySpend: number;
  /** Top-level categories, biggest first (groupCategorySpend). */
  groups: ShareGroup[];
  /** Rupee amounts in the post. Off by default: shares say enough. */
  showAmounts: boolean;
  /** How many categories to list, at most. Fewer if the post would run long. */
  limit?: number;
}

/** X's limit for a post from a free account. */
export const X_LIMIT = 280;

const EMOJI: Record<string, string> = {
  food: "🍔",
  grocery: "🛒",
  shopping: "🛍️",
  transport: "🚕",
  travel: "✈️",
  bills: "🧾",
  household: "🏠",
  subscriptions: "📺",
  outing: "🎬",
  healthcare: "💊",
  personal: "💇",
  education: "📚",
  family: "👨‍👩‍👧",
  gifts: "🎁",
  vices: "🍻",
  emi: "💳",
  insurance: "🛡️",
  fees: "🏛️",
  investments: "📈",
  transfers: "🔁",
  income: "💰",
  other: "📦",
};

export function categoryEmoji(slug: string): string {
  return EMOJI[slug] ?? "•";
}

/** 32%, or <1% for a sliver, so small categories never read as 0%. */
export function sharePercent(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return "0%";
  const percent = (part / whole) * 100;
  return percent < 1 ? "<1%" : `${Math.round(percent)}%`;
}

/**
 * The length X counts: most Latin text is 1 per character; emoji, ₹ and
 * other symbols are 2; the joiners and variation selectors inside an emoji
 * are free. Errs long, so a post that fits here fits on X.
 */
export function xLength(text: string): number {
  let length = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) continue;
    const light =
      code <= 0x10ff || (code >= 0x2000 && code <= 0x200c) || (code >= 0x2010 && code <= 0x201f) || (code >= 0x2032 && code <= 0x2037);
    length += light ? 1 : 2;
  }
  return length;
}

function compose(input: MonthPostInput, count: number): string {
  const { monthTitle, totalSpent, avgDailySpend, groups, showAmounts } = input;
  const lines = [`Where my money went in ${monthTitle} 📊`, ""];
  for (const group of groups.slice(0, count)) {
    const share = sharePercent(group.total, totalSpent);
    lines.push(`${categoryEmoji(group.slug)} ${group.label} ${share}${showAmounts ? ` · ${formatInr(group.total)}` : ""}`);
  }
  if (showAmounts) lines.push("", `${formatInr(totalSpent)} spent, about ${formatInr(Math.round(avgDailySpend))} a day`);
  lines.push("", "Tracked on my phone with Ledgerline. No bank login, nothing uploaded.");
  return lines.join("\n");
}

/** The post, with as many categories as fit (up to `limit`, default 5). */
export function buildMonthPost(input: MonthPostInput): string {
  const want = Math.min(input.limit ?? 5, input.groups.filter((group) => group.total > 0).length);
  for (let count = want; count > 0; count--) {
    const text = compose(input, count);
    if (xLength(text) <= X_LIMIT) return text;
  }
  return compose(input, 0);
}

/** Opens X's composer with the post filled in: the X app if it's installed, else the website. */
export function xComposeUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}
