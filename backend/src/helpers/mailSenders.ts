import { catalogSendersForBank } from "../constants/bankMail.js";

/** Drop invalid handles and expand truncated HDFC alert senders. */
export function normalizeMailSender(raw: string): string | null {
  const trimmed = raw.trim().replace(/[()]/g, "");
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "alerts@hdfcbank") {
    return "alerts@hdfcbank.net";
  }
  if (trimmed.includes("@")) {
    const domain = trimmed.slice(trimmed.lastIndexOf("@") + 1);
    if (!domain.includes(".")) return null;
    return trimmed;
  }
  if (!trimmed.includes(".")) return null;
  return trimmed;
}

export function normalizeMailSenders(senders: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of senders) {
    const next = normalizeMailSender(raw);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

/**
 * Catalog senders for the bank, plus any extra addresses saved on the account.
 * Catalog wins so a new vendor is searched even when the account row is stale.
 */
export function sendersForBank(
  bankId: string,
  accountSenders: readonly string[] = [],
): string[] {
  return normalizeMailSenders([
    ...catalogSendersForBank(bankId),
    ...accountSenders,
  ]);
}

/** The bare address in a From header: `Bank <alerts@bank.in>` → `alerts@bank.in`. */
function headerAddress(fromAddress: string): string {
  const angled = /<([^<>]+)>\s*$/.exec(fromAddress);
  return (angled?.[1] ?? fromAddress).trim().toLowerCase();
}

/**
 * True when a From header's address belongs to one of the bank senders: the same
 * address, or an address on that domain or a subdomain of it. The display name does
 * not count, so `"alerts@hdfcbank.net" <x@other.com>` is not the bank.
 */
export function fromAddressMatchesSenders(
  fromAddress: string,
  senders: readonly string[],
): boolean {
  const address = headerAddress(fromAddress);
  const domain = address.slice(address.lastIndexOf("@") + 1);
  if (!address.includes("@") || !domain) return false;
  return normalizeMailSenders(senders).some((raw) => {
    const sender = raw.toLowerCase();
    if (sender.includes("@")) return address === sender;
    return domain === sender || domain.endsWith(`.${sender}`);
  });
}
