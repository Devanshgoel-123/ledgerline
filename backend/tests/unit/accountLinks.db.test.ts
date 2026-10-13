import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginOrRegisterWithGoogle, registerUser } from "../../src/auth/service.js";
import { config } from "../../src/config.js";
import { startTestApp } from "../helpers/testApp.js";

describe("claiming and deleting accounts", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const suffix = Date.now().toString(36);
  const victim = `victim-${suffix}@example.com`;
  const leaver = `leaver-${suffix}@example.com`;

  before(async () => {
    app = await startTestApp();
    config.google.allowedEmails.splice(0, Infinity, victim, leaver);
  });
  after(async () => {
    config.google.allowedEmails.splice(0, Infinity);
    await app.close();
  });

  it("drops the Telegram chat and other mailbox a pre-registered password linked", async () => {
    const squatter = await registerUser({ email: victim, password: "squatter-pass" });
    await app.store.linkTelegramChat(squatter.user.id, "777000");
    await app.store.upsertGmailConnection({
      userId: squatter.user.id,
      googleEmail: `squatter-${suffix}@example.com`,
      refreshTokenEncrypted: "x",
      accessTokenEncrypted: null,
      tokenExpiry: null,
      historyId: null,
      watchExpiration: null,
      lastSyncAt: null,
      lastScannedOn: null,
      disconnectedAt: null,
    });

    const owner = await loginOrRegisterWithGoogle({ email: victim });
    assert.equal(owner.user.id, squatter.user.id);
    const user = await app.store.findUserById(owner.user.id);
    assert.equal(user?.telegramChatId, null, "squatter's chat no longer gets this account's money");
    assert.equal(await app.store.getGmailConnection(owner.user.id), null);
  });

  it("keeps the owner's own mailbox when the address matches", async () => {
    const other = `own-${suffix}@example.com`;
    config.google.allowedEmails.push(other);
    const created = await registerUser({ email: other, password: "own-pass-123" });
    await app.store.upsertGmailConnection({
      userId: created.user.id,
      googleEmail: other,
      refreshTokenEncrypted: "x",
      accessTokenEncrypted: null,
      tokenExpiry: null,
      historyId: null,
      watchExpiration: null,
      lastSyncAt: null,
      lastScannedOn: null,
      disconnectedAt: null,
    });
    await loginOrRegisterWithGoogle({ email: other });
    assert.equal((await app.store.getGmailConnection(created.user.id))?.googleEmail, other);
  });

  it("a deleted account frees its address and keeps no personal details", async () => {
    const first = await loginOrRegisterWithGoogle({ email: leaver, displayName: "Leaver" });
    const del = await app.call(first.token, "/api/auth/me", { method: "DELETE" });
    assert.equal(del.status, 200);
    const gone = await app.store.findUserById(first.user.id);
    assert.ok(!gone || (!gone.email.includes("leaver") && gone.displayName === null));

    const again = await loginOrRegisterWithGoogle({ email: leaver });
    assert.notEqual(again.user.id, first.user.id, "signing up again makes a fresh account");
    const me = await app.call(first.token, "/api/auth/me");
    assert.equal(me.status, 401, "old session is dead");
  });
});
