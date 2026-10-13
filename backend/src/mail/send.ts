import { appendFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../logger/index.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Outbox used by tests instead of SMTP. */
export const testOutbox: Mail[] = [];

/** True when this server can actually deliver email. */
export function mailConfigured(): boolean {
  return Boolean(config.mail.smtpUrl) || !config.isProduction;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Send through SMTP_URL. Without it, outside production the mail is logged (and kept in
 * testOutbox) so local development and tests can follow the link; production refuses.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (config.mail.smtpUrl) {
    transport ??= nodemailer.createTransport(config.mail.smtpUrl);
    await transport.sendMail({ from: config.mail.from, ...mail });
    return;
  }
  if (config.isProduction) throw new Error("Email is not configured on this server");
  testOutbox.push(mail);
  // Browser tests run the API in another process; let them read the mail from a file.
  if (process.env.MAIL_OUTBOX_FILE) appendFileSync(process.env.MAIL_OUTBOX_FILE, `${JSON.stringify(mail)}\n`);
  logger.info({ to: mail.to, subject: mail.subject, body: mail.text }, "mail (not sent: SMTP_URL is empty)");
}
