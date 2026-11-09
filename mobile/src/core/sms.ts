import type { PaymentMethod, TxType } from "./model";

/**
 * Reads one bank SMS (or a notification's text) into a payment, on the phone.
 * Returns null for anything that isn't a completed payment: OTPs, collect
 * requests, failed transactions, bill reminders, balance updates and offers.
 *
 * Formats differ by bank and change without notice, so this is deliberately
 * cautious: when the amount or direction is unclear, it returns null and the
 * message is left alone rather than guessed at.
 */
export interface ParsedMessage {
  amount: number;
  type: TxType;
  /** YYYY-MM-DD from the message, or the day it was received. */
  date: string;
  /** Who was paid or who paid you, as printed. Null when only a UPI id is given. */
  party: string | null;
  upiId: string | null;
  /** The bank's reference (UPI ref, RRN), used to avoid adding a payment twice. */
  reference: string | null;
  /** Last digits of your account or card, as printed. */
  account: string | null;
  method: PaymentMethod;
  bank: string | null;
}

const NOT_A_PAYMENT = [
  /\botp\b|one[\s-]time password|verification code|\bcode is\b/i,
  /\b(has )?requested\b|\bcollect request\b|\brequest(ing)? (money|payment)\b|\bapprove\b.*\bupi pin\b/i,
  /\b(failed|declined|unsuccessful|could not be processed|not processed)\b/i,
  /\b(is|are) due\b|\bdue (date|on|by)\b|\bminimum (amount )?due\b|\bstatement (is )?generated\b|\bbill (of|for) .* (is )?due\b/i,
  /\bpre-?approved\b|\bapply now\b|\bloan (of|upto|up to)\b|\boffer\b.*\b(t&c|click|apply)\b/i,
  /\bwill be (debited|deducted)\b|\bscheduled\b|\bmandate\b.*\b(created|registered)\b|\bauto-?pay\b.*\b(set|registered)\b/i,
];

// "Rs.250", "Rs 250", "Rs:350" (Union Bank), "INR 5.00", "₹99".
const MONEY = String.raw`(?:rs[.:]?|inr|₹)`;
// Indian grouping (1,00,000) or plain digits; never stop mid-number ("5000" is not "500").
const NUMBER = String.raw`(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?(?![\d,])|\d+(?:\.\d{1,2})?(?!\d))`;
const AMOUNT_WITH_CURRENCY = new RegExp(String.raw`${MONEY}\s*${NUMBER}`, "i");
const AMOUNT_AFTER_VERB = new RegExp(String.raw`\b(?:debited|credited|spent|paid|sent)\s+(?:by|with|for|of)?\s*${NUMBER}\b`, "i");

const CREDIT_TO_ACCOUNT = [
  /\bcredited\s+(?:to|in|into)\b[^.;]{0,40}\b(?:a\/c|acct|account|ac)\b/i,
  /\b(?:a\/c|acct|account|ac)\b(?:\s*no\.?)?\s*[x*]*\d{2,6}\s+(?:is\s+|has been\s+)?credited\b/i,
  /\b(?:you have )?received\b|\brefund(?:ed)?\b|\breversed\b|\bdeposited\b/i,
];
const DEBIT_WORDS = /\b(debited|spent|sent|paid|withdrawn|purchase|debit of|txn of|transferred from)\b/i;
// PNB, BOI and ICICI debits also say the payee was credited ("debited ... and credited to A/c of SWIGGY"):
// when a message says both, the word that comes first is what happened to your account.
const DEBITED_OR_CREDITED = /\b(debited|credited)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The first date printed in the message, if it's plausible (not after today, at most 60 days old). */
export function messageDate(text: string, receivedOn: string): string | null {
  const candidates: (string | null)[] = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) candidates.push(validDate(+m[1]!, +m[2]!, +m[3]!));
  for (const m of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)) candidates.push(validDate(+m[3]!, +m[2]!, +m[1]!));
  for (const m of text.matchAll(/\b(\d{1,2})[\s-]?([A-Za-z]{3,4})[\s-]?(\d{2,4})\b/g)) {
    const month = MONTHS[m[2]!.toLowerCase()];
    if (month) candidates.push(validDate(+m[3]!, month, +m[1]!));
  }
  const received = new Date(`${receivedOn}T12:00:00Z`).getTime();
  for (const iso of candidates) {
    if (!iso) continue;
    const days = (received - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000;
    if (days >= -1 && days <= 60) return iso;
  }
  return null;
}

function amountOf(text: string): number | null {
  const raw = text.match(AMOUNT_WITH_CURRENCY)?.[1] ?? text.match(AMOUNT_AFTER_VERB)?.[1];
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

function directionOf(text: string): TxType | null {
  if (/\bdebited\b/i.test(text) && /\bcredited\b/i.test(text)) {
    return text.match(DEBITED_OR_CREDITED)![1]!.toLowerCase() === "debited" ? "debit" : "credit";
  }
  if (CREDIT_TO_ACCOUNT.some((pattern) => pattern.test(text))) return "credit";
  if (DEBIT_WORDS.test(text)) return "debit";
  if (/\bcredited\b/i.test(text)) return "credit";
  return null;
}

const UPI_ID = /\b([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9.]{1,30})\b/i;
const OWN_ACCOUNT = /\b(a\/c|acct|account|bank|card|ac)\b|^[x*]*\d+$/i;
const STOP = String.raw`(?=\s+(?:on|from|ref|refno|upi|via|for|dated|avl|bal|info|txn|not you|if not|\(|-|\.)\b|[.;,(]|$)`;

function cleanParty(raw: string | undefined): string | null {
  if (!raw) return null;
  const party = raw
    .replace(/\s+/g, " ")
    .replace(/^(vpa|upi id|m\/s|mr\.?|ms\.?)\s+/i, "")
    .replace(/[\s.,:-]+$/, "")
    .trim();
  if (party.length < 2 || OWN_ACCOUNT.test(party) || UPI_ID.test(party) || /^\d+$/.test(party)) return null;
  return party.slice(0, 60);
}

// Axis and others: "UPI/P2A/667790166602/DEVANSH GOEL", the name running to the next slash or line of boilerplate.
const P2X_NAME = /UPI\/P2[MA]\/\d+\/([A-Za-z0-9 .&'_-]{2,50}?)(?=\/|\s+(?:not you|avl|bal|ref|axis bank)\b|[.;]|$)/i;

function partyOf(text: string, type: TxType): string | null {
  const name = String.raw`([A-Za-z0-9][A-Za-z0-9 .&'_@-]{1,50}?)`;
  const patterns =
    type === "debit"
      ? [
          P2X_NAME,
          new RegExp(String.raw`;\s*${name}\s+credited\b`, "i"),
          new RegExp(String.raw`\b(?:trf|transfer(?:red)?|sent|paid)\s+to\s+${name}${STOP}`, "i"),
          new RegExp(String.raw`\bat\s+${name}${STOP}`, "i"),
          new RegExp(String.raw`\bto\s+(?:vpa\s+)?${name}${STOP}`, "i"),
        ]
      : [
          P2X_NAME,
          new RegExp(String.raw`\bfrom\s+(?:vpa\s+)?${name}${STOP}`, "i"),
          new RegExp(String.raw`\bby\s+(?:neft|imps|rtgs)[\s/:*-]+${name}${STOP}`, "i"),
          // "credited by Rs.500" is the amount, not who paid.
          new RegExp(String.raw`\bby\s+(?!neft|imps|rtgs|upi|cash\b|rs\b|inr\b|₹)${name}${STOP}`, "i"),
          new RegExp(String.raw`;\s*${name}\s+debited\b`, "i"),
        ];
  for (const pattern of patterns) {
    const party = cleanParty(text.match(pattern)?.[1]);
    if (party) return party;
  }
  return null;
}

function referenceOf(text: string): string | null {
  return (
    text.match(/\b(?:upi\s*ref(?:erence)?(?:\s*no)?|ref(?:\s*no)?|refno|rrn|utr|upi)\b[\s.:#-]*(\d{9,16})\b/i)?.[1] ??
    text.match(/UPI\/P2[MA]\/(\d{9,16})\//i)?.[1] ??
    null
  );
}

function accountOf(text: string): string | null {
  return text.match(/\b(?:a\/c|acct|account|ac|card)\b(?:\s*no\.?)?(?:\s*ending)?(?:\s*with)?\s*[x*]*\s*(\d{3,6})\b/i)?.[1] ?? null;
}

const BANKS: [RegExp, string][] = [
  [/hdfc/i, "HDFC"],
  [/icici/i, "ICICI"],
  [/\bsbi\b|sbiinb|sbipsg|state bank/i, "SBI"],
  [/axis/i, "Axis"],
  [/kotak|kotakb/i, "Kotak"],
  [/\bpnb\b|punjab national/i, "PNB"],
  [/bank of baroda|\bbob\b/i, "Bank of Baroda"],
  [/idfc/i, "IDFC First"],
  [/yes ?bank/i, "Yes Bank"],
  [/indusind/i, "IndusInd"],
  [/\bau (small finance )?bank|aubank/i, "AU"],
  [/federal/i, "Federal"],
  [/canara/i, "Canara"],
  [/union bank/i, "Union Bank"],
  [/central bank/i, "Central Bank"],
  [/indian overseas|\biob\b/i, "Indian Overseas Bank"],
  [/\bindian bank\b/i, "Indian Bank"],
  [/bank of india|\bboi\b/i, "Bank of India"],
  [/bank of maharashtra|\bmahabk\b/i, "Bank of Maharashtra"],
  [/\buco\b/i, "UCO"],
  [/\bidbi\b/i, "IDBI"],
  [/\brbl\b/i, "RBL"],
  [/bandhan/i, "Bandhan"],
  [/paytm/i, "Paytm Payments Bank"],
  [/airtel payments/i, "Airtel Payments Bank"],
  [/\bamex\b|american express/i, "Amex"],
];

function bankOf(text: string, sender: string | null): string | null {
  // The sender ID names the bank best ("AD-KOTAKB"). In the text, a UPI id
  // like netflix@hdfcbank names the payee's bank, not yours: leave those out.
  for (const [pattern, name] of BANKS) if (pattern.test(sender ?? "")) return name;
  const own = text.replace(/\S+@\S+/g, " ");
  for (const [pattern, name] of BANKS) if (pattern.test(own)) return name;
  return null;
}

export function parseBankMessage(
  raw: string,
  options: { sender?: string | null; receivedOn: string },
): ParsedMessage | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 15 || text.length > 800) return null;
  if (NOT_A_PAYMENT.some((pattern) => pattern.test(text))) return null;

  const amount = amountOf(text);
  const type = directionOf(text);
  if (!amount || !type) return null;

  const upiId = text.match(UPI_ID)?.[1]?.toLowerCase() ?? null;
  const reference = referenceOf(text);
  // UPI reference numbers (RRN) are 12 digits; card messages say "card".
  const method: PaymentMethod = /\bcard\b/i.test(text)
    ? "card"
    : /\bupi\b|\bvpa\b|@/i.test(text) || reference?.length === 12
      ? "upi"
      : "other";
  return {
    amount,
    type,
    date: messageDate(text, options.receivedOn) ?? options.receivedOn,
    party: partyOf(text, type),
    upiId: upiId && !/@(hdfcbank|icicibank|sbi|axisbank|kotak)\.(com|co\.in)$/.test(upiId) ? upiId : null,
    reference,
    account: accountOf(text),
    method,
    bank: bankOf(text, options.sender ?? null),
  };
}
