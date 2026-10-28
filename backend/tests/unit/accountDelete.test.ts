import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { CLIENT_HEADER } from "../../src/local/guard.js";
import { forgetLocalUser } from "../../src/local/user.js";

describe("deleting all local data", () => {
  let server: Server;
  let base = "";
  let store: MemoryStore;

  before(async () => {
    store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    forgetLocalUser();
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", [CLIENT_HEADER]: "web" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };

  it("erases the profile and starts a fresh one", async () => {
    await call("PATCH", "/api/me", { displayName: "Leaver" });
    const me = await call("GET", "/api/me");
    assert.equal(me.json.displayName, "Leaver");
    const userId = me.json.id as string;

    assert.equal((await call("DELETE", "/api/me")).status, 200);

    const row = store.users.get(userId)!;
    assert.equal(row.displayName, null);
    assert.equal(row.phoneE164, null);
    assert.ok(row.deletedAt);

    const fresh = await call("GET", "/api/me");
    assert.notEqual(fresh.json.id, userId, "a fresh profile, not the deleted one");
    assert.equal(fresh.json.displayName, null);
  });
});
