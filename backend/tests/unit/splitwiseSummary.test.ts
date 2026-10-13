import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSplitwiseSummary } from "../../src/splitwise/summary.js";

const SAMPLE = `
Splitwise
August is over. Here's what's up in your account on Splitwise.
Total balance you are owed ₹2,938.41
Rahul verma owes you ₹3,922.00
Priya Nair owes you ₹2,550.00
Arjun Mehta you owe ₹2,058.00
Neha Rao you owe ₹1,800.00
Aug 28 Cab + breakfast club you lent ₹2,168.00
Sep 1 Water filter shower you borrowed ₹1,800.00
Aug 16 August weekedn you lent ₹550.00
Aug 29 tropica you borrowed ₹538.25
`;

describe("parseSplitwiseSummary", () => {
  it("reads the monthly balance, friends, and lent versus borrowed", () => {
    const summary = parseSplitwiseSummary(SAMPLE);
    assert.ok(summary);
    assert.equal(summary.monthLabel, "August");
    assert.equal(summary.netBalance, 2938.41);
    assert.deepEqual(summary.friends[0], {
      name: "Rahul verma",
      direction: "owes_you",
      amount: 3922,
    });
    assert.equal(summary.friends[2]?.direction, "you_owe");
    assert.equal(summary.friends[2]?.amount, 2058);
    assert.equal(summary.expenses[0]?.direction, "lent");
    assert.equal(summary.expenses[0]?.amount, 2168);
    assert.equal(summary.expenses[1]?.direction, "borrowed");
    assert.equal(summary.expenses[1]?.title, "Water filter shower");
  });

  it("ignores mail that is not a Splitwise summary", () => {
    assert.equal(parseSplitwiseSummary("Rs.500 has been debited"), null);
  });
});
