import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  smsCaptureEnabled,
  smsCaptureSupported,
  smsPermissionGranted,
  turnOffSmsCapture,
  turnOnSmsCapture,
} from "@/capture/androidSms";
import { captureNotificationsOn, emptyMessageSince, inboxAvailable, setCaptureNotifications } from "@/capture/inbox";
import { isoDate } from "@/core/dates";
import { formatShortDate } from "@/core/format";
import { getSetting } from "@/db/repo";
import { closeModal } from "@/features/navigation";
import { useLedger } from "@/state/ledger";
import { askForNotifications, notificationPermission } from "@/reminders/schedule";
import { Button, Card, CardTitle, Notice, Pill, T, Toggle } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, useTheme } from "@/ui/theme";

type LastInbox = { at: string; received: number; added: number } | null;

/** iOS steps: a Shortcuts automation that hands every SMS to "Log bank message". */
const STEPS: { title: string; body: string }[] = [
  { title: "Open Shortcuts, then the Automation tab", body: "Tap + (New Automation) at the top right." },
  { title: "Choose Message", body: "Leave Sender and Message Contains empty, so every bank works. Ledgerline ignores anything that isn't a payment." },
  { title: "Choose Run Immediately", body: "Then turn off Notify When Run, and tap Next." },
  { title: "Add the Ledgerline action", body: "Tap New Blank Automation, then search for “Log bank message” (it’s also listed under Ledgerline) and add it." },
  {
    title: "Give it the message (don't skip this)",
    body: "In the action, tap the blue word Message and choose Shortcut Input. Without it nothing gets logged. Optionally tap Sender and choose Sender. Tap Done.",
  },
];

export default function AutoCaptureScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, entries, captureNow } = useLedger();
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
            sub="Set it up once. After that, every payment your bank texts you about pops up with its amount: tap a category and it's saved."
          />
          <View style={{ gap: space[2] }}>
            <Line
              icon="lock"
              text={
                Platform.OS === "android"
                  ? "Read on this phone, only from banks and businesses. Messages from people are never read, and nothing is uploaded."
                  : "Read on this iPhone. Messages are never uploaded, and Ledgerline has no server."
              }
            />
            <Line icon="check" text="OTPs, requests, offers and chats are skipped. A payment you already added is never counted twice." />
          </View>
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            {lastAt ? <Pill tone="success">{`Working · last message ${formatShortDate(isoDate(new Date(lastAt)))}`}</Pill> : <Pill>Not set up yet</Pill>}
            {captured.length ? <Pill tone="primary">{`${captured.length} captured so far`}</Pill> : null}
          </View>
        </Card>

        {Platform.OS === "ios" ? <EmptyMessageWarning /> : null}

        {Platform.OS === "ios" ? (
          <>
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
            <Button
              label="Open Shortcuts"
              icon="chevron"
              onPress={async () => {
                // Ask now, while it makes sense, so the first payment can tell you it arrived.
                if (await captureNotificationsOn()) await askForNotifications();
                void Linking.openURL("shortcuts://");
              }}
            />
            <T variant="small" tone="muted">
              {"Next time your bank texts you, a small Ledgerline popup shows the amount and asks what it was for. Tap a category and it's saved, without opening the app. If the amount can't be read, the popup asks for it."}
            </T>
          </Card>
          <CaptureNotifications />
          </>
        ) : (
          <AndroidCapture db={db} captureNow={captureNow} />
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

function AndroidCapture({ db, captureNow }: { db: ReturnType<typeof useLedger>["db"]; captureNow: () => Promise<number> }) {
  const [state, setState] = useState<"loading" | "off" | "on" | "blocked">("loading");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = smsCaptureSupported();

  useEffect(() => {
    void smsCaptureEnabled(db).then((enabled) => setState(enabled && smsPermissionGranted() ? "on" : "off"));
  }, [db]);

  const check = async () => {
    setBusy(true);
    try {
      const added = await captureNow();
      setResult(added ? `Added ${added} ${added === 1 ? "payment" : "payments"}. They're on Overview, ready for a quick look.` : "No new bank payments since the last check.");
    } finally {
      setBusy(false);
    }
  };

  const turnOn = async () => {
    setResult(null);
    const outcome = await turnOnSmsCapture(db);
    if (outcome === "on") {
      setState("on");
      await check();
    } else if (outcome === "blocked") setState("blocked");
    else if (outcome === "denied") setResult("Ledgerline needs permission to read bank messages. Nothing is read until you allow it.");
  };

  if (!supported) {
    return (
      <Notice
        tone="warning"
        title="Automatic capture needs the installed app."
        body="You're running a preview (such as Expo Go). Install the Ledgerline APK or the Play Store version to read bank SMS."
      />
    );
  }

  return (
    <Card>
      <CardTitle
        title={state === "on" ? "Automatic capture is on" : "Turn it on (one tap)"}
        sub={
          state === "on"
            ? "Each time you open Ledgerline, new payment messages from your bank are added."
            : "Allow Ledgerline to read SMS. This month's bank payments are added straight away, then new ones every time you open the app."
        }
      />
      {state === "on" ? (
        <>
          <Button label="Check messages now" icon="bell" busy={busy} onPress={() => void check()} />
          <Button
            label="Turn off"
            variant="ghost"
            onPress={async () => {
              await turnOffSmsCapture(db);
              setState("off");
              setResult("Turned off. To remove the permission too, open Ledgerline's app settings.");
            }}
          />
        </>
      ) : state === "blocked" ? (
        <>
          <T variant="small" tone="danger">
            {"SMS access is blocked for Ledgerline. Allow it under Permissions in the app's settings, then come back."}
          </T>
          <Button label="Open app settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          <Button label="I've allowed it" onPress={() => void turnOn()} />
        </>
      ) : (
        <Button label="Allow and turn on" icon="bell" busy={state === "loading"} onPress={() => void turnOn()} />
      )}
      {result ? <T variant="small" tone="muted">{result}</T> : null}
    </Card>
  );
}

/** The automation ran but handed over no message: say how to fix it. */
function EmptyMessageWarning() {
  const { entries } = useLedger();
  const [since, setSince] = useState<string | null>(null);
  useEffect(() => {
    void emptyMessageSince().then(setSince);
  }, [entries]);
  if (!since) return null;
  return (
    <Notice
      tone="danger"
      title="Your automation isn't passing the message."
      body={`It ran on ${formatShortDate(isoDate(new Date(since)))} without one, so nothing was logged. In Shortcuts, open the automation, tap Message in “Log bank message” and choose Shortcut Input.`}
      action={<Button label="Open Shortcuts" variant="secondary" onPress={() => void Linking.openURL("shortcuts://")} />}
    />
  );
}

/** "₹640 spent. Tap to check it": on by default, needs notification permission. */
function CaptureNotifications() {
  const [on, setOn] = useState(true);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    void Promise.all([captureNotificationsOn(), notificationPermission()]).then(([wanted, permission]) => {
      setOn(wanted && permission === "granted");
      setBlocked(wanted && permission === "denied");
    });
  }, []);
  const change = async (next: boolean) => {
    if (!next) {
      setCaptureNotifications(false);
      setOn(false);
      return;
    }
    const permission = await askForNotifications();
    setCaptureNotifications(true);
    setOn(permission === "granted");
    setBlocked(permission === "denied");
  };
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <CardTitle title="Remind me about payments I skip" sub="If you close the popup, a quiet notification stays until you pick a category." />
        </View>
        <Toggle value={on} onValueChange={(next) => void change(next)} accessibilityLabel="Remind me about payments I skip" />
      </View>
      {blocked ? (
        <>
          <T variant="small" tone="danger">
            {"Notifications are off for Ledgerline. Turn them on in your iPhone’s settings."}
          </T>
          <Button label="Open iPhone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </>
      ) : null}
    </Card>
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
