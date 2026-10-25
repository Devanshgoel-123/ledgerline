import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { setMailServerForTests } from "../../src/bankMail/mailbox.js";
import { decryptSecret } from "../../src/crypto/secrets.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { fakeMailbox, type FakeMessage } from "../helpers/fakeMailbox.js";
import { localHeaders } from "../helpers/local.js";

const ALERT_SUBJECT = "❗  You have done a UPI txn. Check details!";
const alertBody = (amount: string, vpa: string, name: string) =>
  `Dear Customer, Rs.${amount} is debited from your account ending 1234 towards VPA ${vpa} (${name}) on 01-10-26. UPI transaction reference no.: 600000000006.`;

/** An hour ago, so the mail is inside this month's scan in IST. */
const recent = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type Status = {
  connected: boolean;
  needsPassword: boolean;
  email: string | null;
  provider: string | null;
  latestRun: { status: string; imported: number } | null;
};

describe("bank mail over IMAP", () => {
  let server: Server;
  let base = "";
  let auth: Record<string, string> = {};
  let store: MemoryStore;
  let userId = "";
  const logins: Array<{ host: string; port: number; user: string; pass: string }> = [];
  const messages: FakeMessage[] = [
    {
      id: "alert-1@hdfcbank.net",
      subject: ALERT_SUBJECT,
      fromAddress: "HDFC Bank InstaAlerts <alerts@hdfcbank.bank.in>",
      receivedAt: recent(60),
      bodyText: alertBody("85.00", "chai@ybl", "Chai Point"),
    },
    {
      id: "alert-2@hdfcbank.net",
      subject: ALERT_SUBJECT,
      fromAddress: "alerts@hdfcbank.bank.in",
      receivedAt: recent(30),
      bodyText: alertBody("120.00", "swiggy@icici", "Swiggy"),
    },
    {
      id: "spoof@evil.example",
      subject: ALERT_SUBJECT,
      fromAddress: '"alerts@hdfcbank.bank.in" <alerts@evil.example>',
      receivedAt: recent(20),
      bodyText: alertBody("9999.00", "thief@ybl", "Thief"),
    },
  ];
  const mailbox = fakeMailbox(messages);

  before(async () => {
    store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    const user = await store.createUser({ email: "me@ledgerline.local", displayName: null });
    userId = user.id;
    auth = localHeaders(user);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    setMailServerForTests();
    server.close();
  });

  const call = async <T>(method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...auth, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as T };
  };

  const finishedRun = async (): Promise<Status> => {
    for (let i = 0; i < 100; i += 1) {
      const { json } = await call<Status>("GET", "/api/mail/status");
      if (json.latestRun && json.latestRun.status !== "running") return json;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("scan did not finish");
  };

  it("explains an unreachable mail server in plain words (real IMAP client, no network)", async () => {
    const res = await call<{ error: { message: string } }>("POST", "/api/mail/connect", {
      email: "me@example.com",
      provider: "custom",
      host: "127.0.0.1",
      port: 1,
      password: "app-password",
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error.message, /Could not reach the mail server 127\.0\.0\.1/);
    assert.equal(await store.getMailConnection(userId), null, "nothing is saved when the login fails");
  });

  it("needs a server name for a custom mailbox", async () => {
    const res = await call<{ error: { message: string } }>("POST", "/api/mail/connect", {
      email: "me@example.com",
      provider: "custom",
      password: "app-password",
    });
    assert.equal(res.status, 400);
  });

  it("checks the app password, then stores it encrypted", async () => {
    setMailServerForTests({
      open: async () => mailbox,
      verify: async (login) => {
        logins.push(login);
      },
    });
    const res = await call<Status>("POST", "/api/mail/connect", {
      email: " Me@Gmail.com ",
      provider: "gmail",
      password: "abcd efgh ijkl mnop",
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.connected, true);
    assert.equal(res.json.email, "me@gmail.com");
    assert.deepEqual(logins.at(-1), { host: "imap.gmail.com", port: 993, user: "me@gmail.com", pass: "abcdefghijklmnop" });
    const saved = await store.getMailConnection(userId);
    assert.ok(saved?.passwordEncrypted);
    assert.equal(saved.passwordEncrypted.includes("abcdefghijklmnop"), false);
    assert.equal(decryptSecret(saved.passwordEncrypted), "abcdefghijklmnop");
  });

  it("imports the bank's alerts, ignores look-alike senders, and never downloads them", async () => {
    const started = await call<{ status: string }>("POST", "/api/mail/pooling/enable", { banks: ["HDFC"] });
    assert.equal(started.status, 200);
    const status = await finishedRun();
    assert.equal(status.latestRun?.status, "completed");
    const rows = await store.listTransactions(userId);
    assert.deepEqual(rows.map((row) => row.amount).sort((a, b) => a - b), [85, 120]);
    assert.equal(mailbox.fetched.includes("spoof@evil.example"), false);
    assert.ok(mailbox.searches.length > 0);
    assert.ok(mailbox.searches.every((search) => search.senders.length > 0), "every search is limited to bank senders");
    assert.ok(mailbox.closed >= 1, "the mailbox is closed after the scan");
  });

  it("scan now finds nothing new and does not download mail it already has", async () => {
    const before = mailbox.fetched.length;
    const started = await call<{ status: string }>("POST", "/api/mail/scan-now");
    assert.equal(started.status, 200);
    await finishedRun();
    assert.equal((await store.listTransactions(userId)).length, 2);
    assert.equal(mailbox.fetched.length, before);
  });

  it("forgets the password on disconnect", async () => {
    const res = await call<{ ok: boolean }>("DELETE", "/api/mail/connect");
    assert.equal(res.status, 200);
    const status = await call<Status>("GET", "/api/mail/status");
    assert.equal(status.json.connected, false);
    assert.equal(status.json.needsPassword, false);
    assert.equal(store.mailConnections[0]?.passwordEncrypted, null);
  });

  it("asks for the app password again for a mailbox carried over from Google sign-in", async () => {
    await store.upsertMailConnection({
      userId,
      email: "me@gmail.com",
      provider: "gmail",
      host: "imap.gmail.com",
      port: 993,
      passwordEncrypted: null,
      lastSyncAt: null,
      lastScannedOn: "2026-09-30",
      disconnectedAt: null,
    });
    const status = await call<Status>("GET", "/api/mail/status");
    assert.equal(status.json.connected, false);
    assert.equal(status.json.needsPassword, true);
    assert.equal(status.json.email, "me@gmail.com");
    const scan = await call<{ error: { message: string } }>("POST", "/api/mail/scan", {});
    assert.equal(scan.status, 400);
    assert.match(scan.json.error.message, /app password again/);

    // Reconnecting the same mailbox keeps where the last scan stopped.
    await call<Status>("POST", "/api/mail/connect", { email: "me@gmail.com", provider: "gmail", password: "new-pass" });
    assert.equal((await store.getMailConnection(userId))?.lastScannedOn, "2026-09-30");
  });
});
