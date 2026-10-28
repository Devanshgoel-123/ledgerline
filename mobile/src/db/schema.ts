/** The slice of expo-sqlite's database the app uses; tests supply node:sqlite. */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(source: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export type SqlValue = string | number | null;

/** Each entry upgrades the database by one version. Never edit one that has shipped. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE entries (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
    description TEXT NOT NULL DEFAULT '',
    merchant TEXT,
    payee TEXT,
    upi_id TEXT,
    provider_id TEXT,
    category_slug TEXT,
    classification_source TEXT NOT NULL DEFAULT 'user_override',
    method TEXT NOT NULL DEFAULT 'upi' CHECK (method IN ('upi', 'card', 'cash', 'other')),
    origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'statement', 'sample')),
    statement_ref TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX entries_date ON entries (date);
  CREATE TABLE splits (
    entry_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    settled_at TEXT,
    PRIMARY KEY (entry_id, name)
  );
  CREATE TABLE custom_categories (
    slug TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    parent TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE rules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    match_upi_id TEXT,
    match_narration_re TEXT,
    set_category_slug TEXT,
    set_payee_name TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE statement_ignores (
    line_key TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE statement_checks (
    id TEXT PRIMARY KEY NOT NULL,
    bank TEXT NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    line_count INTEGER NOT NULL,
    missing_count INTEGER NOT NULL,
    checked_at TEXT NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version]!;
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
