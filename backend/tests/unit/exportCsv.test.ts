import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { localHeaders } from "../helpers/local.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { csvCell } from "../../src/imports/export.js";

describe("csvCell", () => {
  it("quotes commas, quotes and new lines", () => {
    assert.equal(csvCell('Dinner, "Big" night'), '"Dinner, ""Big"" night"');
    assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  });

  it("stops spreadsheet formulas from running", () => {
    assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
    assert.equal(csvCell("+91 transfer"), "'+91 transfer");
    assert.equal(csvCell(-250), "-250");
  });
});

describe("downloading all transactions", () => {
  let server: Server;
  let base = "";
  let auth: Record<string, string> = {};

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    const user = await store.createUser({ email: "export@example.com", displayName: null });
    auth = localHeaders(user);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  it("returns every transaction, marks samples, and neutralises formulas", async () => {
    await fetch(`${base}/api/demo/load`, { method: "POST", headers: auth });
    await fetch(`${base}/api/imports/transactions`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        date: "2026-01-02",
        amount: 99,
        categorySlug: "food",
        description: "=cmd|' /C calc'!A0",
      }),
    });

    const res = await fetch(`${base}/api/imports/export`, { headers: auth });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="ledgerline-transactions-/);

    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    assert.match(lines[0]!, /^Date,Time,Type,Amount/);
    const status = (await (await fetch(`${base}/api/imports/status`, { headers: auth })).json()) as {
      transactionCount: number;
      sampleCount: number;
    };
    assert.equal(lines.length - 1, status.transactionCount);
    assert.equal(lines.filter((line) => line.endsWith(",yes")).length, status.sampleCount);
    assert.ok(lines.some((line) => line.includes("'=cmd")), "formula must be prefixed");
    assert.ok(!lines.some((line) => /,=cmd/.test(line)), "no raw formula cell");
  });
});
