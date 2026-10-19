import assert from "node:assert/strict";
import type { IncomingMessage, Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import { signToken } from "../../src/auth/service.js";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import {
  holdGmailConnection,
  sameVerifiedEmail,
  takeGmailConnection,
} from "../../src/gmail/pendingConnect.js";
import { controlAllowed } from "../../src/worker/controlAuth.js";

const tokens = {
  refreshToken: "refresh",
  accessToken: null,
  expiry: null,
  email: "other.mailbox@example.com",
  name: null,
};

describe("security hardening", () => {
  let server: Server;
  let base = "";
  let store: MemoryStore;

  before(async () => {
    store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const session = (user: { id: string; email: string }) =>
    signToken({ id: user.id, email: user.email, displayName: null } as Parameters<typeof signToken>[0]);
  const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

  it("does not accept an OAuth state token as a session", async () => {
    const user = await store.createUser({ email: "state@example.com", passwordHash: "h" });
    const state = jwt.sign({ sub: user.id, purpose: "gmail_connect" }, config.jwtSecret, {
      expiresIn: "10m",
    });
    assert.equal((await fetch(`${base}/api/auth/me`, bearer(state))).status, 401);
    assert.equal((await fetch(`${base}/api/imports/export`, bearer(state))).status, 401);
    assert.equal((await fetch(`${base}/api/auth/me`, bearer(session(user)))).status, 200);
  });

  it("gives admin rights only to a verified admin address", async () => {
    config.adminEmails.splice(0, Infinity, "boss@example.com", "chief@example.com");
    const squatter = await store.createUser({ email: "boss@example.com", passwordHash: "h" });
    const chief = await store.createUser({
      email: "chief@example.com",
      passwordHash: "h",
      emailVerified: true,
    });
    const path = `${base}/api/admin/providers/00000000-0000-4000-8000-000000000000`;
    const patch = (token: string) =>
      fetch(path, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      });
    assert.equal((await patch(session(squatter))).status, 403);
    // Past the admin check, the made-up provider id is simply not found.
    assert.equal((await patch(session(chief))).status, 404);
    config.adminEmails.splice(0, Infinity);
  });

  it("ignores pushed Telegram updates while the API polls", async () => {
    const saved = { ...config.telegram };
    Object.assign(config.telegram, {
      enabled: true,
      botToken: "1:t",
      webhookSecret: "a-long-enough-secret",
      webhookUrl: null,
    });
    const res = await fetch(`${base}/api/telegram/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "a-long-enough-secret",
      },
      body: JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: 5, type: "private" }, text: "/unlink" } }),
    });
    assert.equal(res.status, 404);
    Object.assign(config.telegram, saved);
  });

  it("refuses to confirm a Gmail grant for another account, and confirms only once", async () => {
    const owner = await store.createUser({ email: "owner@example.com", passwordHash: "h" });
    const victim = await store.createUser({ email: "victim@example.com", passwordHash: "h" });
    const nonce = holdGmailConnection(owner.id, tokens);
    const confirm = (token: string, pending: string) =>
      fetch(`${base}/api/gmail/confirm`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ pending }),
      });
    const asVictim = await confirm(session(victim), nonce);
    assert.equal(asVictim.status, 400);
    // The failed attempt used the grant up; the owner must connect again.
    assert.equal(takeGmailConnection(nonce, owner.id), null);
    assert.equal(await store.getGmailConnection(victim.id), null);

    const fresh = holdGmailConnection(owner.id, tokens);
    assert.deepEqual(takeGmailConnection(fresh, owner.id), tokens);
    assert.equal(takeGmailConnection(fresh, owner.id), null);
  });

  it("saves Gmail directly only for the account's own verified address", () => {
    const verified = { email: "Me@Example.com", emailVerifiedAt: "2026-01-01T00:00:00Z" };
    assert.equal(sameVerifiedEmail(verified, "me@example.com"), true);
    assert.equal(sameVerifiedEmail(verified, "someone@example.com"), false);
    assert.equal(sameVerifiedEmail({ ...verified, emailVerifiedAt: null }, "me@example.com"), false);
    assert.equal(sameVerifiedEmail(null, "me@example.com"), false);
  });

  it("retires every other reset link once one is used", async () => {
    const user = await store.createUser({ email: "reset@example.com", passwordHash: "h" });
    const later = new Date(Date.now() + 60_000);
    await store.createPasswordReset(user.id, "hash-one", later);
    await store.createPasswordReset(user.id, "hash-two", later);
    assert.equal(await store.consumePasswordReset("hash-one"), user.id);
    assert.equal(await store.consumePasswordReset("hash-two"), null);
  });
});

describe("pooling worker control routes", () => {
  const request = (remoteAddress: string, authorization?: string) =>
    ({ socket: { remoteAddress }, headers: authorization ? { authorization } : {} }) as unknown as IncomingMessage;

  it("without a token, answer loopback callers only", () => {
    assert.equal(controlAllowed(request("127.0.0.1"), ""), true);
    assert.equal(controlAllowed(request("::1"), ""), true);
    assert.equal(controlAllowed(request("172.18.0.4"), ""), false);
  });

  it("with a token, require it from everyone", () => {
    assert.equal(controlAllowed(request("172.18.0.4", "Bearer worker-secret"), "worker-secret"), true);
    assert.equal(controlAllowed(request("127.0.0.1"), "worker-secret"), false);
    assert.equal(controlAllowed(request("172.18.0.4", "Bearer wrong"), "worker-secret"), false);
  });
});
