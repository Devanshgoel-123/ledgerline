import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryLabel } from "@/core/catalog";
import { today } from "@/core/dates";
import { formatInr, parseRupeeAmount } from "@/core/format";
import type { TxType } from "@/core/model";
import { pressKey, quickCategories } from "@/core/quick";
import { addEntry } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, Chip, Segmented, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, tabular, useTheme } from "@/ui/theme";
import { closeModal } from "@/features/navigation";

/** Categories shown before "More". */
const QUICK_COUNT = 6;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/**
 * Quick add: amount on a keypad, one category, optional note, save. The
 * home-screen widget opens this (ledgerline://quick?category=food).
 */
export default function QuickAddScreen() {
  const { c, categoryColor } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { db, entries, categories, refresh } = useLedger();

  const [type, setType] = useState<TxType>("debit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [noteFocused, setNoteFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const order = useMemo(
    () => quickCategories(entries, categories, { type, preferred: params.category, today: today() }),
    [entries, categories, type, params.category],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const category = picked && order.includes(picked) ? picked : (order[0] ?? "other");
  const [showAll, setShowAll] = useState(false);
  // The chosen category always stays visible, even when picked from "More".
  const top = order.slice(0, QUICK_COUNT);
  const visible = top.includes(category) ? top : [...top.slice(0, QUICK_COUNT - 1), category];

  const value = parseRupeeAmount(amount);
  const label = categoryLabel(category, categories);
  const digits = amount.replace(".", "").length;
  const amountSize = digits >= 9 ? 36 : digits >= 7 ? 44 : 56;

  const save = async () => {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await addEntry(db, {
        date: today(),
        amount: value,
        type,
        description: note.trim() || label,
        merchant: null,
        payee: null,
        upiId: null,
        categorySlug: category,
        classificationSource: "user_override",
        method: "upi",
        origin: "manual",
        note: "",
      });
      await refresh();
      closeModal();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const moreDetails = () =>
    router.replace({ pathname: "/add", params: { amount, category, note, type } });

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingBottom: insets.bottom + space[3] }]}>
      <View style={s.top}>
        <Pressable onPress={() => closeModal()} accessibilityRole="button" accessibilityLabel="Close without saving" hitSlop={10} style={s.iconButton}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">
          {type === "debit" ? "Add expense" : "Add money in"}
        </Text>
        <Pressable onPress={moreDetails} accessibilityRole="button" accessibilityHint="Opens the full form with date, payee, splits and more" hitSlop={8} style={s.more}>
          <Text style={[s.moreText, { color: c.primary }]}>More details</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space[4] }}>
        <Segmented
          label="Kind"
          value={type}
          onChange={(next) => {
            setType(next);
            setPicked(null);
          }}
          options={[
            { value: "debit", label: "Spent" },
            { value: "credit", label: "Received" },
          ]}
        />
      </View>

      <View style={s.amountRow} accessibilityRole="text" accessibilityLabel={`Amount, ${value ? formatInr(value) : "empty"}`}>
        <Text style={[s.rupee, { color: c.muted }]}>₹</Text>
        <Text
          numberOfLines={1}
          style={[
            s.amount,
            tabular,
            {
              fontSize: amountSize,
              lineHeight: amountSize + 8,
              color: !amount ? c.muted2 : type === "credit" ? c.credit : value ? c.accent : c.foreground,
            },
          ]}>
          {amount || "0"}
        </Text>
      </View>

      <View style={s.categories} accessibilityRole="radiogroup" accessibilityLabel="Category">
        {(showAll ? order : visible).map((slug) => (
          <Chip
            key={slug}
            label={categoryLabel(slug, categories)}
            color={categoryColor(slug)}
            fillWithColor
            selected={slug === category}
            onPress={() => {
              setPicked(slug);
              setShowAll(false);
            }}
          />
        ))}
        {order.length > QUICK_COUNT ? (
          <Chip label={showAll ? "Fewer" : "More"} selected={false} onPress={() => setShowAll((open) => !open)} />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: space[4] }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What for? (optional)"
          placeholderTextColor={c.muted2}
          accessibilityLabel="What for, optional"
          returnKeyType="done"
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setNoteFocused(false)}
          onSubmitEditing={() => Keyboard.dismiss()}
          style={[s.note, { color: c.foreground, backgroundColor: c.surface, borderColor: c.borderStrong }]}
        />
      </View>

      {noteFocused || showAll ? null : (
        <View style={s.keypad}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => setAmount((current) => pressKey(current, key))}
              onLongPress={key === "back" ? () => setAmount("") : undefined}
              accessibilityRole="keyboardkey"
              accessibilityLabel={key === "back" ? "Delete" : key === "." ? "Decimal point" : key}
              accessibilityHint={key === "back" ? "Long press to clear" : undefined}
              style={({ pressed }) => [s.key, { backgroundColor: pressed ? c.primarySoft : c.surface, borderColor: c.border }]}>
              {key === "back" ? (
                <Icon name="back" size={22} color={c.foreground} />
              ) : (
                <Text style={[s.keyText, { color: c.foreground }]}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ paddingHorizontal: space[4], gap: space[2], marginTop: "auto" }}>
        {error ? (
          <T variant="small" tone="danger" style={{ textAlign: "center" }}>
            {error}
          </T>
        ) : null}
        <Button
          label={value ? `Save ${formatInr(value)} · ${label}` : "Enter an amount"}
          onPress={save}
          disabled={!value}
          busy={saving}
          style={s.save}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, gap: space[3], paddingTop: space[2] },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[3], paddingTop: space[2] },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 18 },
  more: { minHeight: 44, justifyContent: "center", paddingHorizontal: space[2] },
  moreText: { fontFamily: fonts.sansSemi, fontSize: 15 },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], paddingHorizontal: space[4], minHeight: 64 },
  rupee: { fontFamily: fonts.displayBold, fontSize: 32 },
  amount: { fontFamily: fonts.displayBold, letterSpacing: -1, flexShrink: 1 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingHorizontal: space[4] },
  note: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 16 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingHorizontal: space[4] },
  key: {
    width: "31.5%",
    flexGrow: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontFamily: fonts.sansSemi, fontSize: 24 },
  save: { minHeight: 56, borderRadius: radius.lg },
});
