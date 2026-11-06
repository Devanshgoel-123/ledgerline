import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryLabel, categoryTree, slugForLabel } from "@/core/catalog";
import { addCustomCategory, deleteCustomCategory } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Chip, Divider, Empty, Field, Row, T } from "@/ui/components";
import { CategoryIcon } from "@/ui/CategoryVisual";
import { Icon } from "@/ui/Icon";
import { fonts, space, useTheme } from "@/ui/theme";
import { closeModal } from "@/features/navigation";

export default function CategoriesScreen() {
  const { c, categoryColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, categories, entries, refresh } = useLedger();
  const [label, setLabel] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = categories.filter((category) => category.custom);
  const tops = categoryTree(categories.filter((category) => !category.custom)).map((node) => node.parent);

  const add = async () => {
    const name = label.trim();
    if (!name) return setError("Give the category a name.");
    if (categories.some((category) => category.label.toLowerCase() === name.toLowerCase())) {
      return setError(`There's already a category called ${name}.`);
    }
    try {
      await addCustomCategory(db, { slug: slugForLabel(name, categories), label: name, parent });
      setLabel("");
      setParent(null);
      setError(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't add it.");
    }
  };

  const remove = (slug: string) => {
    const used = entries.filter((entry) => entry.categorySlug === slug).length;
    Alert.alert(
      `Delete ${categoryLabel(slug, categories)}?`,
      used ? `${used} ${used === 1 ? "payment moves" : "payments move"} to Other.` : "No payments use it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCustomCategory(db, slug);
            await refresh();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={() => closeModal()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.topTitle, { color: c.foreground }]} accessibilityRole="header">
          Your categories
        </Text>
        <View style={s.close} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: insets.bottom + space[6] }} keyboardShouldPersistTaps="handled">
        <Card>
          <CardTitle title="Add a category" sub="For spending the built-in ones don't fit, like Pet care or Gym." />
          <Field label="Name" value={label} onChangeText={setLabel} placeholder="Pet care" error={error} maxLength={40} onSubmitEditing={add} />
          <T variant="small" tone="muted">
            Put it under (optional)
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            <Chip label="On its own" selected={parent === null} onPress={() => setParent(null)} />
            {tops.map((top) => (
              <Chip key={top.slug} label={top.label} color={categoryColor(top.slug)} selected={parent === top.slug} onPress={() => setParent(top.slug)} />
            ))}
          </View>
          <Button label="Add category" icon="add" onPress={add} />
        </Card>

        <Card>
          <CardTitle title="Made by you" />
          {mine.length ? (
            mine.map((category, index) => (
              <View key={category.slug}>
                {index ? <Divider /> : null}
                <Row
                  leading={<CategoryIcon slug={category.slug} size={36} />}
                  title={category.label}
                  sub={category.parent ? `Under ${categoryLabel(category.parent, categories)}` : "On its own"}
                  right={<Button label="Delete" variant="ghost" onPress={() => remove(category.slug)} />}
                />
              </View>
            ))
          ) : (
            <Empty title="None yet" body="Categories you add show up in every category picker." />
          )}
        </Card>
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
  topTitle: { fontFamily: fonts.display, fontSize: 18 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
