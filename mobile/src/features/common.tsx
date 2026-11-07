import { router } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { monthAnalytics, monthDetail } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { currentMonth, shiftMonth } from "@/core/dates";
import { formatInr, formatMonthShort, formatMonthTitle, formatShortDate } from "@/core/format";
import type { Entry } from "@/core/model";
import { myShare } from "@/core/shared";
import { removeSamples } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, Notice } from "@/ui/components";
import { MerchantAvatar } from "@/ui/CategoryVisual";
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

/** The month day by day, split by category, plus last month's days for pacing. */
export function useMonthDetail() {
  const { entries, month, categories } = useLedger();
  return useMemo(() => {
    const people = [...new Set(entries.map((entry) => entry.payee).filter((name): name is string => Boolean(name)))];
    return monthDetail({ entries, month, categories, people });
  }, [entries, month, categories]);
}

/** ‹ October 2026 › — the web's month picker. */
export function MonthSwitcher() {
  const { c } = useTheme();
  const { month, setMonth } = useLedger();
  const latest = currentMonth();
  const canGoForward = month < latest;
  return (
    <View style={[s.switcher, { backgroundColor: c.bgMuted }]}>
      <Pressable
        onPress={() => setMonth(shiftMonth(month, -1))}
        accessibilityRole="button"
        accessibilityLabel={`Previous month, ${formatMonthTitle(shiftMonth(month, -1))}`}
        hitSlop={8}
        style={s.arrow}>
        <Icon name="back" size={13} color={c.foreground} />
      </Pressable>
      <Text style={[s.month, { color: c.foreground }]} accessibilityLabel={formatMonthTitle(month)}>
        {`${formatMonthShort(month)} ${month.slice(0, 4)}`}
      </Text>
      <Pressable
        onPress={() => canGoForward && setMonth(shiftMonth(month, 1))}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel={`Next month, ${formatMonthTitle(shiftMonth(month, 1))}`}
        accessibilityState={{ disabled: !canGoForward }}
        hitSlop={8}
        style={[s.arrow, { opacity: canGoForward ? 1 : 0.3 }]}>
        <Icon name="chevron" size={13} color={c.foreground} />
      </Pressable>
    </View>
  );
}

/** One payment in a list: who or what, category, date, amount. */
export function EntryRow({ entry, showDate = true }: { entry: Entry; showDate?: boolean }) {
  const { c } = useTheme();
  const { categories } = useLedger();
  const title = entry.merchant || entry.payee || entry.description || "Payment";
  const share = entry.type === "debit" && entry.splits.length ? myShare(entry.amount, entry.splits) : null;
  // Category and date only; where a row came from lives on its detail screen.
  const meta = [categoryLabel(entry.categorySlug, categories), showDate ? formatShortDate(entry.date) : null, entry.method === "cash" ? "Cash" : null]
    .filter(Boolean)
    .join(" · ");
  const amount = `${entry.type === "credit" ? "+" : ""}${formatInr(entry.amount)}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}, ${entry.type === "credit" ? "received" : "spent"} ${formatInr(entry.amount)}${share != null ? `, your share ${formatInr(share)}` : ""}`}
      style={({ pressed }) => [s.entry, { opacity: pressed ? 0.6 : 1 }]}>
      <MerchantAvatar providerId={entry.providerId} merchant={entry.merchant} categorySlug={entry.categorySlug} />
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
        {share != null ? <Text style={[s.entryMeta, { color: c.muted }]}>you {formatInr(share)}</Text> : null}
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
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    minHeight: 40,
  },
  arrow: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  month: { fontFamily: fonts.sansSemi, fontSize: 14, minWidth: 64, textAlign: "center" },
  entry: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: 6 },
  entryTitle: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20 },
  entryMeta: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 17 },
  entryAmount: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 20, ...tabular },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  addText: { fontFamily: fonts.sansSemi, fontSize: 15 },
});
