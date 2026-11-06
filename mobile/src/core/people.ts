import type { Entry } from "./model";
import { roundMoney } from "./shared";

export interface FriendBalance {
  name: string;
  /** Still owed to you. */
  owed: number;
  /** Paid back already. */
  settled: number;
  bills: { entryId: string; date: string; description: string; amount: number; settledAt: string | null }[];
}

/** What each friend owes you from split bills, most owed first. Names match ignoring case. */
export function friendBalances(entries: Entry[]): FriendBalance[] {
  const byName = new Map<string, FriendBalance>();
  for (const entry of entries) {
    for (const share of entry.splits) {
      const key = share.name.toLowerCase();
      const balance = byName.get(key) ?? { name: share.name, owed: 0, settled: 0, bills: [] };
      // "asha" and "Asha" are one friend; show the capitalised spelling.
      if (balance.name === balance.name.toLowerCase() && share.name !== share.name.toLowerCase()) {
        balance.name = share.name;
      }
      if (share.settledAt) balance.settled = roundMoney(balance.settled + share.amount);
      else balance.owed = roundMoney(balance.owed + share.amount);
      balance.bills.push({
        entryId: entry.id,
        date: entry.date,
        description: entry.merchant ?? entry.description,
        amount: share.amount,
        settledAt: share.settledAt,
      });
      byName.set(key, balance);
    }
  }
  return [...byName.values()]
    .map((balance) => ({ ...balance, bills: balance.bills.sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
}

/** Split a bill evenly between you and the named friends; you absorb the rounding. */
export function evenShares(total: number, names: string[]): number[] {
  if (!names.length) return [];
  const each = Math.floor((total / (names.length + 1)) * 100) / 100;
  return names.map(() => each);
}

/** Names used before, most recent first, for quick picking. */
export function knownFriends(entries: Entry[]): string[] {
  const seen = new Map<string, string>();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of sorted) {
    for (const share of entry.splits) {
      if (!seen.has(share.name.toLowerCase())) seen.set(share.name.toLowerCase(), share.name);
    }
  }
  return [...seen.values()];
}
