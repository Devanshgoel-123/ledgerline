/**
 * Splitwise monthly account emails (hello@splitwise.com).
 *
 * Counting rule, so UPI and Splitwise are not added together blindly:
 * - "you lent" is money you already paid. If that payment is in HDFC/UPI,
 *   the bank row is the full bill. Your real spend is your share, not the
 *   whole amount, and the rest is owed back to you.
 * - "you borrowed" is your share of someone else's payment. It is spend
 *   that is not in your bank alerts, so it should be added.
 * - "owes you" / "you owe" is the open balance, not a new transaction.
 */

export type SplitwiseDirection = "owes_you" | "you_owe";
export type SplitwiseExpenseDirection = "lent" | "borrowed";

export type SplitwiseFriendBalance = {
  name: string;
  direction: SplitwiseDirection;
  amount: number;
};

export type SplitwiseExpense = {
  dateLabel: string | null;
  title: string;
  direction: SplitwiseExpenseDirection;
  amount: number;
};

export type SplitwiseSummary = {
  monthLabel: string | null;
  /** Positive when the group owes you; negative when you owe the group. */
  netBalance: number | null;
  friends: SplitwiseFriendBalance[];
  expenses: SplitwiseExpense[];
};

const AMOUNT = String.raw`₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)`;

function inr(raw: string): number {
  return Math.round(Number(raw.replace(/,/g, "")) * 100) / 100;
}

export function parseSplitwiseSummary(text: string): SplitwiseSummary | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!/splitwise/i.test(normalized)) return null;

  const month = normalized.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  );

  let netBalance: number | null = null;
  const owed = normalized.match(
    new RegExp(String.raw`you are owed\s*${AMOUNT}`, "i"),
  );
  const youOwe = normalized.match(
    new RegExp(String.raw`you owe\s*${AMOUNT}(?!\s*you)`, "i"),
  );
  if (owed?.[1]) netBalance = inr(owed[1]);
  else if (youOwe?.[1] && /total balance/i.test(normalized)) {
    netBalance = -inr(youOwe[1]);
  }

  const friends: SplitwiseFriendBalance[] = [];
  const friendRe = new RegExp(
    String.raw`([A-Z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z]+)*)\s+(owes you|you owe)\s*${AMOUNT}`,
    "g",
  );
  for (const match of normalized.matchAll(friendRe)) {
    const name = match[1]?.trim();
    const directionRaw = match[2]?.toLowerCase();
    const value = match[3] ? inr(match[3]) : null;
    if (!name || value == null || !Number.isFinite(value)) continue;
    friends.push({
      name,
      direction: directionRaw === "owes you" ? "owes_you" : "you_owe",
      amount: value,
    });
  }

  const expenses: SplitwiseExpense[] = [];
  const expenseRe = new RegExp(
    String.raw`you (lent|borrowed)\s*${AMOUNT}`,
    "gi",
  );
  for (const match of normalized.matchAll(expenseRe)) {
    const amountRaw = match[2];
    if (!amountRaw || match.index == null) continue;
    const before = normalized.slice(Math.max(0, match.index - 80), match.index);
    const dates = [
      ...before.matchAll(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})\s+/gi,
      ),
    ];
    const lastDate = dates[dates.length - 1];
    const title = (
      lastDate?.index == null
        ? before
        : before.slice(lastDate.index + lastDate[0].length)
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;
    expenses.push({
      dateLabel: lastDate ? `${lastDate[1]} ${lastDate[2]}` : null,
      title,
      direction: match[1]?.toLowerCase() === "lent" ? "lent" : "borrowed",
      amount: inr(amountRaw),
    });
  }

  if (netBalance == null && friends.length === 0 && expenses.length === 0) {
    return null;
  }

  return {
    monthLabel: month?.[1] ?? null,
    netBalance,
    friends,
    expenses,
  };
}
