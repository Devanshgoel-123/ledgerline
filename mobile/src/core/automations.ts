/**
 * Whether iOS automatic capture is working, and which of its automations
 * have fired. iOS gives apps no way to list Shortcuts automations, so this
 * reads it from what arrives: each automation triggers on one word
 * ("Rs", "INR", "debited"), so a message containing that word shows its
 * automation ran. Shown in Settings and on the capture screen.
 */

/**
 * The automations the setup asks for, one word each (iOS takes one per
 * automation). Between them they catch every major Indian bank's payment
 * SMS: "Sent Rs.180" (HDFC, Kotak), "INR 5.00 debited" (Axis, ICICI cards,
 * Amex), "debited by 150.0" with no currency (SBI). "Message Contains"
 * matches inside words too, so a chat with "yours" in it also runs the
 * action; Ledgerline drops those on the phone without a popup.
 */
export const TRIGGERS = [
  { word: "Rs", label: "Amounts in Rs", pattern: /\brs(?=[\s.:\d])/i },
  { word: "INR", label: "Amounts in INR", pattern: /\binr\b/i },
  { word: "debited", label: "Debited (SBI and others)", pattern: /\bdebited\b/i },
] as const;

export type TriggerWord = (typeof TRIGGERS)[number]["word"];

/** Stored as the "captureSeen" setting: when each word last arrived, and the last run of any kind. */
export interface CaptureSeen {
  lastRun: string | null;
  words: Partial<Record<TriggerWord, string>>;
}

export const NOTHING_SEEN: CaptureSeen = { lastRun: null, words: {} };

/** Fold newly arrived messages into what's been seen. */
export function noteMessages(seen: CaptureSeen, messages: { text: string; receivedAt?: Date }[], now: Date): CaptureSeen {
  if (!messages.length) return seen;
  const words = { ...seen.words };
  let lastRun = seen.lastRun;
  for (const message of messages) {
    const at = (message.receivedAt ?? now).toISOString();
    if (!lastRun || at > lastRun) lastRun = at;
    for (const trigger of TRIGGERS) {
      if (trigger.pattern.test(message.text) && (!words[trigger.word] || at > words[trigger.word]!)) words[trigger.word] = at;
    }
  }
  return { lastRun, words };
}

export type CaptureState = "off" | "on" | "no-text";

export interface CaptureStatus {
  state: CaptureState;
  /** The last time any automation ran, ISO. */
  lastRun: string | null;
  automations: { word: TriggerWord; label: string; seenAt: string | null }[];
}

/**
 * Off until something has arrived. "no-text" while the action's marker says
 * a run handed over no message (Message isn't set to Shortcut Input); the
 * action clears that marker as soon as a run brings the message again.
 */
export function captureStatus(seen: CaptureSeen, options: { emptySince: string | null; lastCaptured: string | null }): CaptureStatus {
  const lastRun = [seen.lastRun, options.lastCaptured, options.emptySince].filter((at): at is string => Boolean(at)).sort().at(-1) ?? null;
  const state: CaptureState = options.emptySince ? "no-text" : lastRun ? "on" : "off";
  return {
    state,
    lastRun,
    automations: TRIGGERS.map((trigger) => ({ word: trigger.word, label: trigger.label, seenAt: seen.words[trigger.word] ?? null })),
  };
}

/** "today, 7:12 PM", "yesterday", "9 Nov". */
export function whenSeen(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 0) {
    const hours = at.getHours();
    return `today, ${hours % 12 || 12}:${String(at.getMinutes()).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
  }
  if (days === 1) return "yesterday";
  return at.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
