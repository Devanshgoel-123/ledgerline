import { IST_TIME_ZONE } from "../constants/pooling.js";
import { getStore } from "../db/index.js";
import type { NewTransactionInput } from "../db/types.js";
import { CategorySlug, ClassificationSource } from "../enums/index.js";

/** Every sample row's fingerprint starts with this, so samples can be found and removed. */
export const DEMO_FINGERPRINT_PREFIX = "demo:";

interface DemoTemplate {
  day: number;
  amount: number;
  type: "debit" | "credit";
  merchant: string;
  description: string;
  categorySlug: string;
  upiId?: string;
  payee?: string;
}

/** One believable month. Days are 1-based and clamped to the chosen month. */
const DEMO_MONTH: DemoTemplate[] = [
  { day: 1, amount: 52000, type: "credit", merchant: "Salary", description: "Salary credit", categorySlug: CategorySlug.Salary },
  { day: 1, amount: 18000, type: "debit", merchant: "Rent", description: "Monthly rent", categorySlug: CategorySlug.Rent },
  { day: 2, amount: 389, type: "debit", merchant: "Swiggy", description: "Swiggy order", categorySlug: CategorySlug.Food, upiId: "swiggy@icici" },
  { day: 3, amount: 1240, type: "debit", merchant: "Blinkit", description: "Blinkit groceries", categorySlug: CategorySlug.Grocery, upiId: "blinkit@hdfcbank" },
  { day: 4, amount: 5000, type: "debit", merchant: "Zerodha", description: "Monthly SIP", categorySlug: CategorySlug.Investments, upiId: "zerodha@hdfcbank" },
  { day: 5, amount: 215, type: "debit", merchant: "Uber", description: "Uber ride", categorySlug: CategorySlug.Rides, upiId: "uber@axisbank" },
  { day: 6, amount: 640, type: "debit", merchant: "Zomato", description: "Zomato dinner", categorySlug: CategorySlug.Food, upiId: "zomato@hdfcbank" },
  { day: 8, amount: 2499, type: "debit", merchant: "Myntra", description: "Myntra order", categorySlug: CategorySlug.Shopping, upiId: "myntra@ybl" },
  { day: 9, amount: 120, type: "debit", merchant: "Chai point", description: "Tea and snacks", categorySlug: CategorySlug.Food },
  { day: 10, amount: 3000, type: "debit", merchant: "Mom", description: "Sent to Mom", categorySlug: CategorySlug.Family, payee: "Mom" },
  { day: 11, amount: 1850, type: "debit", merchant: "Apollo Pharmacy", description: "Medicines", categorySlug: CategorySlug.Pharmacy, upiId: "apollopharmacy@icici" },
  { day: 12, amount: 340, type: "debit", merchant: "Rapido", description: "Rapido ride", categorySlug: CategorySlug.Rides, upiId: "rapido@axl" },
  { day: 13, amount: 1500, type: "debit", merchant: "PVR", description: "Movie night", categorySlug: CategorySlug.Outing, upiId: "pvr@icici" },
  { day: 15, amount: 899, type: "debit", merchant: "BigBasket", description: "BigBasket groceries", categorySlug: CategorySlug.Grocery, upiId: "bigbasket@icici" },
  { day: 16, amount: 450, type: "debit", merchant: "Swiggy", description: "Swiggy order", categorySlug: CategorySlug.Food, upiId: "swiggy@icici" },
  { day: 18, amount: 2100, type: "debit", merchant: "Amazon", description: "Amazon order", categorySlug: CategorySlug.Shopping, upiId: "amazon@apl" },
  { day: 19, amount: 600, type: "debit", merchant: "Salon", description: "Haircut", categorySlug: CategorySlug.Salon },
  { day: 21, amount: 1200, type: "debit", merchant: "Dinner with friends", description: "Dinner", categorySlug: CategorySlug.Dinner },
  { day: 23, amount: 299, type: "credit", merchant: "Amazon", description: "Amazon refund", categorySlug: CategorySlug.Shopping, upiId: "amazon@apl" },
  { day: 24, amount: 560, type: "debit", merchant: "Indian Oil", description: "Petrol", categorySlug: CategorySlug.Petrol },
  { day: 26, amount: 720, type: "debit", merchant: "Zomato", description: "Zomato order", categorySlug: CategorySlug.Food, upiId: "zomato@hdfcbank" },
  { day: 28, amount: 2000, type: "debit", merchant: "Mom", description: "Sent to Mom", categorySlug: CategorySlug.Family, payee: "Mom" },
];

function todayIst(now: Date): { year: number; month: number; day: number } {
  const [year, month, day] = now
    .toLocaleDateString("en-CA", { timeZone: IST_TIME_ZONE })
    .split("-")
    .map(Number);
  return { year: year!, month: month!, day: day! };
}

/**
 * Samples fill a month with no future dates: the current month once a week has passed,
 * otherwise the whole of last month so the demo is not squeezed into a day or two.
 */
export function demoMonth(now = new Date()): { month: string; lastDay: number } {
  const today = todayIst(now);
  if (today.day >= 7) {
    return { month: `${today.year}-${String(today.month).padStart(2, "0")}`, lastDay: today.day };
  }
  const year = today.month === 1 ? today.year - 1 : today.year;
  const month = today.month === 1 ? 12 : today.month - 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { month: `${year}-${String(month).padStart(2, "0")}`, lastDay };
}

export function buildDemoTransactions(now = new Date()): {
  month: string;
  rows: NewTransactionInput[];
} {
  const { month, lastDay } = demoMonth(now);
  const rows = DEMO_MONTH.filter((item) => item.day <= lastDay).map((item, index) => ({
    importId: null,
    accountId: null,
    date: `${month}-${String(item.day).padStart(2, "0")}`,
    time: null,
    description: `${item.description} (sample)`,
    amount: item.amount,
    type: item.type,
    upiId: item.upiId ?? null,
    merchant: item.merchant,
    payee: item.payee ?? null,
    providerId: null,
    categorySlug: item.categorySlug,
    classificationSource: ClassificationSource.UserOverride,
    fingerprint: `${DEMO_FINGERPRINT_PREFIX}${month}:${index}`,
    mailMessageId: null,
    origin: "manual" as const,
    verifiedAt: null,
  }));
  return { month, rows };
}

/** Adds a month of clearly-labelled sample transactions. Loading twice adds nothing new. */
export async function loadDemoData(userId: string): Promise<{ created: number; month: string }> {
  const store = await getStore();
  const { month, rows } = buildDemoTransactions();
  const result = await store.insertTransactions(userId, rows);
  await store.audit(userId, "demo.loaded", { created: result.inserted, month });
  return { created: result.inserted, month };
}

/** Removes every sample transaction and leaves real data alone. */
export async function removeDemoData(userId: string): Promise<{ removed: number }> {
  const store = await getStore();
  const removed = await store.deleteTransactionsByFingerprintPrefix(userId, DEMO_FINGERPRINT_PREFIX);
  await store.audit(userId, "demo.removed", { removed });
  return { removed };
}
