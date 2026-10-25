import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app.js";
import { localHeaders } from "../helpers/local.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";

/** A one-page PDF locked with the password "secret123". */
const LOCKED_PDF = readFileSync(new URL("../fixtures/locked.pdf", import.meta.url));

describe("uploading a password-protected statement", () => {
  let server: Server;
  let base = "";
  let token = "";

  before(async () => {
    const store = new MemoryStore();
    await store.migrate();
    resetStoreForTests(store);
    const user = await store.createUser({
      email: "pdf@example.com",
      displayName: null,
    });
    token = user.id;
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  async function upload(password: string) {
    const form = new FormData();
    form.append("file", new Blob([LOCKED_PDF], { type: "application/pdf" }), "statement.pdf");
    form.append("password", password);
    const res = await fetch(`${base}/api/parse`, {
      method: "POST",
      headers: localHeaders(token),
      body: form,
    });
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    return { status: res.status, code: body.error?.code, message: body.error?.message ?? "" };
  }

  // A 401 would make the app treat the session as expired and sign the user out.
  it("asks for the password without a 401 when none is given", async () => {
    const result = await upload("");
    assert.equal(result.status, 422);
    assert.equal(result.code, "PDF_PASSWORD_REQUIRED");
    assert.match(result.message, /password-protected/);
  });

  it("says the password is wrong without a 401", async () => {
    const result = await upload("not-it");
    assert.equal(result.status, 422);
    assert.equal(result.code, "PDF_PASSWORD_INCORRECT");
    assert.match(result.message, /did not open/);
  });
});

describe("repeat statement uploads", () => {
  it("names the first import date in Indian order, not US order", async () => {
    const { duplicateImportMessage } = await import("../../src/imports/controller.js");
    // 3 Oct, 20:00 UTC is 4 Oct 01:30 in India.
    assert.equal(
      duplicateImportMessage("2026-10-03T20:00:00Z"),
      "You already imported this statement on 4 Oct 2026. Nothing was added twice.",
    );
  });
});
