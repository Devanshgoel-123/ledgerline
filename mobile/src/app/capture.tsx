import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureMessage, type CaptureOutcome } from "@/core/capture";
import { categoryLabel } from "@/core/catalog";
import { formatInr, formatShortDate } from "@/core/format";
import { closeModal } from "@/features/navigation";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Pill, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, useTheme } from "@/ui/theme";

/**
 * Add a payment from a bank message.
 *
 * - ledgerline://capture?text=… : the no-native-code fallback for the iOS
 *   Shortcut ("Open URL" with the message). The payment is added at once.
 * - ledgerline://capture : paste a message yourself.
 */
export default function CaptureScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ text?: string; sender?: string }>();
  const { db, entries, rules, categories, refresh } = useLedger();
  const [text, setText] = useState(params.text ?? "");
  const [outcome, setOutcome] = useState<CaptureOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  // The last message handled, so each new link is added once (and a
  // re-render with the same link isn't added again).
  const handled = useRef<string | null>(null);

  const run = async (message: string, fromLink = false) => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const result = await captureMessage(db, { text: message, sender: params.sender ?? null }, { entries, rules, categories });
      // A Shortcut sends every message, chats included. Those quietly close
      // instead of showing an error; a pasted message gets the explanation.
      if (fromLink && result.status === "not-a-payment") {
        closeModal();
        return;
      }
      setOutcome(result);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  // A message passed in the link is added straight away.
  useEffect(() => {
    if (!params.text || handled.current === params.text) return;
    handled.current = params.text;
    setText(params.text);
    setOutcome(null);
    void run(params.text, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.text]);

  const entry =
    outcome && (outcome.status === "added" || outcome.status === "linked")
      ? entries.find((item) => item.id === outcome.entryId)
      : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={closeModal} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">
          Add from a bank message
        </Text>
        <View style={s.close} />
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space[6] }]} keyboardShouldPersistTaps="handled">
        {outcome && (outcome.status === "added" || outcome.status === "linked") ? (
          <Card>
            <View style={[s.badge, { backgroundColor: c.successSoft }]}>
              <Icon name="check" size={26} color={c.success} />
            </View>
            <CardTitle
              title={outcome.status === "added" ? `Added ${formatInr(outcome.parsed.amount)}` : "Already in Ledgerline"}
              sub={
                outcome.status === "added"
                  ? `${outcome.parsed.party ?? outcome.parsed.upiId ?? "Payment"} · ${formatShortDate(outcome.parsed.date)}`
                  : "You had added this payment yourself, so it was linked to the message instead of added twice."
              }
            />
            {entry ? (
              <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
                <Pill tone="primary">{categoryLabel(entry.categorySlug, categories)}</Pill>
                {outcome.parsed.bank ? <Pill>{outcome.parsed.bank}</Pill> : null}
              </View>
            ) : null}
            {entry ? (
              <Button
                label="Change category or details"
                variant="secondary"
                onPress={() => router.replace({ pathname: "/entry/[id]", params: { id: entry.id } })}
              />
            ) : null}
            <Button label="Done" onPress={closeModal} />
          </Card>
        ) : null}

        {outcome?.status === "duplicate" || outcome?.status === "categorised" ? (
          <Card>
            <CardTitle title="Already added" sub="This message was added before, so nothing changed." />
            <Button label="Done" onPress={closeModal} />
          </Card>
        ) : null}

        {!outcome || outcome.status === "not-a-payment" ? (
          <Card>
            <CardTitle
              title={outcome?.status === "not-a-payment" ? "That doesn't look like a payment" : "Paste a bank message"}
              sub={
                outcome?.status === "not-a-payment"
                  ? "Ledgerline reads messages about money that left or reached your account. OTPs, requests, reminders and offers are skipped. Check the text and try again."
                  : "Copy the SMS your bank sent for a payment and paste it here. It's read on this phone and never sent anywhere."
              }
            />
            <TextInput
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (outcome) setOutcome(null);
              }}
              placeholder="Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 05/11/26…"
              placeholderTextColor={c.muted2}
              multiline
              accessibilityLabel="Bank message"
              style={[s.input, { color: c.foreground, backgroundColor: c.surface, borderColor: c.borderStrong }]}
            />
            <Button label="Add payment" icon="add" onPress={() => run(text)} disabled={!text.trim()} busy={busy} />
            <T variant="small" tone="muted">
              Want this to happen by itself? Set up automatic capture once in Settings.
            </T>
            <Button label="Set up automatic capture" variant="ghost" onPress={() => router.replace("/auto-capture")} />
          </Card>
        ) : null}
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
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, alignSelf: "center" },
  input: { minHeight: 120, borderRadius: radius.md, borderWidth: 1, padding: 14, fontFamily: fonts.sans, fontSize: 15, textAlignVertical: "top" },
});
