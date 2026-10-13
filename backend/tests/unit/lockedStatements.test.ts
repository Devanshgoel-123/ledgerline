import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { signToken } from "../../src/auth/service.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";

describe("statements from Gmail that need a password", () => {
  let server: Server;
  let base = "";
  let auth: Record<string, string> = {};
  let lockedId = "";

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    const user = await store.createUser({ email: "locked@example.com", passwordHash: "x", displayName: null });
    const locked = await store.createImport({
      userId: user.id,
      accountId: null,
      source: "gmail",
      status: "needs_password",
      filename: "HDFC_statement_Sep.pdf",
      gmailMessageId: "msg-1",
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
      gmailMessageId: null,
      attachmentHash: "hash-2",
      bankAdapter: null,
      errorMessage: "PDF password required",
    });
    lockedId = locked.id;
    auth = { authorization: `Bearer ${signToken({ id: user.id, email: user.email })}` };
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const unlock = (id: string, body: unknown) =>
    fetch(`${base}/api/gmail/locked-statements/${id}/unlock`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("lists only mail statements waiting for a password", async () => {
    const res = await fetch(`${base}/api/gmail/locked-statements`, { headers: auth });
    assert.equal(res.status, 200);
    const { statements } = (await res.json()) as { statements: Array<{ id: string; filename: string }> };
    assert.deepEqual(statements.map((row) => row.filename), ["HDFC_statement_Sep.pdf"]);
  });

  it("explains a missing Gmail connection instead of failing silently", async () => {
    const res = await unlock(lockedId, { password: "anything" });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: { message: string } }).error.message, /Gmail is not connected/);
  });

  it("rejects an empty password and an unknown statement without a 401", async () => {
    assert.equal((await unlock(lockedId, { password: "" })).status, 400);
    assert.equal((await unlock("00000000-0000-0000-0000-000000000000", { password: "x" })).status, 404);
  });
});
