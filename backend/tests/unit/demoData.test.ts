import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { localHeaders } from "../helpers/local.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { buildDemoTransactions, demoMonth } from "../../src/demo/service.js";

describe("demoMonth", () => {
  it("uses the current month once a week has passed", () => {
    assert.deepEqual(demoMonth(new Date("2026-10-11T06:00:00Z")), { month: "2026-10", lastDay: 11 });
  });

  it("uses the whole of last month early in the month, across a year change", () => {
    assert.deepEqual(demoMonth(new Date("2026-01-03T06:00:00Z")), { month: "2025-12", lastDay: 31 });
  });

  it("never dates a sample in the future", () => {
    const { rows } = buildDemoTransactions(new Date("2026-10-08T06:00:00Z"));
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.date <= "2026-10-08"));
    assert.ok(rows.every((row) => row.fingerprint.startsWith("demo:") && row.categorySlug));
  });
});

describe("sample data from the welcome screen", () => {
  let server: Server;
  let base = "";
  let auth: Record<string, string> = {};

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    const user = await store.createUser({ email: "demo@example.com", displayName: null });
    auth = localHeaders(user);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...auth, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };

  it("loads once, labels samples, and removes only samples", async () => {
    const first = await call("POST", "/api/demo/load");
    assert.equal(first.status, 200);
    const created = first.json.created as number;
    assert.ok(created > 10);

    const again = await call("POST", "/api/demo/load");
    assert.equal(again.json.created, 0, "loading twice must not duplicate samples");

    const real = await call("POST", "/api/imports/transactions", {
      date: "2026-01-02",
      amount: 250,
      categorySlug: "food",
      description: "Real lunch",
    });
    assert.equal(real.status, 201);

    const status = await call("GET", "/api/imports/status");
    assert.equal(status.json.sampleCount, created);
    assert.equal(status.json.transactionCount, created + 1);

    const removed = await call("DELETE", "/api/demo");
    assert.equal(removed.json.removed, created);

    const after = await call("GET", "/api/imports/status");
    assert.equal(after.json.sampleCount, 0);
    assert.equal(after.json.transactionCount, 1, "the real expense must survive");
  });
});
