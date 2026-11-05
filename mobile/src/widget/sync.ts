import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { categoryLabel, type Category } from "@/core/catalog";
import { currentMonth, today } from "@/core/dates";
import { formatInr } from "@/core/format";
import type { Entry } from "@/core/model";
import { widgetShortcuts } from "@/core/quick";
import { myShare } from "@/core/shared";
import { categoryColorLight } from "@/ui/theme";
import type { QuickAddWidgetProps } from "./QuickAddWidget";

/** What you spent on a day or in a month: your share of splits, no investments or transfers. */
function spentIn(entries: Entry[], prefix: string): number {
  return entries
    .filter(
      (entry) =>
        entry.type === "debit" &&
        entry.origin !== "sample" &&
        entry.date.startsWith(prefix) &&
        !["investments", "brokerage", "self-transfer"].includes(entry.categorySlug ?? ""),
    )
    .reduce((sum, entry) => sum + (entry.splits.length ? myShare(entry.amount, entry.splits) : entry.amount), 0);
}

export function widgetProps(entries: Entry[], categories: Category[], now = new Date()): QuickAddWidgetProps {
  const day = today(now);
  const real = entries.filter((entry) => entry.origin !== "sample");
  return {
    today: formatInr(spentIn(real, day)),
    month: formatInr(spentIn(real, currentMonth(now))),
    empty: real.length === 0,
    shortcuts: widgetShortcuts(real, categories, day).map((slug) => ({
      slug,
      label: categoryLabel(slug, categories).slice(0, 12),
      color: categoryColorLight(slug),
    })),
  };
}

type WidgetHandle = { updateSnapshot(props: QuickAddWidgetProps): void };
let handle: WidgetHandle | null | undefined;

/** The widget, or null where there is none (Expo Go, web, Android). */
function widget(): WidgetHandle | null {
  if (handle !== undefined) return handle;
  handle = null;
  // Expo Go and web have no widget module; asking first avoids a module error.
  if (Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoWidgets")) return handle;
  try {
    // Loaded lazily: the native module only exists in a development or store
    // build, and a static import would crash Expo Go at startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    handle = (require("./QuickAddWidget") as { default: WidgetHandle }).default;
  } catch {
    handle = null;
  }
  return handle;
}

/** Push the latest totals to the home-screen widget. Never throws. */
export function syncWidget(entries: Entry[], categories: Category[]): void {
  try {
    widget()?.updateSnapshot(widgetProps(entries, categories));
  } catch {
    // A widget that can't update shouldn't break saving an expense.
  }
}
