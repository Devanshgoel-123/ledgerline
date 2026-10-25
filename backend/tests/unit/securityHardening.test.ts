import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { localHeaders } from "../helpers/local.js";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";

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

  const get = (path: string, headers: Record<string, string>) =>
    fetch(`${base}${path}`, { headers });

  it("answers this computer's web app", async () => {
    const res = await get("/api/me", localHeaders((await store.createUser({ email: "me@example.com" }))));
    assert.equal(res.status, 200);
  });

  it("refuses calls without the web app's header, so other sites cannot post forms to it", async () => {
    assert.equal((await get("/api/imports/export", {})).status, 403);
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "s.pdf");
    assert.equal((await fetch(`${base}/api/parse`, { method: "POST", body: form })).status, 403);
  });

  it("refuses a Host header that is not this computer (DNS rebinding)", async () => {
    const { request } = await import("node:http");
    const port = (server.address() as AddressInfo).port;
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        { host: "127.0.0.1", port, path: "/api/me", headers: { host: "evil.example:4000", ...localHeaders("x") } },
        (res) => resolve(res.statusCode ?? 0),
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 403);
  });

  it("lets only the local web app's origin through CORS", async () => {
    const preflight = (origin: string) =>
      fetch(`${base}/api/me`, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "DELETE",
          "access-control-request-headers": "x-ledgerline-client",
        },
      });
    const local = await preflight("http://localhost:3000");
    assert.equal(local.headers.get("access-control-allow-origin"), "http://localhost:3000");
    // Without this the browser blocks every call the web app makes.
    assert.match(local.headers.get("access-control-allow-headers") ?? "", /x-ledgerline-client/i);
    assert.equal((await preflight("https://evil.example")).headers.get("access-control-allow-origin"), null);
  });

  it("ignores pushed Telegram updates while the API polls", async () => {
    const saved = { ...config.telegram };
    Object.assign(config.telegram, {
      enabled: true,
      botToken: "1:t",
      webhookSecret: "a-long-enough-secret",
      webhookUrl: null,
    });
    const res = await fetch(`${base}/api/v1/telegram/webhook`, {
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
});
