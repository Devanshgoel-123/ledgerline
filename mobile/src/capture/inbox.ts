import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { CaptureAnswer, IncomingMessage } from "@/core/capture";
import type { TodayStats } from "@/core/today";

/**
 * The hand-off between the iOS "Log bank message" action and the app.
 *
 * The action (ios/LogBankMessageIntent.swift, added by
 * plugins/withBankMessageIntent.js) runs in the background when a Shortcuts
 * automation fires. It can't run JavaScript, so it only writes each message
 * as its own small JSON file in the App Group folder the app and widget
 * share. The app reads and removes them here, at launch and whenever it comes
 * to the foreground. One file per message means a write and a read never
 * touch the same file.
 */
export const APP_GROUP = "group.app.ledgerline.mobile";
const FOLDER = "MessageInbox";

type InboxFile = { text?: unknown; sender?: unknown; receivedAt?: unknown; answer?: unknown };

/** What you told the popup, written by the action next to the message. Anything malformed is ignored. */
function readAnswer(raw: unknown): CaptureAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { amount?: unknown; type?: unknown; categorySlug?: unknown; repeat?: unknown };
  const answer: CaptureAnswer = {
    amount: typeof data.amount === "number" && Number.isFinite(data.amount) && data.amount > 0 ? data.amount : null,
    type: data.type === "credit" || data.type === "debit" ? data.type : null,
    categorySlug: typeof data.categorySlug === "string" && data.categorySlug ? data.categorySlug : null,
    repeat: data.repeat === true,
  };
  return answer.amount || answer.type || answer.categorySlug || answer.repeat ? answer : null;
}

function inboxDirectory(): Directory | null {
  if (Platform.OS !== "ios") return null;
  try {
    const group = Paths.appleSharedContainers?.[APP_GROUP];
    return group ? new Directory(group, FOLDER) : null;
  } catch {
    return null;
  }
}

/** Whether this build can receive messages from the iOS action (false in Expo Go). */
export function inboxAvailable(): boolean {
  return inboxDirectory() !== null;
}

/** Read every waiting message. Returns them with a function that deletes them once saved. */
export async function readInbox(): Promise<{ messages: IncomingMessage[]; done: () => void }> {
  const directory = inboxDirectory();
  if (!directory?.exists) return { messages: [], done: () => {} };
  const files = directory
    .list()
    .filter((item): item is File => item instanceof File && item.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const messages: IncomingMessage[] = [];
  const read: File[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(await file.text()) as InboxFile;
      const text = typeof data.text === "string" ? data.text : "";
      const answer = readAnswer(data.answer);
      // A message, or a payment typed into the popup without one.
      if (text.trim() || answer?.amount) {
        const received = typeof data.receivedAt === "string" ? new Date(data.receivedAt) : null;
        messages.push({
          text,
          sender: typeof data.sender === "string" ? data.sender : null,
          receivedAt: received && !Number.isNaN(received.getTime()) ? received : undefined,
          answer,
        });
      }
      read.push(file);
    } catch {
      // A half-written file: leave it for the next read. A file that is
      // older than a day and still unreadable is removed.
      if (file.modificationTime && Date.now() - file.modificationTime > 86_400_000) read.push(file);
    }
  }
  return {
    messages,
    done: () => {
      for (const file of read) {
        try {
          file.delete();
        } catch {
          // Already gone.
        }
      }
    },
  };
}

// Two small files the action and the app share next to the inbox; their
// names match plugins/native/LogBankMessageIntent.swift.
const EMPTY_MARKER = "CaptureEmptyMessage.json";
const SETTINGS = "CaptureSettings.json";
const CATEGORIES = "CaptureCategories.json";

function groupFile(name: string): File | null {
  if (Platform.OS !== "ios") return null;
  try {
    const group = Paths.appleSharedContainers?.[APP_GROUP];
    return group ? new File(group, name) : null;
  } catch {
    return null;
  }
}

/**
 * When the automation last ran without handing over the message (Message
 * not set to Shortcut Input), or null if every run has had one since.
 */
export async function emptyMessageSince(): Promise<string | null> {
  const file = groupFile(EMPTY_MARKER);
  if (!file?.exists) return null;
  try {
    const data = JSON.parse(await file.text()) as { at?: unknown };
    return typeof data.at === "string" ? data.at : null;
  } catch {
    return null;
  }
}

/** Whether the action notifies you about each payment it logs. On unless turned off. */
export async function captureNotificationsOn(): Promise<boolean> {
  const file = groupFile(SETTINGS);
  if (!file?.exists) return true;
  try {
    return (JSON.parse(await file.text()) as { notify?: unknown }).notify !== false;
  } catch {
    return true;
  }
}

export function setCaptureNotifications(on: boolean): void {
  const file = groupFile(SETTINGS);
  if (!file) return;
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify({ notify: on }));
  } catch {
    // The action falls back to notifying.
  }
}

/**
 * The categories the popup offers, most used first, so its buttons match
 * yours (custom ones included). Rewritten whenever entries change; the action
 * falls back to a built-in list until the app has written it once.
 */
export function writeCaptureCategories(choices: { debit: CaptureChoice[]; credit: CaptureChoice[] }): void {
  const file = groupFile(CATEGORIES);
  if (!file) return;
  try {
    const next = JSON.stringify(choices);
    if (file.exists) {
      if (file.textSync() === next) return;
    } else file.create();
    file.write(next);
  } catch {
    // The action uses its own list.
  }
}

/** root is the top-level category, which picks the icon the popup shows. */
export type CaptureChoice = { slug: string; label: string; root: string };

const TODAY = "TodayStats.json";

/**
 * Today's numbers for the "Today" Live Activity, for the payment popup to add
 * to between app opens (plugins/native/LogBankMessageIntent.swift).
 */
export function writeTodayStats(stats: TodayStats & { enabled: boolean }): void {
  const file = groupFile(TODAY);
  if (!file) return;
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify(stats));
  } catch {
    // The popup then leaves the activity for the app to update.
  }
}
