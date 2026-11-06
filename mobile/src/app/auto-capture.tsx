import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { inboxAvailable } from "@/capture/inbox";
import { isoDate } from "@/core/dates";
import { formatShortDate } from "@/core/format";
import { getSetting } from "@/db/repo";
import { closeModal } from "@/features/navigation";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Notice, Pill, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, useTheme } from "@/ui/theme";

type LastInbox = { at: string; received: number; added: number } | null;

/** iOS steps: a Shortcuts automation that hands every SMS to "Log bank message". */
const STEPS: { title: string; body: string }[] = [
  { title: "Open Shortcuts, then the Automation tab", body: "Tap + (New Automation) at the top right." },
  { title: "Choose Message", body: "Leave Sender and Message Contains empty, so every bank works. Ledgerline ignores anything that isn't a payment." },
  { title: "Choose Run Immediately", body: "Then turn off Notify When Run, and tap Next." },
  { title: "Add the Ledgerline action", body: "Tap New Blank Automation, search for “Log bank message” and add it." },
  { title: "Give it the message", body: "Tap Message in the action and choose Shortcut Input. Optionally, tap Sender and choose Sender. Tap Done." },
];

export default function AutoCaptureScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, entries } = useLedger();
  const [last, setLast] = useState<LastInbox>(null);
  const native = inboxAvailable();
  const captured = entries.filter((entry) => entry.messageRef);
  // Working if anything arrived, through the action's inbox or the link.
  const lastAt = [last?.at, ...captured.map((entry) => entry.createdAt)].filter(Boolean).sort().at(-1) ?? null;

  useEffect(() => {
    void getSetting<LastInbox>(db, "lastInbox", null).then(setLast);
  }, [db, entries]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={closeModal} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">
          Automatic capture
        </Text>
        <View style={s.close} />
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space[6] }]}>
        <Card>
          <View style={[s.badge, { backgroundColor: c.primarySoft }]}>
            <Icon name="bell" size={26} color={c.primary} />
          </View>
          <CardTitle
            title="Add payments from your bank's SMS"
            sub="Set it up once. After that, every payment your bank texts you about is added to Ledgerline by itself, ready for a quick look."
          />
          <View style={{ gap: space[2] }}>
            <Line icon="lock" text="Read on this iPhone. Messages are never uploaded, and Ledgerline has no server." />
            <Line icon="check" text="OTPs, requests, offers and chats are skipped. A payment you already added is never counted twice." />
          </View>
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            {lastAt ? <Pill tone="success">{`Working · last message ${formatShortDate(isoDate(new Date(lastAt)))}`}</Pill> : <Pill>Not set up yet</Pill>}
            {captured.length ? <Pill tone="primary">{`${captured.length} captured so far`}</Pill> : null}
          </View>
        </Card>

        {Platform.OS === "ios" ? (
          <Card>
            <CardTitle title="Set it up (about a minute)" sub="Apple asks you to create this yourself; apps can't read messages on their own." />
            {STEPS.map((step, index) => (
              <View key={step.title} style={s.step}>
                <View style={[s.num, { backgroundColor: c.primarySoft }]}>
                  <Text style={[s.numText, { color: c.primary }]}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="strong">{step.title}</T>
                  <T variant="small" tone="muted">
                    {step.body}
                  </T>
                </View>
              </View>
            ))}
            <Button label="Open Shortcuts" icon="chevron" onPress={() => void Linking.openURL("shortcuts://")} />
            <T variant="small" tone="muted">
              Next time your bank texts you, open Ledgerline: the payment will be waiting under “From your bank messages”.
            </T>
          </Card>
        ) : (
          <Notice
            tone="info"
            title="Coming to Android next."
            body="Ledgerline will read bank SMS on the phone once you allow it. Until then, paste a message, or check a statement once a month."
          />
        )}

        {Platform.OS === "ios" && !native ? (
          <Notice
            tone="warning"
            title="“Log bank message” isn't in this build."
            body="You're running a preview (such as Expo Go). Use the backup below, or install the App Store or TestFlight version."
          />
        ) : null}

        {Platform.OS === "ios" ? (
          <Card>
            <CardTitle
              title="If “Log bank message” doesn't show up"
              sub="Use this backup in step 4 instead. It opens Ledgerline for a moment each time, then adds the payment."
            />
            <View style={{ gap: space[1] }}>
              <T variant="small">1. Add the Shortcuts action “URL Encode” and give it Shortcut Input.</T>
              <T variant="small">2. Add “Open URLs” with: ledgerline://capture?text= followed by the URL Encoded Text.</T>
            </View>
          </Card>
        ) : null}

        <Card>
          <CardTitle title="Or add one message now" sub="Copy a bank SMS and paste it. Works on any phone." />
          <Button label="Paste a bank message" variant="secondary" onPress={() => router.replace("/capture")} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Line({ icon, text }: { icon: "lock" | "check"; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
      <Icon name={icon} size={18} color={c.primary} />
      <T style={{ flex: 1 }}>{text}</T>
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
  badge: { width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  step: { flexDirection: "row", gap: space[3], alignItems: "flex-start" },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: fonts.sansSemi, fontSize: 14 },
});
