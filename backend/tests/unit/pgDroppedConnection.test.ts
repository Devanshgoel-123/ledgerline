import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sql } from "drizzle-orm";

/**
 * Hosted Postgres sometimes drops a connection that is checked out between queries.
 * That used to crash the whole API. Needs a disposable database:
 *   TEST_DATABASE_URL=postgres://... npm test
 */
const url = process.env.TEST_DATABASE_URL;

describe("a dropped Postgres connection", { skip: !url && "set TEST_DATABASE_URL to run" }, () => {
  it("fails only the transaction that was using it, not the process", async () => {
    const { PostgresStore } = await import("../../src/db/postgres.js");
    const store = new PostgresStore(url!) as unknown as {
      db: { transaction: (fn: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<void>) => Promise<void> };
      query: (text: string) => Promise<{ rows: Array<{ ok: number }> }>;
      close: () => Promise<void>;
    };
    let crashed = false;
    const onCrash = () => {
      crashed = true;
    };
    process.once("uncaughtException", onCrash);
    try {
      const inTransaction = store.db
        .transaction(async (tx) => {
          await tx.execute(sql`select 1`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await tx.execute(sql`select 2`);
        })
        .then(
          () => "committed",
          () => "rejected",
        );
      await new Promise((resolve) => setTimeout(resolve, 400));
      await store.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where state like 'idle in transaction%' and pid <> pg_backend_pid()",
      );
      assert.equal(await inTransaction, "rejected");
      assert.equal((await store.query("select 1 as ok")).rows[0]!.ok, 1);
      assert.equal(crashed, false);
    } finally {
      process.removeListener("uncaughtException", onCrash);
      await store.close();
    }
  });
});
