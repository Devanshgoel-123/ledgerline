import { addEntry, linkMessage, messageSeen } from "@/db/repo";
import type { Db } from "@/db/schema";
import type { Category } from "./catalog";
import { classify } from "./classify";
import { fromIsoDate, isoDate } from "./dates";
import type { Entry, Rule } from "./model";
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

export function messageRef(parsed: ParsedMessage, text: string): string {
  return parsed.reference ? `ref:${parsed.reference}` : `txt:${fingerprint(text)}`;
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

export async function captureMessage(
  db: Db,
  message: IncomingMessage,
  context: { entries: Entry[]; rules: Rule[]; categories: Category[] },
): Promise<CaptureOutcome> {
  const receivedOn = isoDate(message.receivedAt ?? new Date());
  const parsed = parseBankMessage(message.text, { sender: message.sender, receivedOn });
  if (!parsed) return { status: "not-a-payment" };

  const ref = messageRef(parsed, message.text);
  if (await messageSeen(db, ref)) return { status: "duplicate", parsed };

  const existing = findSameManualPayment(context.entries, parsed);
  if (existing) {
    await linkMessage(db, existing.id, ref);
    return { status: "linked", entryId: existing.id, parsed };
  }

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
    merchant: suggestion.merchant ?? parsed.party,
    payee: suggestion.payee,
    upiId: parsed.upiId,
    providerId: suggestion.providerId,
    categorySlug: suggestion.categorySlug,
    classificationSource: suggestion.classificationSource,
    method: parsed.method,
    origin: "manual",
    note: parsed.bank ? `From ${parsed.bank} SMS${parsed.account ? ` · ${parsed.account}` : ""}` : "From a bank message",
    messageRef: ref,
    needsReview: true,
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
