import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { loginOrRegisterWithGoogle } from "../../src/auth/service.js";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";

describe("an unproven password account and Google sign-in", () => {
  let server: Server;
  let base = "";

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    config.google.allowedEmails.splice(0, Infinity, "victim@example.com");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as { token?: string } };
  };
  const me = (token: string) =>
    fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.status);

  it("locks out whoever set the password once the real owner signs in with Google", async () => {
    // Someone else registers the victim's address before the victim ever visits.
    const squatter = await post("/api/auth/register", {
      email: "victim@example.com",
      password: "squatter-pass",
    });
    assert.equal(squatter.status, 201);
    assert.equal(await me(squatter.json.token!), 200);

    // The real owner signs in with Google, which proves the address.
    const owner = await loginOrRegisterWithGoogle({ email: "victim@example.com" });

    assert.equal(await me(owner.token), 200, "the owner gets in");
    assert.equal(await me(squatter.json.token!), 401, "the squatter's session is ended");
    const retry = await post("/api/auth/login", {
      email: "victim@example.com",
      password: "squatter-pass",
    });
    assert.equal(retry.status, 401, "the squatter's password no longer works");
  });

  it("ends sessions as soon as the account is deleted", async () => {
    const owner = await loginOrRegisterWithGoogle({ email: "victim@example.com" });
    const deleted = await fetch(`${base}/api/auth/me`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${owner.token}` },
    });
    assert.equal(deleted.status, 200);
    assert.equal(await me(owner.token), 401);
  });
});
