import { DatabaseSync } from "node:sqlite";
import { migrate, type Db, type SqlValue } from "@/db/schema";

/** An in-memory database with expo-sqlite's async API, backed by node:sqlite. */
export async function testDb(): Promise<Db> {
  const raw = new DatabaseSync(":memory:");
  let depth = 0;
  const db: Db = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, ...params: SqlValue[]) {
      const result = raw.prepare(source).run(...params);
      return { changes: Number(result.changes) };
    },
    async getAllAsync<T>(source: string, ...params: SqlValue[]) {
      return raw.prepare(source).all(...params).map((row) => ({ ...row })) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlValue[]) {
      const row = raw.prepare(source).get(...params);
      return (row ? { ...row } : null) as T | null;
    },
    async withTransactionAsync(task) {
      const outer = depth === 0;
      if (outer) raw.exec("BEGIN");
      depth += 1;
      try {
        await task();
        depth -= 1;
        if (outer) raw.exec("COMMIT");
      } catch (error) {
        depth -= 1;
        if (outer) raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  await migrate(db);
  return db;
}
