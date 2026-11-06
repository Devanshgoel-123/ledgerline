import type { ReminderSettings } from "./settings";

// Browsers have no scheduled local notifications. The web build (used to try
// the app on a computer) runs without reminders.

export type PermissionState = "granted" | "denied" | "undetermined";

export function configureNotifications(): void {}

export async function notificationPermission(): Promise<PermissionState> {
  return "denied";
}

export async function askForNotifications(): Promise<PermissionState> {
  return "denied";
}

export async function applyReminders(_settings: ReminderSettings): Promise<void> {}

export function useOpenReminders(): void {}
