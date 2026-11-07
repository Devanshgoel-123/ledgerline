import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { backupAge, backupStatus } from "@/core/backupStatus";
import { categoryLabel } from "@/core/catalog";
import { entriesCsv } from "@/core/csv";
import { today } from "@/core/dates";
import { formatClock, formatInr, parseRupeeAmount } from "@/core/format";
import { sampleEntries } from "@/core/sample";
import { exportBackup, parseBackup, restoreBackup } from "@/db/backup";
import { addEntries, deleteRule, eraseEverything, getSetting, setSetting } from "@/db/repo";
import { confirmOwner, unlockMethod } from "@/features/AppLock";
import { pickTextFile, shareFile } from "@/features/files";
import { TimeChoice } from "@/features/pickers";
import { applyReminders, askForNotifications, notificationPermission, type PermissionState } from "@/reminders/schedule";
import type { ReminderSettings } from "@/reminders/settings";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Chip, Divider, Field, PageHeader, Row, Screen, T, Toggle } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { space, useTheme } from "@/ui/theme";

export default function SettingsScreen() {
  const ledger = useLedger();
  const { c } = useTheme();
  const { db, refresh, entries, categories, rules, dailyLimit, reminders, lastBackupAt, appLock } = ledger;
  const backup = backupStatus(lastBackupAt, entries.length);
  const [lock, setLock] = useState<{ available: boolean; label: string } | null>(null);
  // What's typed, until saved; otherwise the saved limit.
  const [limitDraft, setLimitDraft] = useState<string | null>(null);
  const limitText = limitDraft ?? (dailyLimit ? String(dailyLimit) : "");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void notificationPermission().then(setPermission);
    void unlockMethod().then(setLock);
  }, []);

  const toggleLock = async (on: boolean) => {
    const method = await unlockMethod();
    setLock(method);
    if (on && !method.available) {
      Alert.alert("Set a screen lock first", "App lock uses your phone's own Face ID, fingerprint or passcode. Turn one on in your phone's settings, then come back.");
      return;
    }
    // Turning it on or off both need the owner, so a borrowed phone can't change it.
    const result = await confirmOwner(on ? "Turn on app lock" : "Turn off app lock");
    if (!result.ok) return;
    await setSetting(db, "appLock", on);
    await refresh();
  };

  const makeBackup = async () => {
    const file = JSON.stringify(await exportBackup(db));
    await shareFile(`ledgerline-backup-${today()}.json`, file, "application/json");
    await setSetting(db, "lastBackupAt", new Date().toISOString());
    await refresh();
  };

  const saveReminders = async (next: ReminderSettings) => {
    if ((next.daily || next.monthlyStatement || next.backup) && permission !== "granted") {
      const state = await askForNotifications();
      setPermission(state);
      if (state !== "granted") {
        await setSetting(db, "reminders", { ...next, daily: false, monthlyStatement: false, backup: false });
        await refresh();
        return;
      }
    }
    try {
      await applyReminders(next);
      await setSetting(db, "reminders", next);
    } catch {
      Alert.alert("Couldn't set reminders", "This phone didn't accept the reminder. Try again, or check Ledgerline's notification settings.");
      await setSetting(db, "reminders", { ...next, daily: false, monthlyStatement: false, backup: false });
    }
    await refresh();
  };

  const saveLimit = async () => {
    if (!limitText.trim()) {
      await setSetting(db, "dailyLimit", null);
      setLimitError(null);
      setLimitDraft(null);
      await refresh();
      return;
    }
    const value = parseRupeeAmount(limitText);
    if (!value) {
      setLimitError("Type an amount in rupees, like 1500.");
      return;
    }
    setLimitError(null);
    await setSetting(db, "dailyLimit", value);
    setLimitDraft(null);
    await refresh();
  };

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      Alert.alert("That didn't work", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const hasSamples = entries.some((entry) => entry.origin === "sample");

  return (
    <Screen>
      <PageHeader title="Settings" />

      <Card>
        <CardTitle
          title="Add payments from bank SMS"
          sub="Set up once and payments your bank texts you about are added by themselves. Read on this phone only."
        />
        <Button label="Set up automatic capture" icon="bell" onPress={() => router.push("/auto-capture")} />
        <Button label="Paste a bank message" variant="secondary" onPress={() => router.push("/capture")} />
      </Card>

      <Card>
        <CardTitle title="Reminders" sub="Nudges from this phone. No account, no server." />
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <T variant="strong">Remind me to add expenses</T>
            <T variant="small" tone="muted">
              Every day at {reminders.times.map((time) => formatClock(time.hour, time.minute)).join(" and ")}
            </T>
          </View>
          <Toggle
            value={reminders.daily}
            onValueChange={(daily) => saveReminders({ ...reminders, daily })}
            accessibilityLabel="Daily reminder to add expenses"
          />
        </View>
        {reminders.daily ? (
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              {reminders.times.map((time, index) => (
                <TimeChoice
                  key={index}
                  label={index === 0 ? "At" : "And"}
                  hour={time.hour}
                  minute={time.minute}
                  onChange={(next) =>
                    saveReminders({ ...reminders, times: reminders.times.map((t, i) => (i === index ? next : t)) })
                  }
                />
              ))}
            </View>
            {reminders.times.length < 2 ? (
              <Button
                label="Add an afternoon reminder too"
                variant="ghost"
                icon="add"
                onPress={() => saveReminders({ ...reminders, times: [{ hour: 14, minute: 0 }, ...reminders.times] })}
              />
            ) : (
              <Button
                label="Just one reminder a day"
                variant="ghost"
                onPress={() => saveReminders({ ...reminders, times: reminders.times.slice(-1) })}
              />
            )}
          </View>
        ) : null}
        <Divider />
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <T variant="strong">Remind me to check my statement</T>
            <T variant="small" tone="muted">
              Once a month, on day {reminders.monthlyDay}, to find payments you missed
            </T>
          </View>
          <Toggle
            value={reminders.monthlyStatement}
            onValueChange={(monthlyStatement) => saveReminders({ ...reminders, monthlyStatement })}
            accessibilityLabel="Monthly reminder to check your statement"
          />
        </View>
        {reminders.monthlyStatement ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Day of the month" style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {[1, 3, 5, 7, 10].map((day) => (
              <Chip key={day} label={`Day ${day}`} selected={reminders.monthlyDay === day} onPress={() => saveReminders({ ...reminders, monthlyDay: day })} />
            ))}
          </View>
        ) : null}
        {permission === "denied" ? (
          <View style={{ gap: space[2] }}>
            <T variant="small" tone="danger">
              {"Notifications are off for Ledgerline. Turn them on in your phone's settings to get reminders."}
            </T>
            <Button label="Open phone settings" variant="secondary" onPress={() => Linking.openSettings()} />
          </View>
        ) : null}
      </Card>

      <Card>
        <CardTitle
          title="Daily limit"
          sub={dailyLimit ? `${formatInr(dailyLimit)} a day. Days over it are marked on Overview.` : "The most you want to spend in a day. Leave empty for no limit."}
        />
        <Field
          label="Per day"
          value={limitText}
          onChangeText={setLimitDraft}
          placeholder="e.g. 1500"
          keyboardType="decimal-pad"
          error={limitError}
          onSubmitEditing={saveLimit}
        />
        <Button label={limitText.trim() ? "Save limit" : dailyLimit ? "Remove limit" : "Save limit"} variant="secondary" onPress={saveLimit} />
      </Card>

      <Card>
        <CardTitle title="Categories" sub={`${categories.length} categories, ${categories.filter((cat) => cat.custom).length} of them yours.`} />
        <Button label="Your categories" variant="secondary" onPress={() => router.push("/categories")} />
        {rules.length ? (
          <View style={{ gap: space[1] }}>
            <T variant="strong">Remembered</T>
            <T variant="small" tone="muted">
              Payments to these always get this category.
            </T>
            {rules.map((rule) => (
              <Row
                key={rule.id}
                title={rule.name}
                sub={categoryLabel(rule.setCategorySlug, categories)}
                right={
                  <Button
                    label="Forget"
                    variant="ghost"
                    onPress={async () => {
                      await deleteRule(db, rule.id);
                      await refresh();
                    }}
                  />
                }
              />
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <CardTitle
          title="App lock"
          sub={
            lock?.available === false
              ? "Turn on a screen lock in your phone's settings to use this."
              : `Ask for ${lock?.label ?? "Face ID or your passcode"} when Ledgerline opens, and after 30 seconds away.`
          }
        />
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <T variant="strong">Lock Ledgerline</T>
          </View>
          <Toggle value={appLock} onValueChange={(on) => void toggleLock(on)} accessibilityLabel="Lock Ledgerline" />
        </View>
      </Card>

      <Card>
        <CardTitle title="Your data" sub="Ledgerline has no account and no server. Your data lives only in this app, so back it up." />
        <View style={[s.backupLine, { backgroundColor: backup.due ? c.warningSoft : c.bgMuted }]}>
          <Icon
            name={backup.due || backup.daysSince === null ? "info" : "check"}
            size={18}
            color={backup.due ? c.parchmentInk : backup.daysSince === null ? c.muted : c.success}
          />
          <View style={{ flex: 1 }}>
            <T variant="strong">{`Last backup: ${backupAge(backup.daysSince)}`}</T>
            <T variant="small" tone="muted">
              {backup.due
                ? `${entries.length} payments aren't in a backup file yet. Save one to iCloud Drive, Google Drive or Files.`
                : Platform.OS === "ios"
                  ? "Your iPhone's iCloud backup also includes Ledgerline, if it's turned on."
                  : "Your phone's Google backup also includes Ledgerline, if it's turned on."}
            </T>
          </View>
        </View>
        <Button
          label="Export CSV"
          variant="secondary"
          busy={busy === "csv"}
          disabled={!entries.length}
          onPress={() => run("csv", () => shareFile(`ledgerline-${today()}.csv`, entriesCsv(entries, categories), "text/csv"))}
        />
        <Button
          label="Back up now"
          variant={backup.due ? "primary" : "secondary"}
          busy={busy === "backup"}
          onPress={() => run("backup", makeBackup)}
          accessibilityHint="Saves a file you can restore on this or another phone"
        />
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <T variant="strong">Remind me to back up</T>
            <T variant="small" tone="muted">
              On the 1st of every month
            </T>
          </View>
          <Toggle
            value={reminders.backup}
            onValueChange={(on) => saveReminders({ ...reminders, backup: on })}
            accessibilityLabel="Monthly reminder to back up"
          />
        </View>
        <Button
          label="Restore from a backup"
          variant="secondary"
          busy={busy === "restore"}
          onPress={() =>
            run("restore", async () => {
              const text = await pickTextFile();
              if (text == null) return;
              const backup = parseBackup(text);
              Alert.alert(
                "Replace everything on this phone?",
                `The backup has ${backup.tables.entries.length} payments. What's in the app now is replaced.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Replace",
                    style: "destructive",
                    onPress: async () => {
                      await restoreBackup(db, backup);
                      await refresh();
                      const restored = await getSetting<ReminderSettings | null>(db, "reminders", null);
                      if (restored) await applyReminders(restored);
                    },
                  },
                ],
              );
            })
          }
        />
        {hasSamples ? null : (
          <Button
            label="Add a sample month"
            variant="ghost"
            onPress={() =>
              run("sample", async () => {
                const { month, entries: sample } = sampleEntries();
                await addEntries(db, sample);
                ledger.setMonth(month);
                await refresh();
                router.push("/");
              })
            }
          />
        )}
        <Divider />
        <Button
          label="Erase everything"
          variant="danger"
          icon="trash"
          onPress={() =>
            Alert.alert(
              "Erase everything?",
              "Every payment, split, category, rule and setting on this phone is deleted. This can't be undone. Back up first if you might want it.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Erase",
                  style: "destructive",
                  onPress: () =>
                    run("erase", async () => {
                      await eraseEverything(db);
                      await applyReminders({ daily: false, monthlyStatement: false, times: [], monthlyDay: 5, backup: false });
                      await refresh();
                    }),
                },
              ],
            )
          }
        />
      </Card>

      <Card>
        <CardTitle title="Privacy" />
        <T tone="muted">
          {"No account, no sign-in, no analytics, no ads. Ledgerline doesn't send your payments anywhere. Statements are read on this phone and not kept. Your data leaves only when you export or back it up."}
        </T>
        <T variant="small" tone="muted">
          Ledgerline {Constants.expoConfig?.version ?? ""} · free and open source (MIT)
        </T>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  backupLine: { flexDirection: "row", gap: space[3], alignItems: "flex-start", padding: space[3], borderRadius: 12 },
});
