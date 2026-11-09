import { addEntry, linkMessage, messageSeen } from "@/db/repo";
import type { Db } from "@/db/schema";
import { fitsType, PROVIDERS, type Category } from "./catalog";
import { classify } from "./classify";
import { fromIsoDate, isoDate } from "./dates";
import type { Entry, Rule, TxType } from "./model";
import { parseBankMessage, type ParsedMessage } from "./sms";

/**
 * One bank message in, at most one entry out. Every way a message reaches the
 * app goes through here: the iOS Shortcut (through the App Group inbox or the
 * ledgerline://capture link), pasting a message, and later Android SMS.
 *
 * Nothing is counted twice:
 * - the same message (same bank reference, or the same text) is skipped;
 * - a payment you already added by hand (same amount and direction, a day
 *   either way, not cash) is linked to the message instead of added again;
 * - a captured entry you deleted is remembered and never captured again.
 */

export type CaptureOutcome =
  | { status: "added"; entryId: string; parsed: ParsedMessage }
  | { status: "linked"; entryId: string; parsed: ParsedMessage }
  | { status: "duplicate"; parsed: ParsedMessage }
  | { status: "not-a-payment" };

export interface IncomingMessage {
  text: string;
  sender?: string | null;
  /** When the phone received it; defaults to now. */
  receivedAt?: Date;
  /**
   * What you told the iOS popup when the message arrived: the amount (typed
   * when the message had none Ledgerline could read, or corrected) and the
   * category you picked. Your answer wins over what the message says.
   */
  answer?: CaptureAnswer | null;
}

export interface CaptureAnswer {
  amount?: number | null;
  type?: TxType | null;
  categorySlug?: string | null;
  /**
   * The popup saw another message about this same payment a moment ago (a
   * bank's debit alert and its UPI confirmation, say) and didn't ask again.
   */
  repeat?: boolean | null;
}

const BRAND_NAMES = new Map(PROVIDERS.map((provider) => [provider.id, provider.canonicalName]));

function brandName(providerId: string | null | undefined): string | null {
  return providerId ? (BRAND_NAMES.get(providerId) ?? null) : null;
}

/** FNV-1a: a short, stable fingerprint for a message with no bank reference. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text.replace(/\s+/g, " ").trim().toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * What makes a message one payment. Money out keeps the plain bank
 * reference; money in gets its own, because both sides of a UPI transfer
 * carry the same reference: moving ₹10 from your HDFC to your Axis account
 * sends a "debited" SMS and a "credited" SMS with one RRN, and the second
 * must not be taken for a repeat of the first.
 */
export function messageRef(parsed: ParsedMessage, text: string): string {
  if (!parsed.reference) return `txt:${fingerprint(text)}`;
  return parsed.type === "credit" ? `ref:cr:${parsed.reference}` : `ref:${parsed.reference}`;
}

function shift(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** A hand-added entry that is almost certainly this payment. */
export function findSameManualPayment(entries: Entry[], parsed: ParsedMessage): Entry | null {
  const from = shift(parsed.date, -1);
  const to = shift(parsed.date, 1);
  return (
    entries.find(
      (entry) =>
        !entry.messageRef &&
        entry.origin === "manual" &&
        entry.method !== "cash" &&
        entry.type === parsed.type &&
        Math.abs(entry.amount - parsed.amount) < 0.005 &&
        entry.date >= from &&
        entry.date <= to,
    ) ?? null
  );
}

/** An entry from another bank message with the same amount and direction, around the same day. */
export function findSameMessagePayment(entries: Entry[], parsed: ParsedMessage): Entry | null {
  const from = shift(parsed.date, -1);
  const to = shift(parsed.date, 1);
  return (
    entries.find(
      (entry) =>
        entry.messageRef !== null &&
        entry.type === parsed.type &&
        Math.abs(entry.amount - parsed.amount) < 0.005 &&
        entry.date >= from &&
        entry.date <= to,
    ) ?? null
  );
}

export async function captureMessage(
  db: Db,
  message: IncomingMessage,
  context: { entries: Entry[]; rules: Rule[]; categories: Category[] },
): Promise<CaptureOutcome> {
  const receivedOn = isoDate(message.receivedAt ?? new Date());
  const answer = message.answer ?? null;
  const typed = answer?.amount && Number.isFinite(answer.amount) && answer.amount > 0 ? Math.round(answer.amount * 100) / 100 : null;
  const read = message.text.trim() ? parseBankMessage(message.text, { sender: message.sender, receivedOn }) : null;
  // No payment Ledgerline could read, but you typed the amount: that's the payment.
  const parsed: ParsedMessage | null = read
    ? // The app's reader decides money out or in; the popup's guess only fills in when it can't read the message.
      { ...read, amount: typed ?? read.amount }
    : typed
      ? { amount: typed, type: answer?.type ?? "debit", date: receivedOn, party: null, upiId: null, reference: null, account: null, method: "other", bank: null }
      : null;
  if (!parsed) return { status: "not-a-payment" };
  const chosen =
    answer?.categorySlug &&
    context.categories.some((category) => category.slug === answer.categorySlug) &&
    fitsType(answer.categorySlug, parsed.type, context.categories)
      ? answer.categorySlug
      : null;

  // A popup answer with no message text has nothing to fingerprint; when it arrived is what makes it one payment.
  const ref = message.text.trim()
    ? messageRef(parsed, message.text)
    : `pop:${(message.receivedAt ?? new Date()).getTime().toString(36)}`;
  if (await messageSeen(db, ref)) return { status: "duplicate", parsed };

  // The second message about a payment the popup just logged: not a new payment.
  if (answer?.repeat && findSameMessagePayment(context.entries, parsed)) return { status: "duplicate", parsed };

  const existing = findSameManualPayment(context.entries, parsed);
  if (existing) {
    await linkMessage(db, existing.id, ref);
    return { status: "linked", entryId: existing.id, parsed };
  }

  // Money in with the same reference as a payment out you already have: it went between your own accounts.
  const ownTransfer = parsed.type === "credit" && parsed.reference !== null && (await messageSeen(db, `ref:${parsed.reference}`));

  const description = parsed.party ?? parsed.upiId ?? (parsed.type === "credit" ? "Money in" : "Payment");
  const suggestion = classify(
    {
      description: [parsed.party, parsed.upiId].filter(Boolean).join(" ") || description,
      upiId: parsed.upiId,
      merchant: parsed.party,
      payee: null,
      amount: parsed.amount,
      type: parsed.type,
    },
    context.rules,
    context.categories,
  );
  const entryId = await addEntry(db, {
    date: parsed.date,
    amount: parsed.amount,
    type: parsed.type,
    description,
    // A shop Ledgerline knows goes by its own name ("Netflix", not "netflix@hdfcbank" or "NETFLIX").
    merchant: brandName(suggestion.providerId) ?? suggestion.merchant ?? parsed.party,
    payee: suggestion.payee,
    upiId: parsed.upiId,
    providerId: suggestion.providerId,
    categorySlug: chosen ?? (ownTransfer ? "self-transfer" : suggestion.categorySlug),
    classificationSource: chosen ? "user_override" : ownTransfer ? "own_transfer" : suggestion.classificationSource,
    method: parsed.method,
    origin: "manual",
    note: parsed.bank
      ? `From ${parsed.bank} SMS${parsed.account ? ` · ${parsed.account}` : ""}`
      : read
        ? "From a bank message"
        : "Added from the payment popup",
    messageRef: ref,
    // You already chose the category in the popup; nothing left to check.
    needsReview: !chosen,
  });
  return { status: "added", entryId, parsed };
}

/** Many messages, in order; context is refreshed between them by the caller's list. */
export async function captureMessages(
  db: Db,
  messages: IncomingMessage[],
  context: { entries: Entry[]; rules: Rule[]; categories: Category[] },
  reload: () => Promise<Entry[]>,
): Promise<CaptureOutcome[]> {
  const outcomes: CaptureOutcome[] = [];
  let entries = context.entries;
  for (const message of messages) {
    const outcome = await captureMessage(db, message, { ...context, entries });
    outcomes.push(outcome);
    if (outcome.status === "added" || outcome.status === "linked") entries = await reload();
  }
  return outcomes;
}
