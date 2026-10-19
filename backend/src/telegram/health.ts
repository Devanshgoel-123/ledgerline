/**
 * Whether the bot is actually receiving updates, and which linked chats
 * Telegram has refused. Kept in memory: a restart re-learns both within one
 * poll or the next message sent.
 */

export type TelegramMode = "polling" | "webhook" | "off";

export type TelegramBotHealth = {
  mode: TelegramMode;
  online: boolean;
  lastOkAt: string | null;
  lastError: string | null;
};

/** A long poll returns within 25 s; three missed polls means the bot is not listening. */
const POLLING_STALE_MS = 90_000;
/** Webhook health is re-checked every minute with getWebhookInfo. */
const WEBHOOK_STALE_MS = 3 * 60_000;

let mode: TelegramMode = "off";
let lastOkAt: number | null = null;
let lastErrorAt: number | null = null;
let lastError: string | null = null;
const unreachableChats = new Map<string, string>();

export function setTelegramMode(next: TelegramMode): void {
  mode = next;
}

export function markTelegramOk(at = Date.now()): void {
  lastOkAt = at;
}

export function markTelegramError(reason: string, at = Date.now()): void {
  lastErrorAt = at;
  lastError = reason.slice(0, 200);
}

export function telegramBotHealth(now = Date.now()): TelegramBotHealth {
  const staleAfter = mode === "webhook" ? WEBHOOK_STALE_MS : POLLING_STALE_MS;
  const fresh = lastOkAt != null && now - lastOkAt <= staleAfter;
  const failingSinceOk = lastErrorAt != null && (lastOkAt == null || lastErrorAt > lastOkAt);
  return {
    mode,
    online: mode !== "off" && fresh && !failingSinceOk,
    lastOkAt: lastOkAt == null ? null : new Date(lastOkAt).toISOString(),
    lastError: failingSinceOk ? lastError : null,
  };
}

/** Telegram said this chat cannot receive messages (bot blocked, chat gone). */
export function markChatUnreachable(chatId: string, reason: string): void {
  unreachableChats.set(chatId, reason.slice(0, 200));
}

export function markChatReachable(chatId: string): void {
  unreachableChats.delete(chatId);
}

export function chatUnreachableReason(chatId: string): string | null {
  return unreachableChats.get(chatId) ?? null;
}

export function resetTelegramHealthForTests(): void {
  mode = "off";
  lastOkAt = null;
  lastErrorAt = null;
  lastError = null;
  unreachableChats.clear();
}
