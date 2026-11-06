import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sampleEntries } from "@/core/sample";
import { addEntries, setSetting } from "@/db/repo";
import { applyReminders, askForNotifications } from "@/reminders/schedule";
import { DEFAULT_REMINDERS } from "@/reminders/settings";
import { useLedger } from "@/state/ledger";
import { Button, Card, Eyebrow, T, Toggle } from "@/ui/components";
import { fonts, space, useTheme } from "@/ui/theme";

const STEPS = [
  { title: "Add as you spend", body: "Amount, what for, done. A reminder in the evening catches the chai and autos you'd forget." },
  { title: "Check your statement once a month", body: "Choose your bank statement PDF. Ledgerline lists the payments that aren't in the app, and you add them in a tap." },
  { title: "See where it went", body: "By category, by app and shop, and by person. Split a bill and only your share counts." },
];

export default function WelcomeScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, refresh, setMonth } = useLedger();
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);

  const finish = async (withSample: boolean) => {
    setBusy(true);
    try {
      if (remind) {
        // Reminders are a nice-to-have: if the phone refuses or the
        // notification library fails, the user still gets into the app with
        // reminders off, and can turn them on in Settings later.
        try {
          const permission = await askForNotifications();
          const settings = { ...DEFAULT_REMINDERS, daily: permission === "granted" };
          await applyReminders(settings);
          await setSetting(db, "reminders", settings);
        } catch {
          await setSetting(db, "reminders", { ...DEFAULT_REMINDERS, daily: false });
        }
      }
      if (withSample) {
        const { month, entries } = sampleEntries();
        await addEntries(db, entries);
        setMonth(month);
      }
      await setSetting(db, "welcomed", true);
      await refresh();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[6], paddingHorizontal: space[5], gap: space[5] }}>
      <View style={{ gap: space[2] }}>
        <Eyebrow>Ledgerline</Eyebrow>
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">
          Where your money actually went.
        </Text>
        <T tone="muted">Free, private, and only on this phone. No account, no bank login.</T>
      </View>

      <View style={{ gap: space[4] }}>
        {STEPS.map((step, index) => (
          <View key={step.title} style={s.step}>
            <View style={[s.num, { backgroundColor: c.primarySoft }]}>
              <Text style={[s.numText, { color: c.primary }]}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="strong">{step.title}</T>
              <T tone="muted">{step.body}</T>
            </View>
          </View>
        ))}
      </View>

      <Card>
        <View style={s.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="strong">Remind me at 9 pm</T>
            <T variant="small" tone="muted">
              One nudge a day to add what you spent. Change or turn it off in Settings.
            </T>
          </View>
          <Toggle value={remind} onValueChange={setRemind} accessibilityLabel="Daily reminder at 9 pm" />
        </View>
      </Card>

      <View style={{ gap: space[3] }}>
        <Button label="Start" onPress={() => finish(false)} busy={busy} />
        <Button label="Look around with a sample month" variant="secondary" onPress={() => finish(true)} disabled={busy} />
      </View>
      <T variant="small" tone="muted" style={{ textAlign: "center" }}>
        Your payments never leave this phone unless you export or back them up.
      </T>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  step: { flexDirection: "row", gap: space[3], alignItems: "flex-start" },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: fonts.monoMedium, fontSize: 15 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
});
