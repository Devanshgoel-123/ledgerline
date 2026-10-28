import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { REMINDER_COPY, REMINDER_ROUTES, type ReminderSettings } from "./settings";

// Reminders are local notifications scheduled on the phone. No push server,
// no account: nothing leaves the device.

const CHANNEL = "reminders";

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Reminders",
    description: "Your daily nudge to add expenses, and the monthly statement check",
    importance: AndroidImportance.DEFAULT,
  });
}

export type PermissionState = "granted" | "denied" | "undetermined";

export async function notificationPermission(): Promise<PermissionState> {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return "granted";
  return status.canAskAgain ? "undetermined" : "denied";
}

/** Asks once. Returns whether reminders can be shown. */
export async function askForNotifications(): Promise<PermissionState> {
  await ensureChannel();
  const current = await notificationPermission();
  if (current !== "undetermined") return current;
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return result.granted ? "granted" : result.canAskAgain ? "undetermined" : "denied";
}

/** Replaces every scheduled reminder with what the settings say. */
export async function applyReminders(settings: ReminderSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.daily && !settings.monthlyStatement) return;
  await ensureChannel();
  if ((await notificationPermission()) !== "granted") return;

  if (settings.daily) {
    for (const time of settings.times) {
      await Notifications.scheduleNotificationAsync({
        content: { ...REMINDER_COPY.daily, data: { url: REMINDER_ROUTES.daily } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.hour,
          minute: time.minute,
          channelId: CHANNEL,
        },
      });
    }
  }
  if (settings.monthlyStatement) {
    await Notifications.scheduleNotificationAsync({
      content: { ...REMINDER_COPY.monthly, data: { url: REMINDER_ROUTES.monthly } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: settings.monthlyDay,
        hour: 10,
        minute: 0,
        channelId: CHANNEL,
      },
    });
  }
}

/** The screen a tapped reminder asks for, if it is one of ours. */
export function routeFromResponse(response: Notifications.NotificationResponse | null): string | null {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const url = response.notification.request.content.data?.url;
  return url === REMINDER_ROUTES.daily || url === REMINDER_ROUTES.monthly ? url : null;
}

/** A tapped reminder opens Add expense (daily) or the statement check (monthly). */
export function useOpenReminders(): void {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const route = routeFromResponse(last ?? null);
    if (!route) return;
    // Let the tabs mount first so the screen opens on top of them.
    const timer = setTimeout(() => router.push(route as never), 50);
    void Notifications.clearLastNotificationResponseAsync();
    return () => clearTimeout(timer);
  }, [last]);
}
