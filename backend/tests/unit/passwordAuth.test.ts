import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";

describe("email and password sign-in", () => {
  let server: Server;
  let base = "";

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    // Sign-up follows the same allowlist as Google sign-in.
    config.google.allowedEmails.splice(0, Infinity, "reader@example.com", "short@example.com");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("registers, signs in, and opens a session without Google", async () => {
    const registered = await post("/api/auth/register", {
      email: "  Reader@Example.com ",
      password: "correct-horse",
    });
    assert.equal(registered.status, 201);

    const login = await post("/api/auth/login", {
      email: "reader@example.com",
      password: "correct-horse",
    });
    assert.equal(login.status, 200);
    const { token } = (await login.json()) as { token: string };

    const me = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(me.status, 200);
    assert.equal(((await me.json()) as { email: string }).email, "reader@example.com");
  });

  it("rejects a wrong password and a duplicate email", async () => {
    const wrong = await post("/api/auth/login", {
      email: "reader@example.com",
      password: "not-the-password",
    });
    assert.equal(wrong.status, 401);

    const missing = await post("/api/auth/login", {
      email: "nobody@example.com",
      password: "whatever-pass",
    });
    assert.equal(missing.status, 401);

    const again = await post("/api/auth/register", {
      email: "reader@example.com",
      password: "another-pass",
    });
    assert.equal(again.status, 409);
  });

  it("refuses an email outside the allowlist", async () => {
    const outsider = await post("/api/auth/register", {
      email: "stranger@example.com",
      password: "long-enough",
    });
    assert.equal(outsider.status, 403);
  });

  it("refuses short passwords", async () => {
    const short = await post("/api/auth/register", {
      email: "short@example.com",
      password: "short",
    });
    assert.equal(short.status, 400);
  });
});
