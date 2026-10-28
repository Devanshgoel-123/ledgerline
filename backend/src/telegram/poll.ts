import { config } from "../config.js";
import { TELEGRAM_API_BASE } from "../constants/telegram.js";
import { logger } from "../logger/index.js";
import { answerTelegramCallback, type TelegramUpdate } from "./client.js";
import { markTelegramError, markTelegramOk, setTelegramMode } from "./health.js";
import { handleTelegramUpdate } from "./service.js";

/** Updates the bot asks Telegram for. my_chat_member says when a user blocks or unblocks it. */
export const TELEGRAM_ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"];

const WEBHOOK_CHECK_MS = 60_000;

type TelegramReply<T> = { ok?: boolean; result?: T; description?: string; error_code?: number };

/**
 * With TELEGRAM_WEBHOOK_URL set, Telegram pushes updates to that URL.
 * Otherwise this process long-polls, in any NODE_ENV: no public URL or tunnel
 * is needed. Only one process per bot token may poll.
 */
export function startTelegram(): void {
  if (!config.telegram.enabled) {
    setTelegramMode("off");
    return;
  }
  if (config.telegram.webhookUrl) {
    setTelegramMode("webhook");
    void runWebhook(config.telegram.webhookUrl);
    return;
  }
  setTelegramMode("polling");
  void runPolling().catch((error: unknown) => {
    markTelegramError("polling stopped");
    logger.error({ err: error }, "telegram polling stopped");
  });
}

function failureReason(error: unknown): string {
  if (error && typeof error === "object" && "cause" in error && error.cause instanceof Error) {
    return error.cause.message;
  }
  if (error instanceof Error) return error.message.split("\n")[0]?.slice(0, 180) ?? error.message;
  return String(error);
}

/** The bot token is in the URL path, so errors are reported without the URL. */
async function telegramGet<T>(
  method: string,
  params: Record<string, string> = {},
): Promise<TelegramReply<T>> {
  const url = new URL(`${TELEGRAM_API_BASE}/bot${config.telegram.botToken}/${method}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as TelegramReply<T>;
  if (!response.ok && body.ok === undefined) {
    return { ok: false, error_code: response.status, description: response.statusText };
  }
  return body;
}

function replyError(reply: TelegramReply<unknown>): string {
  if (reply.error_code === 401) return "Telegram rejected the bot token";
  if (reply.error_code === 409) {
    return "Another process is reading this bot's updates (a webhook or a second API)";
  }
  return reply.description ?? `Telegram error ${reply.error_code ?? "unknown"}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPolling(): Promise<void> {
  try {
    const cleared = await telegramGet<boolean>("deleteWebhook");
    // Telegram accepted the token, so the bot is up before the first 25 s poll returns.
    if (cleared.ok) markTelegramOk();
    else logger.warn({ reason: replyError(cleared) }, "telegram webhook clear failed");
  } catch (error) {
    logger.warn({ reason: failureReason(error) }, "telegram webhook clear failed, polling anyway");
  }
  logger.info({ username: config.telegram.botUsername }, "telegram polling started");
  let offset = 0;
  let failing: string | null = null;
  let delay = 3_000;
  const lanes = new Map<string, Promise<void>>();
  const enqueue = (chatId: string, job: () => Promise<void>) => {
    const prev = lanes.get(chatId) ?? Promise.resolve();
    const next = prev.then(job, job);
    lanes.set(chatId, next);
    void next.finally(() => {
      if (lanes.get(chatId) === next) lanes.delete(chatId);
    });
  };
  for (;;) {
    let reply: TelegramReply<TelegramUpdate[]>;
    try {
      reply = await telegramGet<TelegramUpdate[]>("getUpdates", {
        timeout: "25",
        offset: String(offset),
        allowed_updates: JSON.stringify(TELEGRAM_ALLOWED_UPDATES),
      });
    } catch (error) {
      reply = { ok: false, description: `Telegram unreachable: ${failureReason(error)}` };
    }
    if (!reply.ok) {
      // A refused poll returns at once. Without the wait this loop would spin.
      const reason = replyError(reply);
      markTelegramError(reason);
      if (failing !== reason) {
        logger.warn({ reason }, "telegram polling failing, retrying");
        failing = reason;
      }
      await sleep(delay);
      delay = Math.min(delay * 2, 60_000);
      continue;
    }
    markTelegramOk();
    if (failing) {
      logger.info({ username: config.telegram.botUsername }, "telegram polling resumed");
      failing = null;
    }
    delay = 3_000;
    for (const update of reply.result ?? []) {
      offset = update.update_id + 1;
      // Stop the button spinner before any earlier update finishes. A mail
      // sync must not sit in front of the next getUpdates.
      if (update.callback_query?.id) void answerTelegramCallback(update.callback_query.id);
      const chatId = String(
        update.callback_query?.message?.chat.id ??
          update.callback_query?.from.id ??
          update.message?.chat.id ??
          update.my_chat_member?.chat.id ??
          "unknown",
      );
      enqueue(chatId, async () => {
        try {
          await handleTelegramUpdate(update);
        } catch (error) {
          logger.warn({ err: error, updateId: update.update_id }, "telegram update failed");
        }
      });
    }
  }
}

type WebhookInfo = { url?: string; last_error_date?: number; last_error_message?: string };

async function runWebhook(url: string): Promise<void> {
  let registered = false;
  for (;;) {
    try {
      if (!registered) {
        const set = await telegramGet<boolean>("setWebhook", {
          url,
          secret_token: config.telegram.webhookSecret,
          allowed_updates: JSON.stringify(TELEGRAM_ALLOWED_UPDATES),
        });
        if (!set.ok) throw new Error(replyError(set));
        registered = true;
        logger.info({ url }, "telegram webhook registered");
      }
      const info = await telegramGet<WebhookInfo>("getWebhookInfo");
      if (!info.ok) throw new Error(replyError(info));
      const result = info.result ?? {};
      if (result.url !== url) {
        registered = false;
        throw new Error("Telegram's webhook points somewhere else; registering again");
      }
      const recentError =
        result.last_error_date != null && Date.now() / 1000 - result.last_error_date < 300;
      if (recentError) {
        throw new Error(`Telegram cannot deliver to the webhook: ${result.last_error_message ?? "unknown error"}`);
      }
      markTelegramOk();
    } catch (error) {
      const reason = failureReason(error);
      markTelegramError(reason);
      logger.warn({ reason }, "telegram webhook unhealthy");
    }
    await sleep(WEBHOOK_CHECK_MS);
  }
}
