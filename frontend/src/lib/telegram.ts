export type TelegramVerifyState = {
  phone: string;
  codeSent: boolean;
  expiresAt: string | null;
  botUrl: string | null;
};

export type TelegramConnection =
  | "not_configured"
  | "not_linked"
  | "bot_offline"
  | "chat_blocked"
  | "connected";

export type TelegramStatus = {
  configured: boolean;
  linked: boolean;
  /** Absent from older APIs, which only knew whether a chat was saved. */
  connection?: TelegramConnection;
  bot?: { mode: "polling" | "webhook" | "off"; online: boolean; problem: string | null };
  chatProblem?: string | null;
  botUsername: string | null;
  phone?: string | null;
  verify?: TelegramVerifyState | null;
  deepLink?: string | null;
  startCommand?: string | null;
};

export function telegramConnectHint(status: TelegramStatus): string {
  if (!status.configured) {
    return "Telegram is not enabled on this server yet.";
  }
  if (status.linked && status.connection === "bot_offline") {
    return `Linked, but the bot is not receiving messages on this server, so it will not reply. ${status.bot?.problem ?? ""}`.trim();
  }
  if (status.linked && status.connection === "chat_blocked") {
    return `Linked, but Telegram will not deliver to your chat: ${status.chatProblem ?? "the bot may be blocked"}`;
  }
  if (status.linked) {
    return status.phone
      ? `Linked to ${status.phone}. This chat is your account.`
      : "Linked. This chat is your account. Send /sync to pull Gmail, or a statement PDF.";
  }
  if (status.verify?.codeSent) {
    return `Code sent to ${status.verify.phone}. Enter it here. It expires in 10 minutes.`;
  }
  if (status.verify) {
    return `Waiting for ${status.verify.phone}. Open Telegram and tap Share my number. The code is sent only after Telegram confirms that number.`;
  }
  return "Enter the mobile number on your Telegram account. We'll send a code in that chat after you share the number with the bot.";
}

export type TelegramPill = { label: string; tone: "on" | "off" | "warn" };

/** "Connected" only when the chat is linked and the bot is actually reachable. */
export function telegramPill(status: TelegramStatus | null): TelegramPill {
  if (!status?.linked) return { label: "Not linked", tone: "off" };
  switch (status.connection) {
    case "bot_offline":
      return { label: "Bot offline", tone: "warn" };
    case "chat_blocked":
      return { label: "Not reachable", tone: "warn" };
    case "connected":
    case undefined:
      return { label: "Connected", tone: "on" };
    default:
      return { label: "Not linked", tone: "off" };
  }
}
