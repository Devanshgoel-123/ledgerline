/** Telegram and phone links, cleared when the local data is deleted. */
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
  displayName: null,
  avatarUrl: null,
  dailySpendLimit: null,
  ...UNLINKED_TELEGRAM,
} as const;

/** Placeholder that keeps the unique email column satisfied after deletion. */
export function deletedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`;
}
