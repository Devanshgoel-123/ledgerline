import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ProviderRow } from "../../src/db/types.js";
import { startTestApp } from "../helpers/testApp.js";

type Provider = ProviderRow;

describe("shared apps stay the same for every user", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let alice: Awaited<ReturnType<typeof app.newUser>>;
  let bob: Awaited<ReturnType<typeof app.newUser>>;
  let swiggy: Provider;

  const providersOf = async (token: string) =>
    (await app.call<{ providers: Provider[] }>(token, "/api/providers")).body.providers;

  before(async () => {
    app = await startTestApp();
    alice = await app.newUser("alice");
    bob = await app.newUser("bob");
    swiggy = (await providersOf(alice.token)).find((p) => p.canonicalName === "Swiggy" && p.isGlobal)!;
    assert.ok(swiggy, "Swiggy is a shared app");
  });

  after(async () => app.close());

  it("moving a shared app to another category changes only that user's copy", async () => {
    const res = await app.call<{ provider: Provider }>(alice.token, `/api/providers/${swiggy.id}`, {
      method: "PATCH",
      body: { categorySlug: "investments" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider.isGlobal, false);
    assert.equal(res.body.provider.userId, alice.id);
    assert.equal(res.body.provider.categorySlug, "investments");

    const shared = await app.store.getProviderById(swiggy.id);
    assert.equal(shared?.categorySlug, "food", "shared Swiggy unchanged in the database");

    const bobSwiggy = (await providersOf(bob.token)).filter((p) => p.canonicalName === "Swiggy");
    assert.deepEqual(bobSwiggy.map((p) => [p.id, p.categorySlug]), [[swiggy.id, "food"]]);

    const aliceSwiggy = (await providersOf(alice.token)).filter((p) => p.canonicalName === "Swiggy");
    assert.equal(aliceSwiggy.length, 1, "Alice sees only her copy");
    assert.equal(aliceSwiggy[0]!.categorySlug, "investments");
  });

  it("a UPI id added to a shared app is never shown to other users", async () => {
    const zomato = (await providersOf(bob.token)).find((p) => p.canonicalName === "Zomato" && p.isGlobal)!;
    const res = await app.call<{ provider: Provider }>(bob.token, `/api/providers/${zomato.id}`, {
      method: "PATCH",
      body: { addUpiHandle: "9876543210@ybl" },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.provider.upiHandles.includes("9876543210@ybl"));
    assert.equal(res.body.provider.userId, bob.id);

    const everyone = await app.store.getProviderById(zomato.id);
    assert.ok(!everyone?.upiHandles.includes("9876543210@ybl"), "shared row has no personal id");
    const aliceView = await providersOf(alice.token);
    assert.ok(!aliceView.some((p) => p.upiHandles.includes("9876543210@ybl")));
  });

  it("a user's transactions move to their copy and keep counting there", async () => {
    const carol = await app.newUser("carol");
    const zepto = (await providersOf(carol.token)).find((p) => p.canonicalName === "Zepto" && p.isGlobal)!;
    const { ids } = await app.store.insertTransactions(carol.id, [
      {
        importId: null, accountId: null, date: "2026-09-01", time: null, description: "UPI-ZEPTO",
        amount: 120, type: "debit", upiId: "zepto@ybl", merchant: "Zepto", payee: null,
        providerId: zepto.id, categorySlug: "food", classificationSource: "parser",
        fingerprint: `zepto-${carol.id}`, mailMessageId: null, origin: "mail", verifiedAt: null,
      },
    ]);
    const res = await app.call<{ provider: Provider }>(carol.token, `/api/providers/${zepto.id}`, {
      method: "PATCH",
      body: { categorySlug: "grocery" },
    });
    const row = await app.store.getTransaction(carol.id, ids[0]!);
    assert.equal(row?.providerId, res.body.provider.id);
  });

  it("cannot edit another user's private app", async () => {
    const own = (await providersOf(alice.token)).find((p) => p.canonicalName === "Swiggy")!;
    const res = await app.call(bob.token, `/api/providers/${own.id}`, {
      method: "PATCH",
      body: { categorySlug: "food" },
    });
    assert.equal(res.status, 404);
    assert.equal((await app.store.getProviderById(own.id))?.categorySlug, "investments");
  });

  it("statement approval saves the UPI id on the user's copy, not the shared app", async () => {
    const dave = await app.newUser("dave");
    const blinkit = (await providersOf(dave.token)).find((p) => p.canonicalName === "Blinkit" && p.isGlobal)!;
    const res = await app.call(dave.token, "/api/statement-match/apply", {
      method: "POST",
      body: { upiId: "ravi.store@okaxis", providerId: blinkit.id, lines: [] },
    });
    assert.equal(res.status, 200);
    const shared = await app.store.getProviderById(blinkit.id);
    assert.ok(!shared?.upiHandles.includes("ravi.store@okaxis"));
    const daveCopy = (await providersOf(dave.token)).find((p) => p.canonicalName === "Blinkit")!;
    assert.equal(daveCopy.isGlobal, false);
    assert.ok(daveCopy.upiHandles.includes("ravi.store@okaxis"));
  });

  it("rules and corrections cannot point at another user's app", async () => {
    const own = (await providersOf(alice.token)).find((p) => p.canonicalName === "Swiggy")!;
    const rule = await app.call(bob.token, "/api/rules", {
      method: "POST",
      body: { name: "x", priority: 10, enabled: true, matchUpiId: "x@ybl", setProviderId: own.id, setTags: [] },
    });
    assert.equal(rule.status, 404);
  });
});
