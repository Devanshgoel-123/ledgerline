import { useSQLiteContext } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BUILT_IN_CATEGORIES, type Category } from "@/core/catalog";
import { currentMonth } from "@/core/dates";
import type { Entry, Rule } from "@/core/model";
import {
  getSetting,
  lastStatementCheck,
  listCustomCategories,
  listEntries,
  listRules,
  type StatementCheckRecord,
} from "@/db/repo";
import type { Db } from "@/db/schema";
import { DEFAULT_REMINDERS, type ReminderSettings } from "@/reminders/settings";
import { syncWidget } from "@/widget/sync";

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
  /** The month the insight tabs show, YYYY-MM. */
  month: string;
  setMonth(month: string): void;
  /** Reload after a write. */
  refresh(): Promise<void>;
}

const LedgerContext = createContext<Ledger | null>(null);

type Snapshot = Pick<Ledger, "entries" | "rules" | "dailyLimit" | "reminders" | "welcomed" | "lastCheck"> & {
  custom: Category[];
};

/** Everything the screens read, in one pass over the database. */
async function loadSnapshot(db: Db): Promise<Snapshot> {
  const [entries, custom, rules, dailyLimit, reminders, welcomed, lastCheck] = await Promise.all([
    listEntries(db),
    listCustomCategories(db),
    listRules(db),
    getSetting<number | null>(db, "dailyLimit", null),
    getSetting<ReminderSettings>(db, "reminders", DEFAULT_REMINDERS),
    getSetting<boolean>(db, "welcomed", false),
    lastStatementCheck(db),
  ]);
  return { entries, custom, rules, dailyLimit, reminders: { ...DEFAULT_REMINDERS, ...reminders }, welcomed, lastCheck };
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

  // Keep the home-screen widget's totals current after every load and write.
  useEffect(() => {
    if (snapshot) syncWidget(snapshot.entries, categories);
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
      month,
      setMonth,
      refresh,
    }),
    [db, snapshot, categories, month, refresh],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): Ledger {
  const ledger = useContext(LedgerContext);
  if (!ledger) throw new Error("useLedger outside LedgerProvider");
  return ledger;
}
