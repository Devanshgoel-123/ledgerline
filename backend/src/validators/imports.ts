import { z } from "zod";
import { IST_TIME_ZONE, ISO_DATE_RE } from "../constants/index.js";

export const parsePasswordBodySchema = z.object({
  password: z.string().max(256).optional().default(""),
});

export const dashboardQuerySchema = z.object({
  from: z
    .string()
    .regex(ISO_DATE_RE, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(ISO_DATE_RE, "to must be YYYY-MM-DD")
    .optional(),
});

export const correctTransactionBodySchema = z.object({
  payee: z.string().trim().min(1).max(200).optional(),
  merchant: z.string().trim().min(1).max(200).optional(),
  categorySlug: z.string().trim().min(1).max(64).nullable().optional(),
  providerId: z.string().uuid().optional().nullable(),
  applyFuture: z.boolean().optional().default(false),
});

export type CorrectTransactionBody = z.infer<
  typeof correctTransactionBodySchema
>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** True unless the date is after today in India, where every bank in Ledgerline posts transactions. */
export function isNotFutureInIndia(date: string, now = new Date()): boolean {
  return date <= now.toLocaleDateString("en-CA", { timeZone: IST_TIME_ZONE });
}

export const manualExpenseBodySchema = z.object({
  date: z
    .string()
    .regex(ISO_DATE_RE, "Pick a date for the expense")
    .refine((date) => isNotFutureInIndia(date), "The date cannot be in the future"),
  amount: z
    .coerce
    .number()
    .min(0.01, "Enter an amount of at least ₹0.01")
    .max(999_999, "Amounts above ₹9,99,999 cannot be added by hand"),
  categorySlug: z.string().trim().min(1, "Pick a category").max(64),
  description: z
    .string()
    .trim()
    .min(1, "Add a short description, like 'Lunch with team'")
    .max(200, "Keep the description under 200 characters")
    // Any language, ₹, emoji and punctuation are fine; only invisible control characters are not.
    .regex(/^[^\p{Cc}]*$/u, "The description has characters that cannot be saved"),
});

export const billSplitBodySchema = z.object({
  friends: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        amount: z.coerce.number().positive().max(10_000_000),
      }),
    )
    .max(12),
});

export type ManualExpenseBody = z.infer<typeof manualExpenseBodySchema>;
export type BillSplitBody = z.infer<typeof billSplitBodySchema>;
