import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryLabel, type Category } from "@/core/catalog";
import { formatDayLabel, formatInr } from "@/core/format";
import type { Entry } from "@/core/model";
import { EntryRow, MonthSwitcher, SampleNotice } from "@/features/common";
import { useLedger } from "@/state/ledger";
import { Chip, Empty, PageHeader, Segmented } from "@/ui/components";
import { fonts, radius, space, tabular, useTheme } from "@/ui/theme";

type Kind = "all" | "debit" | "credit";

export default function TransactionsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { entries, month, categories } = useLedger();
  const params = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [clearedCategory, setClearedCategory] = useState<string | null>(null);
  const category = params.category && params.category !== clearedCategory ? params.category : null;

  const sections = useMemo(
    () => groupByDay(filterEntries(entries, { month, query, kind, category, categories })),
    [entries, month, query, kind, category, categories],
  );
  const searching = query.trim().length > 0;

  return (
    <SectionList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space[3], paddingBottom: insets.bottom + 96, paddingHorizontal: space[4] }}
      sections={sections}
      keyExtractor={(entry) => entry.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ gap: space[4], paddingBottom: space[2] }}>
          <PageHeader title="Transactions" right={searching ? undefined : <MonthSwitcher />} />
          <SampleNotice />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search shop, person, UPI ID, note"
            placeholderTextColor={c.muted2}
            accessibilityLabel="Search transactions"
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[s.search, { color: c.foreground, backgroundColor: c.bgMuted }]}
          />
          <Segmented
            label="Show"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              { value: "debit", label: "Spent" },
              { value: "credit", label: "Received" },
            ]}
          />
          {category ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Text style={[s.filterText, { color: c.muted }]}>Category</Text>
              <Chip
                label={`${categoryLabel(category, categories)}  ✕`}
                selected
                onPress={() => setClearedCategory(category)}
              />
            </View>
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={s.dayHeader}>
          <Text style={[s.day, { color: c.muted }]}>{formatDayLabel(section.title)}</Text>
          <Text style={[s.dayTotal, { color: c.muted }]}>{section.spent ? formatInr(section.spent) : ""}</Text>
        </View>
      )}
      renderItem={({ item, index, section }) => {
        const first = index === 0;
        const last = index === section.data.length - 1;
        return (
          <View
            style={[
              s.item,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                borderTopWidth: first ? StyleSheet.hairlineWidth : 0,
                borderBottomWidth: last ? StyleSheet.hairlineWidth : 0,
                borderTopLeftRadius: first ? radius.lg : 0,
                borderTopRightRadius: first ? radius.lg : 0,
                borderBottomLeftRadius: last ? radius.lg : 0,
                borderBottomRightRadius: last ? radius.lg : 0,
                paddingTop: first ? space[1] : 0,
                paddingBottom: last ? space[1] : 0,
              },
            ]}>
            {first ? null : <View style={[s.inset, { backgroundColor: c.border }]} />}
            <EntryRow entry={item} showDate={false} />
          </View>
        );
      }}
      ListEmptyComponent={
        <Empty
          title={searching ? "Nothing matches" : "Nothing here yet"}
          body={searching ? "Try a shop name, a person or part of a UPI ID." : "Add what you spend, or check a statement to fill in the month."}
        />
      }
    />
  );
}

function filterEntries(
  entries: Entry[],
  f: { month: string; query: string; kind: Kind; category: string | null; categories: Category[] },
): Entry[] {
  const q = f.query.trim().toLowerCase();
  const inCategory = f.category
    ? new Set([f.category, ...f.categories.filter((cat) => cat.parent === f.category).map((cat) => cat.slug)])
    : null;
  return entries.filter((entry) => {
    if (!q && !entry.date.startsWith(f.month)) return false;
    if (f.kind !== "all" && entry.type !== f.kind) return false;
    if (inCategory && !inCategory.has(entry.categorySlug ?? "other")) return false;
    if (!q) return true;
    return [entry.description, entry.merchant, entry.payee, entry.upiId, entry.note, ...entry.splits.map((share) => share.name)]
      .filter(Boolean)
      .some((text) => text!.toLowerCase().includes(q));
  });
}

function groupByDay(entries: Entry[]) {
  const sections: { title: string; spent: number; data: Entry[] }[] = [];
  for (const entry of entries) {
    let section = sections.at(-1);
    if (!section || section.title !== entry.date) {
      section = { title: entry.date, spent: 0, data: [] };
      sections.push(section);
    }
    section.data.push(entry);
    if (entry.type === "debit") section.spent += entry.amount;
  }
  return sections;
}

const s = StyleSheet.create({
  search: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 16 },
  filterText: { fontFamily: fonts.sans, fontSize: 14 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", paddingTop: space[5], paddingBottom: space[2], paddingHorizontal: 2 },
  day: { fontFamily: fonts.sansSemi, fontSize: 13 },
  dayTotal: { fontFamily: fonts.sansMedium, fontSize: 13, ...tabular },
  item: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: space[4] },
  inset: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
});
