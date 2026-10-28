import type { Db, SqlValue } from "./schema";

/** Tables in a backup, in an order that respects foreign keys when restoring. */
const TABLES = [
  "entries",
  "splits",
  "custom_categories",
  "rules",
  "settings",
  "statement_ignores",
  "statement_checks",
] as const;

export const BACKUP_FORMAT = "ledgerline-mobile-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], Record<string, SqlValue>[]>;
}

export async function exportBackup(db: Db): Promise<Backup> {
  const tables = {} as Backup["tables"];
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Record<string, SqlValue>>(`SELECT * FROM ${table}`);
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

/** Checks a file is a Ledgerline backup before anything is replaced. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not a Ledgerline backup.");
  }
  const backup = data as Partial<Backup>;
  if (backup?.format !== BACKUP_FORMAT || typeof backup.version !== "number" || !backup.tables) {
    throw new Error("This file is not a Ledgerline backup.");
  }
  if (backup.version > BACKUP_VERSION) {
    throw new Error("This backup is from a newer version of Ledgerline. Update the app, then try again.");
  }
  for (const table of TABLES) {
    if (!Array.isArray(backup.tables[table])) throw new Error("This backup is incomplete.");
  }
  return backup as Backup;
}

/** Replaces everything on the phone with the backup, all or nothing. */
export async function restoreBackup(db: Db, backup: Backup): Promise<{ entries: number }> {
  const columns = new Map<string, Set<string>>();
  for (const table of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columns.set(table, new Set(info.map((column) => column.name)));
  }
  await db.withTransactionAsync(async () => {
    for (const table of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${table}`);
    for (const table of TABLES) {
      const known = columns.get(table)!;
      for (const row of backup.tables[table]) {
        const keys = Object.keys(row).filter((key) => known.has(key));
        if (!keys.length) continue;
        await db.runAsync(
          `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
          ...keys.map((key) => row[key] ?? null),
        );
      }
    }
  });
  return { entries: backup.tables.entries.length };
}
