/** Mail services with a known IMAP address. "custom" takes a host and port from the user. */
export const MAIL_PROVIDER_IDS = ["gmail", "yahoo", "icloud", "zoho", "outlook", "custom"] as const;

export type MailProviderId = (typeof MAIL_PROVIDER_IDS)[number];

export type MailProvider = {
  id: MailProviderId;
  label: string;
  host: string;
  port: number;
};

export const MAIL_PROVIDERS: Record<Exclude<MailProviderId, "custom">, MailProvider> = {
  gmail: { id: "gmail", label: "Gmail", host: "imap.gmail.com", port: 993 },
  yahoo: { id: "yahoo", label: "Yahoo Mail", host: "imap.mail.yahoo.com", port: 993 },
  icloud: { id: "icloud", label: "iCloud Mail", host: "imap.mail.me.com", port: 993 },
  zoho: { id: "zoho", label: "Zoho Mail", host: "imap.zoho.in", port: 993 },
  outlook: { id: "outlook", label: "Outlook", host: "outlook.office365.com", port: 993 },
};

/** Where to connect for a provider; a custom server needs its own host and port. */
export function mailServerFor(
  provider: MailProviderId,
  custom?: { host?: string; port?: number },
): { host: string; port: number } | null {
  if (provider !== "custom") return MAIL_PROVIDERS[provider];
  const host = custom?.host?.trim().toLowerCase();
  if (!host) return null;
  return { host, port: custom?.port ?? 993 };
}
