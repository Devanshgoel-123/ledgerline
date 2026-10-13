import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { config } from "../../src/config.js";
import { setPushTokenVerifier } from "../../src/gmail/pushAuth.js";
import { startTestApp } from "../helpers/testApp.js";

describe("Gmail push webhook", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const saved = { ...config.google };
  const body = JSON.stringify({
    message: { data: Buffer.from(JSON.stringify({ emailAddress: "someone@example.com", historyId: "1" })).toString("base64") },
  });
  const push = (authorization?: string) =>
    fetch(`${app.base}/api/gmail/push`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body,
    }).then((res) => res.status);

  before(async () => {
    app = await startTestApp();
  });
  afterEach(() => {
    Object.assign(config.google, saved);
    setPushTokenVerifier();
  });
  after(async () => app.close());

  const configure = () =>
    Object.assign(config.google, {
      pubsubTopic: "projects/p/topics/gmail",
      pushAudience: "https://api.example.com/api/gmail/push",
      pushServiceAccount: "push@p.iam.gserviceaccount.com",
    });
  // Accepts only "good-token", issued for our audience as our service account.
  const fakeGoogle = () =>
    setPushTokenVerifier(async (token, audience) => {
      if (token !== "good-token" && token !== "other-account") throw new Error("bad signature");
      assert.equal(audience, "https://api.example.com/api/gmail/push");
      return {
        email: token === "good-token" ? "push@p.iam.gserviceaccount.com" : "attacker@evil.iam.gserviceaccount.com",
        emailVerified: true,
      };
    });

  it("is closed when push is not set up", async () => {
    fakeGoogle();
    assert.equal(await push("Bearer good-token"), 404);
  });

  it("rejects a request with no token", async () => {
    configure();
    fakeGoogle();
    assert.equal(await push(), 401);
  });

  it("rejects a token Google did not sign", async () => {
    configure();
    fakeGoogle();
    assert.equal(await push("Bearer forged"), 401);
  });

  it("rejects a real token from another service account", async () => {
    configure();
    fakeGoogle();
    assert.equal(await push("Bearer other-account"), 401);
  });

  it("accepts Google's push for our subscription", async () => {
    configure();
    fakeGoogle();
    assert.equal(await push("Bearer good-token"), 204);
  });
});
