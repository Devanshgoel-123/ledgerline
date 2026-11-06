import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryLabel } from "@/core/catalog";
import { classify, ruleFor } from "@/core/classify";
import { today } from "@/core/dates";
import { formatInr, parseRupeeAmount } from "@/core/format";
import type { Entry, PaymentMethod, TxType } from "@/core/model";
import { evenShares, knownFriends } from "@/core/people";
import { myShare, SplitInputError } from "@/core/shared";
import { addEntry, deleteEntry, saveRule, updateEntry, type EntryInput } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, Card, Chip, Eyebrow, Field, Segmented, T, Toggle } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, useTheme } from "@/ui/theme";
import { CategoryPicker } from "./CategoryPicker";
import { DateChoice } from "./pickers";
import { closeModal } from "./navigation";

type Friend = { key: string; name: string; amount: string };

/** Add or edit one payment. Used by the Add screen and by tapping a transaction. */
export function EntryForm({
  entry,
  initial,
}: {
  entry?: Entry;
  /** Values carried over from Quick add. */
  initial?: { amount?: string; category?: string; description?: string; type?: TxType };
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, refresh, categories, rules, entries } = useLedger();
  const editing = Boolean(entry);

  const [type, setType] = useState<TxType>(entry?.type ?? initial?.type ?? "debit");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : (initial?.amount ?? ""));
  const [description, setDescription] = useState(entry?.description ?? initial?.description ?? "");
  const [paidTo, setPaidTo] = useState(entry?.payee ?? entry?.merchant ?? "");
  const [isPerson, setIsPerson] = useState(Boolean(entry?.payee));
  const [category, setCategory] = useState<string | null>(entry?.categorySlug ?? initial?.category ?? null);
  const [categoryTouched, setCategoryTouched] = useState(editing || Boolean(initial?.category));
  const [date, setDate] = useState(entry?.date ?? today());
  const [method, setMethod] = useState<PaymentMethod>(entry?.method ?? "upi");
  const [note, setNote] = useState(entry?.note ?? "");
  const [splitOn, setSplitOn] = useState(Boolean(entry?.splits.length));
  const [friends, setFriends] = useState<Friend[]>(
    entry?.splits.map((share, index) => ({ key: String(index), name: share.name, amount: String(share.amount) })) ?? [],
  );
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; what?: string; split?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(friends.length);

  const parsedAmount = parseRupeeAmount(amount);
  const friendShares = friends.map((friend) => ({ name: friend.name.trim(), amount: parseRupeeAmount(friend.amount) ?? 0 }));
  const yourShare = parsedAmount && splitOn ? myShare(parsedAmount, friendShares.filter((f) => f.amount > 0)) : null;
  const pastFriends = knownFriends(entries);

  // Suggest a category from what was typed, until the user picks one.
  const suggestion =
    description.trim() || paidTo.trim()
      ? classify(
          {
            description: [description, paidTo].join(" ").trim(),
            merchant: paidTo.trim() || null,
            upiId: entry?.upiId ?? null,
            payee: isPerson ? paidTo.trim() : null,
            amount: parsedAmount ?? 0,
            type,
          },
          rules,
          categories,
        )
      : null;
  const chosenCategory = categoryTouched ? category : suggestion && suggestion.categorySlug !== "other" ? suggestion.categorySlug : category;

  const canRemember = Boolean(paidTo.trim().length >= 3 || entry?.upiId) && Boolean(chosenCategory) && !isPerson;

  const addFriend = (name = "") => {
    nextKey.current += 1;
    setFriends((list) => [...list, { key: String(nextKey.current), name, amount: "" }]);
  };

  const splitEvenly = () => {
    if (!parsedAmount || !friends.length) return;
    const shares = evenShares(parsedAmount, friends.map((friend) => friend.name));
    setFriends((list) => list.map((friend, i) => ({ ...friend, amount: String(shares[i]) })));
  };

  const save = async () => {
    const next: typeof errors = {};
    if (!parsedAmount) next.amount = "Add the amount in rupees.";
    if (splitOn && type === "debit") {
      if (friendShares.some((friend) => !friend.name)) next.split = "Each friend needs a name.";
      else if (friendShares.some((friend) => friend.amount <= 0)) next.split = "Each share has to be more than zero.";
      else if (!friendShares.length) next.split = "Add at least one friend, or turn splitting off.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const input: EntryInput = {
      date,
      amount: parsedAmount!,
      type,
      // Amount and category are enough; the category names the payment.
      description: description.trim() || paidTo.trim() || categoryLabel(chosenCategory ?? "other", categories),
      merchant: isPerson ? null : paidTo.trim() || null,
      payee: isPerson ? paidTo.trim() || null : null,
      upiId: entry?.upiId ?? null,
      providerId: categoryTouched ? null : suggestion?.providerId ?? null,
      categorySlug: chosenCategory ?? "other",
      classificationSource: categoryTouched || !suggestion ? "user_override" : suggestion.classificationSource,
      method,
      origin: entry?.origin ?? "manual",
      statementRef: entry?.statementRef ?? null,
      note,
      splits: splitOn && type === "debit" ? friendShares : [],
    };
    setSaving(true);
    try {
      if (entry) await updateEntry(db, entry.id, input);
      else await addEntry(db, input);
      if (remember && canRemember) {
        const rule = ruleFor(
          { upiId: entry?.upiId ?? null, merchant: paidTo.trim() || null },
          { categorySlug: chosenCategory },
        );
        if (rule) await saveRule(db, rule);
      }
      await refresh();
      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't save. Try again.";
      if (error instanceof SplitInputError) setErrors({ split: message });
      else setErrors({ form: message });
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert("Delete this payment?", "It's removed from this phone. A later statement check may list it as missing again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteEntry(db, entry!.id);
          await refresh();
          closeModal();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={() => closeModal()} accessibilityRole="button" accessibilityLabel="Close without saving" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.topTitle, { color: c.foreground }]} accessibilityRole="header">
          {editing ? "Edit payment" : type === "debit" ? "Add expense" : "Add money in"}
        </Text>
        <View style={s.close} />
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: space[6] }]} keyboardShouldPersistTaps="handled">
        <Segmented
          label="Kind"
          value={type}
          onChange={setType}
          options={[
            { value: "debit", label: "Spent" },
            { value: "credit", label: "Received" },
          ]}
        />

        <View style={{ gap: 6 }}>
          <Eyebrow>Amount</Eyebrow>
          <View style={[s.amountBox, { borderColor: errors.amount ? c.danger : c.borderStrong, backgroundColor: c.surface }]}>
            <Text style={[s.rupee, { color: c.muted }]}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
              }}
              placeholder="0"
              placeholderTextColor={c.muted2}
              keyboardType="decimal-pad"
              autoFocus={!editing && !initial?.amount}
              accessibilityLabel="Amount in rupees"
              style={[s.amountInput, { color: c.foreground }]}
            />
          </View>
          {errors.amount ? <T variant="small" tone="danger">{errors.amount}</T> : null}
        </View>

        <Field
          label="What for (optional)"
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (errors.what) setErrors((e) => ({ ...e, what: undefined }));
          }}
          placeholder="Chai, auto, groceries"
          error={errors.what}
          returnKeyType="next"
        />

        <View style={{ gap: space[2] }}>
          <Field
            label={type === "debit" ? "Paid to (optional)" : "From (optional)"}
            value={paidTo}
            onChangeText={setPaidTo}
            placeholder={isPerson ? "Mom, Kabir" : "Swiggy, Blinkit, the kirana"}
          />
          <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="radiogroup" accessibilityLabel="Paid to is">
            <Chip label="A shop or app" selected={!isPerson} onPress={() => setIsPerson(false)} />
            <Chip label="A person" selected={isPerson} onPress={() => setIsPerson(true)} />
          </View>
        </View>

        <View style={{ gap: space[2] }}>
          <Eyebrow>Category</Eyebrow>
          {!categoryTouched && suggestion && suggestion.categorySlug !== "other" ? (
            <T variant="small" tone="muted">
              Looks like {categoryLabel(suggestion.categorySlug, categories)}. Tap another to change it.
            </T>
          ) : null}
          <CategoryPicker
            categories={categories}
            value={chosenCategory}
            type={type}
            onChange={(slug) => {
              setCategory(slug);
              setCategoryTouched(true);
            }}
          />
          {canRemember ? (
            <View style={s.switchRow}>
              <T style={{ flex: 1 }}>
                Always file {paidTo.trim() || "this"} under {categoryLabel(chosenCategory, categories)}
              </T>
              <Toggle value={remember} onValueChange={setRemember} accessibilityLabel="Remember this category" />
            </View>
          ) : null}
        </View>

        <View style={{ gap: space[2] }}>
          <Eyebrow>When</Eyebrow>
          <DateChoice value={date} onChange={setDate} />
        </View>

        <View style={{ gap: space[2] }}>
          <Eyebrow>Paid by</Eyebrow>
          <Segmented
            label="Paid by"
            value={method}
            onChange={setMethod}
            options={[
              { value: "upi", label: "UPI" },
              { value: "card", label: "Card" },
              { value: "cash", label: "Cash" },
              { value: "other", label: "Other" },
            ]}
          />
          {method === "cash" ? (
            <T variant="small" tone="muted">
              {"Cash isn't in your bank statement, so a statement check never counts it."}
            </T>
          ) : null}
        </View>

        {type === "debit" ? (
          <Card>
            <View style={s.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="strong">Split with friends</T>
                <T variant="small" tone="muted">
                  Only your share counts as your spending. People shows who owes you.
                </T>
              </View>
              <Toggle
                value={splitOn}
                onValueChange={(on) => {
                  setSplitOn(on);
                  if (on && !friends.length) addFriend();
                }}
                accessibilityLabel="Split with friends"
              />
            </View>
            {splitOn ? (
              <View style={{ gap: space[3] }}>
                {friends.map((friend, index) => (
                  <View key={friend.key} style={s.friendRow}>
                    <TextInput
                      value={friend.name}
                      onChangeText={(name) => setFriends((list) => list.map((f) => (f.key === friend.key ? { ...f, name } : f)))}
                      placeholder={`Friend ${index + 1}`}
                      placeholderTextColor={c.muted2}
                      accessibilityLabel={`Friend ${index + 1} name`}
                      style={[s.friendInput, { flex: 1.4, color: c.foreground, borderColor: c.borderStrong, backgroundColor: c.surface }]}
                    />
                    <TextInput
                      value={friend.amount}
                      onChangeText={(value) => setFriends((list) => list.map((f) => (f.key === friend.key ? { ...f, amount: value } : f)))}
                      placeholder="₹ share"
                      placeholderTextColor={c.muted2}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`${friend.name || `Friend ${index + 1}`} share in rupees`}
                      style={[s.friendInput, { flex: 1, color: c.foreground, borderColor: c.borderStrong, backgroundColor: c.surface, fontFamily: fonts.mono }]}
                    />
                    <Pressable
                      onPress={() => setFriends((list) => list.filter((f) => f.key !== friend.key))}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${friend.name || `friend ${index + 1}`}`}
                      hitSlop={8}
                      style={s.removeFriend}>
                      <Icon name="close" size={16} color={c.muted} />
                    </Pressable>
                  </View>
                ))}
                {pastFriends.filter((name) => !friends.some((f) => f.name.trim().toLowerCase() === name.toLowerCase())).length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                    {pastFriends
                      .filter((name) => !friends.some((f) => f.name.trim().toLowerCase() === name.toLowerCase()))
                      .slice(0, 6)
                      .map((name) => (
                        <Chip
                          key={name}
                          label={`+ ${name}`}
                          selected={false}
                          onPress={() => {
                            const blank = friends.find((f) => !f.name.trim());
                            if (blank) setFriends((list) => list.map((f) => (f.key === blank.key ? { ...f, name } : f)));
                            else addFriend(name);
                          }}
                        />
                      ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  <Button label="Add friend" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => addFriend()} />
                  <Button label="Split evenly" icon="split" variant="secondary" style={{ flex: 1 }} onPress={splitEvenly} disabled={!parsedAmount || !friends.length} />
                </View>
                {errors.split ? (
                  <T variant="small" tone="danger">
                    {errors.split}
                  </T>
                ) : yourShare != null ? (
                  <T variant="strong">Your share: {formatInr(yourShare)}</T>
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything to remember" multiline />

        {editing ? <Button label="Delete payment" variant="danger" icon="trash" onPress={remove} /> : null}
        {entry?.origin === "statement" ? (
          <T variant="small" tone="muted" style={{ textAlign: "center" }}>
            Added from a statement: {entry.description}
          </T>
        ) : null}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space[3], backgroundColor: c.bg, borderColor: c.border }]}>
        {errors.form ? (
          <T tone="danger" style={{ textAlign: "center" }}>
            {errors.form}
          </T>
        ) : null}
        <Button
          label={editing ? "Save changes" : parsedAmount ? `Save ${formatInr(parsedAmount)}` : "Save"}
          onPress={save}
          busy={saving}
          style={{ minHeight: 56 }}
        />
      </View>
    </KeyboardAvoidingView>
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
  body: { padding: space[4], gap: space[5] },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[2], borderTopWidth: StyleSheet.hairlineWidth },
  amountBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space[4], gap: space[2] },
  rupee: { fontFamily: fonts.monoMedium, fontSize: 32 },
  amountInput: { flex: 1, minWidth: 0, fontFamily: fonts.monoMedium, fontSize: 40, paddingVertical: space[3] },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  friendRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  friendInput: { minWidth: 0, minHeight: 46, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, fontFamily: fonts.sans, fontSize: 15 },
  removeFriend: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
});
