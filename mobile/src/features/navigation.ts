import { router } from "expo-router";

/**
 * Close a modal screen. A screen opened straight from a deep link (the
 * widget, an Android app shortcut, a reminder) can be the only screen in the
 * stack; going back would do nothing, so it lands on Overview instead.
 */
export function closeModal(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
