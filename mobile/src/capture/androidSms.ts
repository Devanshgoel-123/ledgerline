import { PermissionsAndroid, Platform } from "react-native";
import { LedgerlineSms } from "../../modules/ledgerline-sms";
import type { IncomingMessage } from "@/core/capture";
import { getSetting, setSetting } from "@/db/repo";
import type { Db } from "@/db/schema";

/**
 * Automatic capture on Android: bank SMS read from the phone's own inbox.
 *
 * Ledgerline reads only messages from business sender IDs (see
 * modules/ledgerline-sms), only after the person turns capture on and allows
 * it, and only messages newer than the last read. Everything is parsed on the
 * phone; nothing is uploaded.
 */

/** Settings keys. */
const ENABLED = "smsCapture";
const SINCE = "smsSince";
/** At most this many messages per read, so a first read of a busy inbox stays quick. */
const BATCH = 500;

/** Whether this build can read SMS: Android with the native module (not Expo Go or iOS). */
export function smsCaptureSupported(): boolean {
  return Platform.OS === "android" && LedgerlineSms !== null;
}

export function smsPermissionGranted(): boolean {
  try {
    return smsCaptureSupported() && LedgerlineSms!.hasPermission();
  } catch {
    return false;
  }
}

export async function smsCaptureEnabled(db: Db): Promise<boolean> {
  return smsCaptureSupported() && (await getSetting<boolean>(db, ENABLED, false));
}

/** The first of this month: turning capture on also picks up this month's payments so far. */
export function startOfMonthMillis(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

/**
 * Asks for SMS access and turns capture on. Returns "denied" when the
 * person said no, "blocked" when Android won't ask again (settings only).
 */
export async function turnOnSmsCapture(db: Db): Promise<"on" | "denied" | "blocked" | "unsupported"> {
  if (!smsCaptureSupported()) return "unsupported";
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: "Read bank messages?",
    message:
      "Ledgerline reads payment messages from your bank to add them for you. Only messages from banks and businesses are read, on this phone. Nothing is uploaded.",
    buttonPositive: "Allow",
    buttonNegative: "Not now",
  });
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return "blocked";
  if (result !== PermissionsAndroid.RESULTS.GRANTED) return "denied";
  if ((await getSetting<number | null>(db, SINCE, null)) === null) await setSetting(db, SINCE, startOfMonthMillis());
  await setSetting(db, ENABLED, true);
  return "on";
}

export async function turnOffSmsCapture(db: Db): Promise<void> {
  await setSetting(db, ENABLED, false);
}

/**
 * New bank messages since the last read. Call `done` once they're saved, so
 * the next read starts after them; if saving fails they're read again.
 */
export async function readNewSms(db: Db): Promise<{ messages: IncomingMessage[]; done: () => Promise<void> }> {
  const nothing = { messages: [], done: async () => {} };
  if (!(await smsCaptureEnabled(db)) || !smsPermissionGranted()) return nothing;
  const since = await getSetting<number>(db, SINCE, startOfMonthMillis());
  const raw = await LedgerlineSms!.readInbox(since, BATCH);
  if (!raw.length) return nothing;
  const newest = Math.max(...raw.map((sms) => sms.receivedAt));
  return {
    messages: raw.map((sms) => ({ text: sms.text, sender: sms.sender, receivedAt: new Date(sms.receivedAt) })),
    done: () => setSetting(db, SINCE, newest),
  };
}
