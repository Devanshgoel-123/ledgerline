import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { verifyAppleIdentityToken } from "../../src/auth/apple.js";
import { loginOrRegisterWithApple, loginUser, registerUser } from "../../src/auth/service.js";
import { config } from "../../src/config.js";
import { startTestApp } from "../helpers/testApp.js";

/** Runs on the memory store, or on Postgres with `npm run test:db`. */
describe("Sign in with Apple", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const run = Date.now().toString(36);
  const addr = (name: string) => `${name}-${run}@example.com`;
  const sub = (name: string) => `apple-${name}-${run}`;
  const allowed = config.google.allowedEmails;

  before(async () => {
    app = await startTestApp();
  });
  after(async () => {
    allowed.splice(0, Infinity);
    await app.close();
  });

  it("creates an account without a chosen password and signs in again by Apple id", async () => {
    const first = await loginOrRegisterWithApple({
      appleSub: sub("new"),
      email: addr("new"),
      emailVerified: true,
      displayName: "Friend",
    });
    const created = await app.store.findUserByAppleSub(sub("new"));
    assert.equal(created?.email, addr("new"));
    assert.equal(created?.displayName, "Friend");
    assert.ok(created?.emailVerifiedAt, "Apple proved the address");

    const again = await loginOrRegisterWithApple({ appleSub: sub("new"), emailVerified: false });
    assert.equal(again.user.id, first.user.id);
  });

  it("links a proven account and keeps its password", async () => {
    const owner = await loginOrRegisterWithApple({ appleSub: sub("seed"), email: addr("proven"), emailVerified: true });
    const signedIn = await loginOrRegisterWithApple({ appleSub: sub("seed"), emailVerified: true });
    assert.equal(signedIn.user.id, owner.user.id);
  });

  it("locks out a password someone set on the address before the owner signed in with Apple", async () => {
    const squatter = await registerUser({ email: addr("victim"), password: "squatter-pass" });
    const owner = await loginOrRegisterWithApple({
      appleSub: sub("victim"),
      email: addr("victim"),
      emailVerified: true,
    });
    assert.equal(owner.user.id, squatter.user.id);
    await assert.rejects(loginUser({ email: addr("victim"), password: "squatter-pass" }));
    const me = await app.call(squatter.token, "/api/auth/me");
    assert.equal(me.status, 401, "the squatter's session ended");
  });

  it("never uses an email Apple has not proven", async () => {
    const existing = await registerUser({ email: addr("unproven"), password: "owner-pass-1" });
    await assert.rejects(
      loginOrRegisterWithApple({ appleSub: sub("unproven"), email: addr("unproven"), emailVerified: false }),
      /verified email/,
    );
    const user = await app.store.findUserById(existing.user.id);
    assert.equal(user?.appleSub ?? null, null, "not linked");
  });

  it("applies the sign-up allowlist to new Apple accounts", async () => {
    allowed.splice(0, Infinity, addr("someone-else"));
    await assert.rejects(
      loginOrRegisterWithApple({ appleSub: sub("blocked"), email: addr("blocked"), emailVerified: true }),
      /not allowed/,
    );
    allowed.splice(0, Infinity);
  });

  it("frees the Apple id when the account is deleted, so the person can sign up again", async () => {
    const first = await loginOrRegisterWithApple({ appleSub: sub("leaver"), email: addr("leaver"), emailVerified: true });
    assert.equal((await app.call(first.token, "/api/auth/me", { method: "DELETE" })).status, 200);
    const again = await loginOrRegisterWithApple({ appleSub: sub("leaver"), email: addr("leaver"), emailVerified: true });
    assert.notEqual(again.user.id, first.user.id);
  });

  it("refuses tokens when no bundle id is set, instead of skipping the audience check", async () => {
    await assert.rejects(verifyAppleIdentityToken("x.y.z", ""), /not set up/);
    const bundle = config.appleBundleId;
    config.appleBundleId = "";
    const res = await fetch(`${app.base}/api/auth/apple`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identityToken: "x.y.z" }),
    });
    config.appleBundleId = bundle;
    assert.equal(res.status, 503);
  });
});
