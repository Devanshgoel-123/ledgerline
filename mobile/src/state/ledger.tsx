import { useSQLiteContext } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { readNewSms } from "@/capture/androidSms";
import { readInbox, writeCaptureCategories } from "@/capture/inbox";
import type { IncomingMessage } from "@/core/capture";
import { captureMessages } from "@/core/capture";
import { BUILT_IN_CATEGORIES, type Category } from "@/core/catalog";
import { currentMonth, today } from "@/core/dates";
import { NOTHING_SEEN, noteMessages, type CaptureSeen } from "@/core/automations";
import { popupCategories } from "@/core/quick";
import { todayStats } from "@/core/today";
import type { Entry, Rule } from "@/core/model";
import {
  getSetting,
  lastStatementCheck,
  setSetting,
  listCustomCategories,
  listEntries,
  listRules,
  type StatementCheckRecord,
} from "@/db/repo";
import type { Db } from "@/db/schema";
import { DEFAULT_REMINDERS, type ReminderSettings } from "@/reminders/settings";
import { syncWidget } from "@/widget/sync";
import { syncTodayActivity } from "@/widget/today";

export interface Ledger {
  db: Db;
  ready: boolean;
  entries: Entry[];
  categories: Category[];
  rules: Rule[];
  dailyLimit: number | null;
  reminders: ReminderSettings;
  welcomed: boolean;
  lastCheck: StatementCheckRecord | null;
  /** When a backup file was last made, ISO; null if never. */
  lastBackupAt: string | null;
  /** Ask for Face ID, fingerprint or the passcode when Ledgerline opens. */
  appLock: boolean;
  /** Show "Today" (spend, payments, what's left to sort) on the Lock Screen. On unless turned off. */
  todayActivity: boolean;
  /** The month the insight tabs show, YYYY-MM. */
  month: string;
  setMonth(month: string): void;
  /** Reload after a write. */
  refresh(): Promise<void>;
  /** Add waiting bank messages now (iOS inbox, Android SMS). Returns how many were added. */
  captureNow(): Promise<number>;
}

const LedgerContext = createContext<Ledger | null>(null);

type Snapshot = Pick<Ledger, "entries" | "rules" | "dailyLimit" | "reminders" | "welcomed" | "lastCheck" | "lastBackupAt" | "appLock" | "todayActivity"> & {
  custom: Category[];
};

/** Everything the screens read, in one pass over the database. */
async function loadSnapshot(db: Db): Promise<Snapshot> {
  const [entries, custom, rules, dailyLimit, reminders, welcomed, lastCheck, lastBackupAt, appLock, todayActivity] = await Promise.all([
    listEntries(db),
    listCustomCategories(db),
    listRules(db),
    getSetting<number | null>(db, "dailyLimit", null),
    getSetting<ReminderSettings>(db, "reminders", DEFAULT_REMINDERS),
    getSetting<boolean>(db, "welcomed", false),
    lastStatementCheck(db),
    getSetting<string | null>(db, "lastBackupAt", null),
    getSetting<boolean>(db, "appLock", false),
    getSetting<boolean>(db, "todayActivity", true),
  ]);
  return {
    entries,
    custom,
    rules,
    dailyLimit,
    reminders: { ...DEFAULT_REMINDERS, ...reminders },
    welcomed,
    lastCheck,
    lastBackupAt,
    appLock,
    todayActivity,
  };
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext() as unknown as Db;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    let cancelled = false;
    void loadSnapshot(db).then((next) => {
      if (!cancelled) setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const refresh = useCallback(async () => {
    setSnapshot(await loadSnapshot(db));
  }, [db]);

  const custom = snapshot?.custom;
  const categories = useMemo(() => [...BUILT_IN_CATEGORIES, ...(custom ?? [])], [custom]);

  // Bank messages waiting to be added: on iOS, written to the App Group inbox
  // by the "Log bank message" action; on Android, new SMS in the phone's
  // inbox. Added at launch and on every return to the app. One drain at a time.
  const draining = useRef(false);
  const ready = snapshot !== null;
  const captureNow = useCallback(async (): Promise<number> => {
    if (draining.current) return 0;
    draining.current = true;
    try {
      const inbox = await readInbox();
      const sources: { messages: IncomingMessage[]; done: () => void | Promise<void> }[] = [inbox, await readNewSms(db)];
      const messages = sources.flatMap((source) => source.messages);
      if (!messages.length) return 0;
      // Which iOS automations have fired (debited, credited, autopay), for the capture screen.
      if (inbox.messages.length) {
        const seen = await getSetting<CaptureSeen>(db, "captureSeen", NOTHING_SEEN);
        await setSetting(db, "captureSeen", noteMessages(seen, inbox.messages, new Date()));
      }
      const [entries, custom, rules] = await Promise.all([listEntries(db), listCustomCategories(db), listRules(db)]);
      const outcomes = await captureMessages(
        db,
        messages,
        { entries, rules, categories: [...BUILT_IN_CATEGORIES, ...custom] },
        () => listEntries(db),
      );
      for (const source of sources) await source.done();
      const added = outcomes.filter((outcome) => outcome.status === "added").length;
      await setSetting(db, "lastInbox", { at: new Date().toISOString(), received: messages.length, added });
      setSnapshot(await loadSnapshot(db));
      return added;
    } catch {
      // Leave the messages for the next try.
      return 0;
    } finally {
      draining.current = false;
    }
  }, [db]);
  useEffect(() => {
    if (!ready) return;
    // Next tick: the first read never blocks the first render.
    const first = setTimeout(() => void captureNow(), 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void captureNow();
    });
    return () => {
      clearTimeout(first);
      subscription.remove();
    };
  }, [ready, captureNow]);

  // Keep the home-screen widget's totals current after every load and write.
  useEffect(() => {
    if (!snapshot) return;
    syncWidget(snapshot.entries, categories);
    // The iOS payment popup's category buttons, most used first.
    writeCaptureCategories(popupCategories(snapshot.entries, categories, today()));
    // "Today" on the Lock Screen and in the Dynamic Island.
    void syncTodayActivity(todayStats(snapshot.entries, today(), snapshot.dailyLimit), snapshot.todayActivity);
  }, [snapshot, categories]);

  const value = useMemo<Ledger>(
    () => ({
      db,
      ready: snapshot !== null,
      entries: snapshot?.entries ?? [],
      categories,
      rules: snapshot?.rules ?? [],
      dailyLimit: snapshot?.dailyLimit ?? null,
      reminders: snapshot?.reminders ?? DEFAULT_REMINDERS,
      welcomed: snapshot?.welcomed ?? true,
      lastCheck: snapshot?.lastCheck ?? null,
      lastBackupAt: snapshot?.lastBackupAt ?? null,
      appLock: snapshot?.appLock ?? false,
      todayActivity: snapshot?.todayActivity ?? true,
      month,
      setMonth,
      refresh,
      captureNow,
    }),
    [db, snapshot, categories, month, refresh, captureNow],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): Ledger {
  const ledger = useContext(LedgerContext);
  if (!ledger) throw new Error("useLedger outside LedgerProvider");
  return ledger;
}
