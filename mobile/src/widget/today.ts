import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { writeTodayStats } from "@/capture/inbox";
import { todayActivityProps, type TodayActivityProps, type TodayStats } from "@/core/today";

/**
 * Keeps the "Today" Live Activity (./TodayActivity.tsx) on the Lock Screen
 * and in the Dynamic Island, matching your entries. Called after every load
 * and write. iOS ends a Live Activity after about eight hours, so opening the
 * app starts a fresh one; between opens the payment popup updates it.
 */
type Activity = { update(props: TodayActivityProps, staleDate?: Date): Promise<void>; end(policy?: "default" | "immediate"): Promise<void> };
type Factory = { start(props: TodayActivityProps, url?: string, staleDate?: Date): Activity; getInstances(): Activity[] };

let factory: Factory | null | undefined;

function liveActivity(): Factory | null {
  if (factory !== undefined) return factory;
  factory = null;
  // Expo Go, web and Android have no widget module.
  if (Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoWidgets")) return factory;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = (require("./TodayActivity") as { default: Factory }).default;
  } catch {
    factory = null;
  }
  return factory;
}

function midnight(now = new Date()): Date {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

let last = "";

/** Start, update or end the activity. Never throws: it's a nicety, not the ledger. */
export async function syncTodayActivity(stats: TodayStats, enabled: boolean): Promise<void> {
  // The popup reads these to add a payment between app opens.
  writeTodayStats({ ...stats, enabled });
  const live = liveActivity();
  if (!live) return;
  try {
    const running = live.getInstances();
    if (!enabled) {
      last = "";
      await Promise.all(running.map((activity) => activity.end("immediate")));
      return;
    }
    const props = todayActivityProps(stats);
    const key = JSON.stringify(props);
    const [current, ...extra] = running;
    await Promise.all(extra.map((activity) => activity.end("immediate")));
    if (!current) {
      live.start(props, "ledgerline://", midnight());
    } else if (key !== last) {
      await current.update(props, midnight());
    }
    last = key;
  } catch {
    // Live Activities turned off for Ledgerline in iOS Settings, or not supported.
  }
}
