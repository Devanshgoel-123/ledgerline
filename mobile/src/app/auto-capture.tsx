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
import { captureNotificationsOn, inboxAvailable, setCaptureNotifications } from "@/capture/inbox";
import { useCaptureStatus, whenSeen } from "@/capture/status";
import type { CaptureStatus } from "@/core/automations";
import { closeModal } from "@/features/navigation";
import { useLedger } from "@/state/ledger";
import { askForNotifications, notificationPermission } from "@/reminders/schedule";
import { Button, Card, CardTitle, Notice, T, Toggle } from "@/ui/components";
import { Icon, type IconName } from "@/ui/Icon";
import { fonts, radius, space, useTheme } from "@/ui/theme";

/**
 * iOS steps, with **bold** for what to tap and `word` for what to type.
 * The same automation is made once per word in WORDS.
 */
const STEPS = [
  "Open **Shortcuts** → **Automation** → **+** → **Message**.",
  "Tap **Message Contains** and type `debited`. Leave Sender empty. Tap **Next**.",
  "Pick **Run Immediately** and turn off **Notify When Run**. Tap **Next**.",
  "Tap **New Blank Automation** and add **Log bank message** (search for it).",
  "In the action, tap the blue **Message** and pick **Shortcut Input**. Tap **Done**.",
];

export default function AutoCaptureScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, entries, captureNow } = useLedger();
  const native = inboxAvailable();
  const status = useCaptureStatus();
  const toSort = entries.filter((entry) => entry.needsReview && entry.messageRef).length;
  const ios = Platform.OS === "ios";

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
        {ios ? (
          <>
            {status ? <StatusCard status={status} /> : null}
            {!native ? (
              <Notice
                tone="warning"
                title="“Log bank message” isn't in this build."
                body="You're running a preview (such as Expo Go). Install the App Store or TestFlight version, or use the backup at the bottom."
              />
            ) : null}
            {status && status.state !== "off" ? <PopupTips toSort={toSort} /> : null}
            {status ? <SetupCard key={status.state} startOpen={status.state === "off"} /> : null}
            <CaptureNotifications />
            <Backup />
          </>
        ) : (
          <>
            <Card>
              <CardTitle
                title="Add payments from your bank's SMS"
                sub="Read on this phone, only from banks and businesses. Messages from people are never read, and nothing is uploaded."
              />
            </Card>
            <AndroidCapture db={db} captureNow={captureNow} />
          </>
        )}

        <Card>
          <CardTitle title="Or add one message now" sub="Copy a bank SMS and paste it." />
          <Button label="Paste a bank message" variant="secondary" onPress={() => router.replace("/capture")} />
        </Card>
      </ScrollView>
    </View>
  );
}

/** Is it on, and which of the three automations have fired. */
function StatusCard({ status }: { status: CaptureStatus }) {
  const { c } = useTheme();
  const look = {
    on: { color: c.success, soft: c.successSoft, title: "Automatic capture is on", icon: "check" as const },
    off: { color: c.muted, soft: c.bgMuted, title: "Not set up yet", icon: "bell" as const },
    "no-text": { color: c.danger, soft: c.dangerSoft, title: "Needs one fix", icon: "info" as const },
  }[status.state];
  const sub = {
    on: `Last bank message ${whenSeen(status.lastRun!)}. Messages are read on this iPhone and never uploaded.`,
    off: "Set it up once and every payment your bank texts you about pops up with its amount: tap a category and it's saved. Read on this iPhone only.",
    "no-text":
      "Your automation ran without the message, so Ledgerline couldn't read the amount. In Shortcuts, open it, tap Message in “Log bank message” and pick Shortcut Input.",
  }[status.state];
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space[3], alignItems: "center" }}>
        <View style={[s.badge, { backgroundColor: look.soft }]}>
          <Icon name={look.icon} size={22} color={look.color} />
        </View>
        <T variant="title" style={{ flex: 1 }}>
          {look.title}
        </T>
      </View>
      <T variant="small" tone="muted">
        {sub}
      </T>
      {status.state === "no-text" ? <Button label="Open Shortcuts" variant="secondary" onPress={() => void Linking.openURL("shortcuts://")} /> : null}
      {status.state !== "off" ? (
        <View style={[s.checks, { borderColor: c.border }]}>
          {status.automations.map((automation) => (
            <View key={automation.word} style={s.checkRow} accessible accessibilityLabel={`${automation.label}: ${automation.seenAt ? `working, last ${whenSeen(automation.seenAt)}` : "not seen yet"}`}>
              <View style={[s.dot, automation.seenAt ? { backgroundColor: c.success } : { borderColor: c.muted2, borderWidth: 1.5 }]}>
                {automation.seenAt ? <Icon name="check" size={12} color={c.bg} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <T variant="strong">{automation.label}</T>
                <T variant="small" tone="muted">
                  {`Message contains “${automation.word}”`}
                </T>
              </View>
              <T variant="small" tone={automation.seenAt ? "default" : "muted"}>
                {automation.seenAt ? whenSeen(automation.seenAt) : "Not seen yet"}
              </T>
            </View>
          ))}
          <T variant="small" tone="muted">
            {"A tick appears once a message with that word arrives. Still blank after one did? That automation is missing; add it below."}
          </T>
        </View>
      ) : null}
    </Card>
  );
}

/** The popup arrives as a banner; swiping it away with the bank's SMS is easy. */
function PopupTips({ toSort }: { toSort: number }) {
  return (
    <Card>
      <CardTitle title="When a payment comes in" />
      <View style={{ gap: space[2] }}>
        <Line icon="bell" text="Ledgerline's question arrives as a banner at the top, next to your bank's SMS. Tap it to answer." />
        <Line icon="info" text="Swiping it away, or clearing notifications, skips the question. The payment is still saved." />
        <Line icon="check" text="Skipped one? It waits under To sort on Overview, and on the Today card on your Lock Screen." />
      </View>
      {toSort ? (
        <Button label={`Sort ${toSort} ${toSort === 1 ? "payment" : "payments"}`} onPress={() => router.replace("/review")} />
      ) : null}
    </Card>
  );
}

function SetupCard({ startOpen }: { startOpen: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(startOpen);
  return (
    <Card>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <CardTitle
            title={startOpen ? "Set it up (about a minute)" : "Add or fix an automation"}
            sub={startOpen ? "iPhones don't let apps read messages, so you make three small automations in Shortcuts." : "The steps, if a tick above is missing."}
          />
        </View>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chevron" size={18} color={c.muted} />
        </View>
      </Pressable>
      {open ? (
        <>
          <View style={[s.words, { backgroundColor: c.primarySoft }]}>
            <T variant="strong">Make one for each word</T>
            <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
              {["debited", "credited", "autopay"].map((word) => (
                <Chip key={word} word={word} />
              ))}
            </View>
            <T variant="small" tone="muted">
              {"Same steps each time, with that word in step 2. Bank says Sent or Spent instead? Add those too."}
            </T>
          </View>
          {STEPS.map((step, index) => (
            <View key={step} style={s.step}>
              <View style={[s.num, { backgroundColor: index === STEPS.length - 1 ? c.accentSoft : c.primarySoft }]}>
                <Text style={[s.numText, { color: index === STEPS.length - 1 ? c.accent : c.primary }]}>{index + 1}</Text>
              </View>
              <Rich text={step} />
            </View>
          ))}
          <T variant="small" tone="muted">
            {"Step 5 is the one people miss: without it, Ledgerline gets an empty message and has to ask for the amount."}
          </T>
          <Button
            label="Open Shortcuts"
            icon="chevron"
            onPress={async () => {
              // Ask now, while it makes sense, so a skipped payment can remind you.
              if (await captureNotificationsOn()) await askForNotifications();
              void Linking.openURL("shortcuts://");
            }}
          />
        </>
      ) : null}
    </Card>
  );
}

/** One step: **bold** is what to tap, `word` is what to type. */
function Rich({ text }: { text: string }) {
  const { c } = useTheme();
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <Text style={[s.stepText, { color: c.foreground }]}>
      {parts.map((part, index) =>
        part.startsWith("**") ? (
          <Text key={index} style={{ fontFamily: fonts.sansSemi }}>
            {part.slice(2, -2)}
          </Text>
        ) : part.startsWith("`") ? (
          <Text key={index} style={[s.inlineWord, { color: c.primary }]}>
            {`“${part.slice(1, -1)}”`}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function Chip({ word }: { word: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[s.chipText, { color: c.primary }]}>{word}</Text>
    </View>
  );
}

/** For builds where the action is missing from Shortcuts. */
function Backup() {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <T variant="strong" style={{ flex: 1 }}>
          {"Can't find “Log bank message”?"}
        </T>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chevron" size={18} color={c.muted} />
        </View>
      </Pressable>
      {open ? (
        <View style={{ gap: space[2] }}>
          <T variant="small" tone="muted">
            {"Use these two actions in step 4 instead. Ledgerline opens for a moment each time, then adds the payment."}
          </T>
          <Rich text="1. Add **URL Encode** and give it **Shortcut Input**." />
          <Rich text="2. Add **Open URLs** with `ledgerline://capture?text=` followed by **URL Encoded Text**." />
        </View>
      ) : null}
    </Card>
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

function Line({ icon, text }: { icon: IconName; text: string }) {
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
  stepText: { flex: 1, fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  inlineWord: { fontFamily: fonts.sansSemi },
  checks: { gap: space[3], borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[3] },
  checkRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  words: { gap: space[2], borderRadius: radius.md, padding: space[3] },
  chip: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.sansSemi, fontSize: 15 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: fonts.sansSemi, fontSize: 14 },
});
