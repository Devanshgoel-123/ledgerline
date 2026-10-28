import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type Name = ComponentProps<typeof SymbolView>["name"];

/** One icon name, drawn as an SF Symbol on iOS and a Material Symbol on Android. */
const ICONS = {
  add: { ios: "plus", android: "add", web: "add" },
  overview: { ios: "square.grid.2x2", android: "dashboard", web: "dashboard" },
  lifestyle: { ios: "chart.pie", android: "pie_chart", web: "pie_chart" },
  list: { ios: "list.bullet", android: "receipt_long", web: "receipt_long" },
  people: { ios: "person.2", android: "group", web: "group" },
  settings: { ios: "gearshape", android: "settings", web: "settings" },
  statement: { ios: "doc.text.magnifyingglass", android: "upload_file", web: "upload_file" },
  check: { ios: "checkmark", android: "check", web: "check" },
  close: { ios: "xmark", android: "close", web: "close" },
  bell: { ios: "bell", android: "notifications", web: "notifications" },
  chevron: { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  back: { ios: "chevron.left", android: "chevron_left", web: "chevron_left" },
  trash: { ios: "trash", android: "delete", web: "delete" },
  split: { ios: "arrow.triangle.branch", android: "call_split", web: "call_split" },
  lock: { ios: "lock", android: "lock", web: "lock" },
  search: { ios: "magnifyingglass", android: "search", web: "search" },
  info: { ios: "info.circle", android: "info", web: "info" },
  calendar: { ios: "calendar", android: "calendar_today", web: "calendar_today" },
} as const satisfies Record<string, Name>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}

export function iconFor(name: IconName) {
  return ICONS[name];
}
