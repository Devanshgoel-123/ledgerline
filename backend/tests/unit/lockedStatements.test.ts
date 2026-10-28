import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { setMailServerForTests } from "../../src/bankMail/mailbox.js";
import { encryptSecret } from "../../src/crypto/secrets.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { fakeMailbox } from "../helpers/fakeMailbox.js";
import { localHeaders } from "../helpers/local.js";

/** A one-page PDF locked with the password "secret123". */
const LOCKED_PDF = readFileSync(new URL("../fixtures/locked.pdf", import.meta.url));

describe("statements from bank mail that need a password", () => {
  let server: Server;
  let base = "";
  let auth: Record<string, string> = {};
  let lockedId = "";
  let store: MemoryStore;
  let userId = "";

  before(async () => {
    store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    const user = await store.createUser({ email: "locked@example.com", displayName: null });
    userId = user.id;
    const locked = await store.createImport({
      userId: user.id,
      accountId: null,
      source: "mail",
      status: "needs_password",
      filename: "HDFC_statement_Sep.pdf",
      mailMessageId: "msg-1",
      attachmentHash: "hash-1",
      bankAdapter: null,
      errorMessage: "PDF password required",
    });
    await store.createImport({
      userId: user.id,
      accountId: null,
      source: "upload",
      status: "needs_password",
      filename: "uploaded.pdf",
      mailMessageId: null,
      attachmentHash: "hash-2",
      bankAdapter: null,
      errorMessage: "PDF password required",
    });
    lockedId = locked.id;
    auth = localHeaders(user);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    setMailServerForTests();
    server.close();
  });

  const unlock = (id: string, body: unknown) =>
    fetch(`${base}/api/mail/locked-statements/${id}/unlock`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("lists only mail statements waiting for a password", async () => {
    const res = await fetch(`${base}/api/mail/locked-statements`, { headers: auth });
    assert.equal(res.status, 200);
    const { statements } = (await res.json()) as { statements: Array<{ id: string; filename: string }> };
    assert.deepEqual(statements.map((row) => row.filename), ["HDFC_statement_Sep.pdf"]);
  });

  it("explains a missing mailbox instead of failing silently", async () => {
    const res = await unlock(lockedId, { password: "anything" });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: { message: string } }).error.message, /mailbox is not connected/);
  });

  it("rejects an empty password and an unknown statement without a 401", async () => {
    assert.equal((await unlock(lockedId, { password: "" })).status, 400);
    assert.equal((await unlock("00000000-0000-0000-0000-000000000000", { password: "x" })).status, 404);
  });

  it("downloads the PDF from the mailbox again and says when the password is wrong", async () => {
    const mailbox = fakeMailbox([
      {
        id: "msg-1",
        subject: "Your HDFC Bank statement",
        fromAddress: "estatement@hdfcbank.net",
        receivedAt: new Date().toISOString(),
        pdfs: [{ filename: "HDFC_statement_Sep.pdf", buffer: LOCKED_PDF }],
      },
    ]);
    setMailServerForTests({ open: async () => mailbox });
    await store.upsertMailConnection({
      userId,
      email: "me@gmail.com",
      provider: "gmail",
      host: "imap.gmail.com",
      port: 993,
      passwordEncrypted: encryptSecret("app-password"),
      lastSyncAt: null,
      lastScannedOn: null,
      disconnectedAt: null,
    });
    const res = await unlock(lockedId, { password: "wrong-password" });
    assert.equal(res.status, 422);
    assert.deepEqual(mailbox.fetched, ["msg-1"]);
    assert.equal(mailbox.closed, 1, "the mailbox is closed after use");
  });
});
