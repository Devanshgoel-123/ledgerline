import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";

describe("deleting an account", () => {
  let server: Server;
  let base = "";
  let store: MemoryStore;

  before(async () => {
    store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    config.google.allowedEmails.splice(0, Infinity, "leaver@example.com");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };

  it("removes personal details and lets the same email sign up again", async () => {
    const first = await call("POST", "/api/auth/register", {
      email: "leaver@example.com",
      password: "first-password",
      displayName: "Leaver",
    });
    const token = first.json.token as string;
    const me = await call("GET", "/api/auth/me", undefined, token);
    const userId = me.json.id as string;

    assert.equal((await call("DELETE", "/api/auth/me", undefined, token)).status, 200);

    const row = (store as unknown as { users: Map<string, Record<string, unknown>> }).users.get(userId)!;
    assert.notEqual(row.email, "leaver@example.com");
    assert.equal(row.displayName, null);
    assert.equal(row.phoneE164, null);
    assert.equal(row.passwordHash, "!deleted");

    const again = await call("POST", "/api/auth/register", {
      email: "leaver@example.com",
      password: "second-password",
    });
    assert.equal(again.status, 201, "the address is free again");
    assert.notEqual(
      (await call("GET", "/api/auth/me", undefined, again.json.token as string)).json.id,
      userId,
      "a fresh account, not the deleted one",
    );
  });
});
