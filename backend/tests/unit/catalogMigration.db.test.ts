import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { PostgresStore } from "../../src/db/postgres.js";
import type { NewTransactionInput } from "../../src/db/types.js";
import { startTestApp } from "../helpers/testApp.js";

const SQL = readFileSync(
  new URL("../../src/db/migrations/060_shared_app_catalog.up.sql", import.meta.url),
  "utf8",
);

const tx = (key: string, input: Partial<NewTransactionInput>): NewTransactionInput => ({
  importId: null, accountId: null, date: "2026-09-01", time: null, description: `UPI-${key}`, amount: 100,
  type: "debit", upiId: null, merchant: null, payee: null, providerId: null, categorySlug: "food",
  classificationSource: "parser", fingerprint: `cat-${key}`, mailMessageId: null, origin: "mail",
  verifiedAt: null, ...input,
});

describe("migration 060 resets shared apps without losing what users chose", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let pg: PostgresStore;

  before(async () => {
    app = await startTestApp();
  });
  after(async () => app?.close());

  it("keeps the category and UPI ids each user can be shown to own", async (t) => {
    if (!(app.store instanceof PostgresStore)) {
      t.skip("needs Postgres (npm run test:db)");
      return;
    }
    pg = app.store;
    const ids = async (name: string) =>
      (await pg.query<{ id: string }>("SELECT id FROM providers WHERE is_global AND canonical_name = $1", [name])).rows[0]!.id;
    const zomato = await ids("Zomato");
    const swiggy = await ids("Swiggy");
    const a = await app.newUser("drifter");
    const b = await app.newUser("bystander");
    const c = await app.newUser("handle-owner");

    // What the old code left behind: A moved shared Zomato to investments (and the
    // statement approval stamped that on A's own payment); C's personal UPI id sits on shared Swiggy.
    await pg.query("UPDATE providers SET category_slug = 'investments' WHERE id = $1", [zomato]);
    await pg.query("UPDATE providers SET upi_handles = upi_handles || ARRAY['9876543210@ybl'] WHERE id = $1", [swiggy]);
    await app.store.insertTransactions(a.id, [tx(`a-${a.id}`, { providerId: zomato, categorySlug: "investments", classificationSource: "user_override" })]);
    await app.store.insertTransactions(b.id, [tx(`b-${b.id}`, { providerId: zomato })]);
    await app.store.insertTransactions(c.id, [tx(`c-${c.id}`, { providerId: swiggy, upiId: "9876543210@ybl" })]);

    await pg.query(`BEGIN; ${SQL}; COMMIT;`);

    const view = async (userId: string, name: string) =>
      (await app.store.listProviders(userId))
        .filter((p) => p.canonicalName === name)
        .map((p) => ({ shared: p.isGlobal, category: p.categorySlug, handles: p.upiHandles }));

    assert.deepEqual(await view(a.id, "Zomato"), [{ shared: false, category: "investments", handles: ["zomato"] }]);
    assert.deepEqual(await view(b.id, "Zomato"), [{ shared: true, category: "food", handles: ["zomato"] }]);
    assert.deepEqual(await view(c.id, "Swiggy"), [
      { shared: false, category: "food", handles: ["9876543210@ybl", "swiggy"].sort() },
    ]);
    assert.deepEqual((await view(b.id, "Swiggy"))[0], { shared: true, category: "food", handles: ["swiggy"] });

    const aRow = (await app.store.listTransactions(a.id))[0]!;
    assert.notEqual(aRow.providerId, zomato, "A's payment moved to A's copy");
    assert.equal((await app.store.listTransactions(b.id))[0]!.providerId, zomato, "B stays on the shared app");
  });
});
