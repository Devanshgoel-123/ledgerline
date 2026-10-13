import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { testOutbox } from "../../src/mail/send.js";

describe("forgotten password", () => {
  let server: Server;
  let base = "";

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    config.google.allowedEmails.splice(0, Infinity);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const post = async (path: string, body: unknown, token?: string) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as { token?: string; error?: { message: string } } };
  };
  const me = (token: string) =>
    fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.status);
  const linkToken = () => {
    const mail = testOutbox.at(-1)!;
    return mail.text.match(/reset-password\?code=([A-Za-z0-9_-]+)/)![1]!;
  };

  it("emails a single-use link that sets a new password and ends old sessions", async () => {
    const email = `forgetful-${Date.now()}@example.com`;
    const signup = await post("/api/auth/register", { email, password: "old-password" });
    const oldSession = signup.json.token!;

    const sentBefore = testOutbox.length;
    assert.equal((await post("/api/auth/forgot", { email: email.toUpperCase() })).status, 200);
    assert.equal(testOutbox.length, sentBefore + 1);
    assert.equal(testOutbox.at(-1)!.to, email);
    const token = linkToken();

    const reset = await post("/api/auth/reset", { token, password: "new-password" });
    assert.equal(reset.status, 200);
    assert.equal(await me(reset.json.token!), 200, "signed in with the new password");
    assert.equal(await me(oldSession), 401, "the old session ended");
    assert.equal((await post("/api/auth/login", { email, password: "old-password" })).status, 401);
    assert.equal((await post("/api/auth/login", { email, password: "new-password" })).status, 200);

    const again = await post("/api/auth/reset", { token, password: "third-password" });
    assert.equal(again.status, 400, "a link works once");
    assert.match(again.json.error!.message, /expired or was already used/);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    const sentBefore = testOutbox.length;
    const res = await post("/api/auth/forgot", { email: "nobody-here@example.com" });
    assert.equal(res.status, 200);
    assert.equal(testOutbox.length, sentBefore);
  });

  it("refuses a made-up token and a short password", async () => {
    assert.equal(
      (await post("/api/auth/reset", { token: "x".repeat(43), password: "long-enough" })).status,
      400,
    );
    const email = `short-${Date.now()}@example.com`;
    await post("/api/auth/register", { email, password: "old-password" });
    await post("/api/auth/forgot", { email });
    assert.equal((await post("/api/auth/reset", { token: linkToken(), password: "short" })).status, 400);
  });
});
