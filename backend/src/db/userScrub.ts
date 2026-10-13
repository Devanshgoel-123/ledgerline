/** Telegram and phone links, cleared when an account is deleted or claimed. */
export const UNLINKED_TELEGRAM = {
  telegramChatId: null,
  telegramLinkToken: null,
  telegramRemindMinute: null,
  telegramRemindedOn: null,
  telegramPendingFileId: null,
  telegramPendingFileName: null,
  telegramCategoryPingedAt: null,
  phoneE164: null,
  telegramPhonePending: null,
  telegramPhoneCodeHash: null,
  telegramPhoneCodeExpires: null,
  telegramPhoneChatId: null,
  telegramPhoneAttempts: 0,
  telegramPhoneSentAt: null,
} as const;

/** Personal fields cleared when an account is deleted. */
export const SCRUBBED_USER = {
  passwordHash: "!deleted",
  // Unique per Apple ID: a deleted account must not keep it, or that person cannot sign up again.
  appleSub: null,
  displayName: null,
  avatarUrl: null,
  dailySpendLimit: null,
  ...UNLINKED_TELEGRAM,
} as const;

/** Placeholder that keeps the unique email column satisfied after deletion. */
export function deletedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`;
}
