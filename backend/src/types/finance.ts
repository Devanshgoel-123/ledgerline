import type { TransactionType } from "../enums/transaction.js";

export type { TransactionType };

export interface Transaction {
  id?: string;
  date: string;
  time: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  upiId: string | null;
  merchant: string | null;
  payee: string | null;
  providerId?: string | null;
  category?: string | null;
  logoUrl?: string | null;
  /** Credit that gives back money spent (refund, reversal, merchant credit). */
  isRefund?: boolean;
  /** `mail` alert row, or `statement` gap filled from a balance-checked line. */
  origin?: "mail" | "statement" | "manual";
  /** A statement line confirmed amount and direction. */
  verified?: boolean;
}

export interface MerchantSpend {
  merchant: string;
  total: number;
  count: number;
  lastDate: string;
  categorySlug?: string | null;
  logoUrl?: string | null;
  providerId?: string | null;
}

export interface PayeeSpend {
  name: string;
  /** Debits minus credits. */
  total: number;
  /** Money paid to this person. */
  paid: number;
  /** Money received from this person. */
  received: number;
  count: number;
  lastDate: string;
  days: string[];
}

export interface AmountBand {
  label: string;
  min: number;
  max: number;
  count: number;
  total: number;
  days: string[];
  dayCounts: Record<string, number>;
}

export interface DailySpend {
  date: string;
  amount: number;
}

export interface DailyLimitDay {
  date: string;
  amount: number;
  overBy: number;
}

export interface DailyInsights {
  limit: number | null;
  enabled: boolean;
  daysOverLimit: DailyLimitDay[];
  daysUnderLimit: number;
  totalDaysWithSpend: number;
  worstDay: DailyLimitDay | null;
  totalOverLimit: number;
}

export interface UpiRanking {
  upiId: string;
  total: number;
  count: number;
  lastDate: string;
}

export interface Summary {
  totalSpent: number;
  /** Debits categorized as investments. Not included in totalSpent. */
  totalInvested: number;
  /** Money in, less refunds (they lower spend) and transfers between your own accounts. */
  totalReceived: number;
  /** Cash flow: money in less money out at full amounts, excluding own transfers and passed-on money. */
  net: number;
  /** Payments counted in totalSpent. */
  transactionCount: number;
  upiPayees: number;
  avgDailySpend: number;
  dateFrom: string | null;
  dateTo: string | null;
}

/** Spend per category from the same payments and refunds as totalSpent; the totals add up to it. */
export interface CategorySpend {
  slug: string;
  total: number;
  /** Payments (refunds lower the total but are not counted). */
  count: number;
}

export interface ParseResult {
  summary: Summary;
  daily: DailySpend[];
  dailyInsights: DailyInsights;
  upiRanking: UpiRanking[];
  merchantSpend: MerchantSpend[];
  categorySpend?: CategorySpend[];
  /** Spend per month (YYYY-MM), same rules as totalSpent. The dashboard sends six months ending at the selected one. */
  monthlySpend?: Array<{ month: string; total: number }>;
  payeeSpend: PayeeSpend[];
  amountBand25to60: AmountBand;
  categories?: Array<{
    id: string;
    slug: string;
    label: string;
    blurb: string;
    accent: string;
    sortOrder: number;
    meta: Record<string, unknown>;
  }>;
  transactions: Transaction[];
  meta: {
    pagesTextChars: number;
    parsedCount: number;
  };
}
