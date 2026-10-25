import { z } from "zod";
import { BACKFILL_MAX_MESSAGES } from "../constants/index.js";
import { MAIL_PROVIDER_IDS } from "../bankMail/providers.js";

const monthField = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
    .optional(),
);

export const enablePoolingBodySchema = z.object({
  month: monthField,
  password: z.string().max(200).optional().default(""),
  maxMessages: z.coerce
    .number()
    .int()
    .min(1)
    .max(BACKFILL_MAX_MESSAGES)
    .optional()
    .default(200),
  accountId: z.string().uuid().optional(),
  banks: z.array(z.string().trim().min(1).max(32)).min(1).max(2).optional(),
});

export const mailScanBodySchema = z.object({
  password: z.string().max(200).optional().default(""),
  maxMessages: z.coerce
    .number()
    .int()
    .min(1)
    .max(BACKFILL_MAX_MESSAGES)
    .optional()
    .default(200),
  month: monthField,
});

export type EnablePoolingBody = z.infer<typeof enablePoolingBodySchema>;
export type MailScanBody = z.infer<typeof mailScanBodySchema>;

export const unlockStatementBodySchema = z.object({
  password: z.string().min(1, "Enter the statement password").max(200),
});

export const connectMailBodySchema = z
  .object({
    email: z.string().trim().email("Enter the email address of the mailbox"),
    provider: z.enum(MAIL_PROVIDER_IDS),
    host: z
      .string()
      .trim()
      .max(253)
      .regex(/^[a-z0-9.-]+$/i, "Enter a server name like imap.example.com")
      .optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    password: z.string().min(1, "Enter the app password").max(200),
  })
  .refine((body) => body.provider !== "custom" || Boolean(body.host), {
    path: ["host"],
    message: "Enter your mail server's IMAP address",
  });

export type ConnectMailBody = z.infer<typeof connectMailBodySchema>;
