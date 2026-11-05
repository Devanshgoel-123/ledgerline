import { router } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { monthAnalytics } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { currentMonth, shiftMonth } from "@/core/dates";
import { formatInr, formatMonthTitle, formatShortDate } from "@/core/format";
import type { Entry } from "@/core/model";
import { myShare } from "@/core/shared";
import { removeSamples } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, Notice } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, tabular, useTheme } from "@/ui/theme";

/** The selected month's numbers, from the backend's totals code. */
export function useMonthAnalytics() {
  const { entries, month, categories, dailyLimit } = useLedger();
  return useMemo(() => {
    const people = [...new Set(entries.map((entry) => entry.payee).filter((name): name is string => Boolean(name)))];
    return monthAnalytics({ entries, month, categories, dailyLimit, people });
  }, [entries, month, categories, dailyLimit]);
}

/** ‹ October 2026 › — the web's month picker. */
export function MonthSwitcher() {
  const { c } = useTheme();
  const { month, setMonth } = useLedger();
  const latest = currentMonth();
  const canGoForward = month < latest;
  return (
    <View style={[s.switcher, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <Pressable
        onPress={() => setMonth(shiftMonth(month, -1))}
        accessibilityRole="button"
        accessibilityLabel={`Previous month, ${formatMonthTitle(shiftMonth(month, -1))}`}
        hitSlop={8}
        style={s.arrow}>
        <Icon name="back" size={16} color={c.foreground} />
      </Pressable>
      <Text style={[s.month, { color: c.foreground }]} accessibilityRole="header">
        {formatMonthTitle(month)}
      </Text>
      <Pressable
        onPress={() => canGoForward && setMonth(shiftMonth(month, 1))}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel={`Next month, ${formatMonthTitle(shiftMonth(month, 1))}`}
        accessibilityState={{ disabled: !canGoForward }}
        hitSlop={8}
        style={[s.arrow, { opacity: canGoForward ? 1 : 0.3 }]}>
        <Icon name="chevron" size={16} color={c.foreground} />
      </Pressable>
    </View>
  );
}

/** One payment in a list: who or what, category, date, amount. */
export function EntryRow({ entry, showDate = true }: { entry: Entry; showDate?: boolean }) {
  const { c, onCategory, categoryColor } = useTheme();
  const { categories } = useLedger();
  const title = entry.merchant || entry.description || entry.payee || "Payment";
  const share = entry.type === "debit" && entry.splits.length ? myShare(entry.amount, entry.splits) : null;
  const meta = [
    categoryLabel(entry.categorySlug, categories),
    showDate ? formatShortDate(entry.date) : null,
    entry.method === "cash" ? "Cash" : entry.method === "card" ? "Card" : null,
    entry.origin === "statement" ? "From statement" : entry.messageRef ? "From SMS" : entry.origin === "sample" ? "Sample" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const amount = `${entry.type === "credit" ? "+" : "−"}${formatInr(entry.amount)}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}, ${entry.type === "credit" ? "received" : "spent"} ${formatInr(entry.amount)}${share != null ? `, your share ${formatInr(share)}` : ""}`}
      style={({ pressed }) => [s.entry, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[s.mark, { backgroundColor: categoryColor(entry.categorySlug) }]}>
        <Text style={[s.markText, { color: onCategory }]}>{title.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.entryTitle, { color: c.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[s.entryMeta, { color: c.muted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={[s.entryAmount, { color: entry.type === "credit" ? c.credit : c.foreground }]}>{amount}</Text>
        {share != null ? <Text style={[s.entryMeta, { color: c.muted }]}>yours {formatInr(share)}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Shown while sample rows exist, with a one-tap way out. */
export function SampleNotice() {
  const { entries, db, refresh } = useLedger();
  const count = entries.filter((entry) => entry.origin === "sample").length;
  if (!count) return null;
  return (
    <Notice
      title="You are looking at sample data."
      body={`These ${count} transactions are made up so you can explore. Your own entries are kept separate.`}
      action={
        <Button
          label="Remove sample data"
          variant="secondary"
          onPress={() =>
            Alert.alert("Remove sample data?", "Only the made-up transactions are removed.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                  await removeSamples(db);
                  await refresh();
                },
              },
            ])
          }
        />
      }
    />
  );
}

/** Header "Add" button. Opens Quick add unless told otherwise (People opens the full form for splits). */
export function AddButton({ label = "Add", href = "/quick" }: { label?: string; href?: "/quick" | "/add" }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label === "Add" ? "Add expense" : label}
      style={({ pressed }) => [s.add, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}>
      <Icon name="add" size={18} color={c.primaryForeground} />
      <Text style={[s.addText, { color: c.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: space[1],
  },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  month: { fontFamily: fonts.sansSemi, fontSize: 16 },
  entry: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: 6 },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  markText: { fontFamily: fonts.sansSemi, fontSize: 15 },
  entryTitle: { fontFamily: fonts.sansSemi, fontSize: 15 },
  entryMeta: { fontFamily: fonts.sans, fontSize: 12.5 },
  entryAmount: { fontFamily: fonts.monoMedium, fontSize: 15, ...tabular },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  addText: { fontFamily: fonts.sansSemi, fontSize: 15 },
});
