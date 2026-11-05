import { router } from "expo-router";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryLabel } from "@/core/catalog";
import { formatInr, formatShortDate } from "@/core/format";
import { dismissCaptured, markReviewed } from "@/db/repo";
import { closeModal } from "@/features/navigation";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Divider, Empty, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, tabular, useTheme } from "@/ui/theme";

/**
 * Payments captured from bank messages, waiting for a glance. Each one is
 * already counted; confirming only clears the mark. Tap one to change it, or
 * remove a message that wasn't really your spending.
 */
export default function ReviewScreen() {
  const { c, categoryColor, onCategory } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, entries, categories, refresh } = useLedger();
  const pending = entries.filter((entry) => entry.needsReview);

  const confirm = async (ids: string[]) => {
    await markReviewed(db, ids);
    await refresh();
  };

  const remove = (id: string) =>
    Alert.alert("Remove this payment?", "It won't be added again from the same message.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await dismissCaptured(db, id);
          await refresh();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={closeModal} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">
          From your bank messages
        </Text>
        <View style={s.close} />
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space[6] }]}>
        {pending.length ? (
          <Card>
            <CardTitle
              title={`${pending.length} new ${pending.length === 1 ? "payment" : "payments"}`}
              sub="Already counted in your totals. Check the category, or tap a payment to change it."
            />
            {pending.map((entry, index) => (
              <View key={entry.id} style={{ gap: space[2] }}>
                {index ? <Divider /> : null}
                <Pressable
                  onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.description}, ${formatInr(entry.amount)}, ${categoryLabel(entry.categorySlug, categories)}. Edit`}
                  style={s.row}>
                  <View style={[s.mark, { backgroundColor: categoryColor(entry.categorySlug) }]}>
                    <Text style={[s.markText, { color: onCategory }]}>{entry.description.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="strong" numberOfLines={1}>
                      {entry.description}
                    </T>
                    <T variant="small" tone="muted" numberOfLines={1}>
                      {`${categoryLabel(entry.categorySlug, categories)} · ${formatShortDate(entry.date)}${entry.note ? ` · ${entry.note}` : ""}`}
                    </T>
                  </View>
                  <Text style={[s.amount, tabular, { color: entry.type === "credit" ? c.credit : c.foreground }]}>
                    {`${entry.type === "credit" ? "+" : "−"}${formatInr(entry.amount)}`}
                  </Text>
                </Pressable>
                <View style={s.actions}>
                  <Button label="Looks right" icon="check" variant="secondary" style={{ flex: 1 }} onPress={() => confirm([entry.id])} />
                  <Button label="Remove" variant="ghost" onPress={() => remove(entry.id)} />
                </View>
              </View>
            ))}
            <Button label={pending.length > 1 ? `All ${pending.length} look right` : "Done"} onPress={() => confirm(pending.map((e) => e.id))} />
          </Card>
        ) : (
          <Card>
            <Empty title="All checked" body="New payments from your bank messages show up here." />
            <Button label="Done" onPress={closeModal} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: fonts.display, fontSize: 18 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { padding: space[4], gap: space[4] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingTop: space[2] },
  mark: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  markText: { fontFamily: fonts.sansSemi, fontSize: 15 },
  amount: { fontFamily: fonts.monoMedium, fontSize: 15 },
  actions: { flexDirection: "row", gap: space[2], alignItems: "center" },
});
