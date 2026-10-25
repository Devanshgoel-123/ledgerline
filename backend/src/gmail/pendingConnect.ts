import { randomBytes } from "node:crypto";
import type { exchangeCode } from "./client.js";

type GoogleTokens = Awaited<ReturnType<typeof exchangeCode>>;

/**
 * A Gmail grant for an address other than the account's own verified email
 * waits here until the signed-in user confirms it. Otherwise anyone could send
 * a victim their own connect link and receive the victim's Gmail.
 */
const PENDING_TTL_MS = 10 * 60_000;
const pending = new Map<string, { userId: string; tokens: GoogleTokens; expiresAt: number }>();

export function holdGmailConnection(userId: string, tokens: GoogleTokens): string {
  const now = Date.now();
  for (const [key, entry] of pending) if (entry.expiresAt <= now) pending.delete(key);
  const nonce = randomBytes(24).toString("base64url");
  pending.set(nonce, { userId, tokens, expiresAt: now + PENDING_TTL_MS });
  return nonce;
}

/** One use only. Null when unknown, expired, or started by a different account. */
export function takeGmailConnection(nonce: string, userId: string): GoogleTokens | null {
  const entry = pending.get(nonce);
  if (!entry) return null;
  pending.delete(nonce);
  if (entry.expiresAt <= Date.now() || entry.userId !== userId) return null;
  return entry.tokens;
}

