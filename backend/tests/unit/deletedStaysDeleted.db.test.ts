import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { GmailConnectionRow, NewTransactionInput } from "../../src/db/types.js";
import { processAlertMessage } from "../../src/gmail/poolingService.js";
import { unrecordedLines } from "../../src/statementMatch/match.js";
import { hdfcStatement } from "../helpers/statementPdf.js";
import { startTestApp } from "../helpers/testApp.js";
import { localHeaders } from "../helpers/local.js";

const row = (date: string, amount: number, key: string, extra: Partial<NewTransactionInput> = {}): NewTransactionInput => ({
  importId: null, accountId: null, date, time: null, description: `UPI-${key}`, amount, type: "debit",
  upiId: null, merchant: null, payee: null, providerId: null, categorySlug: null,
  classificationSource: "parser", fingerprint: `fp-${key}`, mailMessageId: null, origin: "mail",
  verifiedAt: null, ...extra,
});

describe("unrecordedLines counts payments instead of checking that one exists", () => {
  const line = (date: string, amount: number, type: string, description = "UPI-SHOP") => ({ date, amount, type, description });

  it("two identical payments and one in the ledger leave one to add", () => {
    const left = unrecordedLines([{ date: "2026-09-04", amount: 250, type: "debit" }], [
      line("2026-09-04", 250, "debit"),
      line("2026-09-04", 250, "debit"),
    ]);
    assert.equal(left.length, 1);
  });

  it("one ledger row covers one line, the nearest day first", () => {
    const left = unrecordedLines([{ date: "2026-09-05", amount: 99, type: "debit" }], [
      line("2026-09-04", 99, "debit"),
      line("2026-09-05", 99, "debit"),
    ]);
    assert.deepEqual(left.map((l) => l.date), ["2026-09-04"]);
  });

  it("a salary credit is never taken for a same-day debit of that amount", () => {
    const left = unrecordedLines([{ date: "2026-09-01", amount: 50000, type: "debit" }], [
      line("2026-09-01", 50000, "credit", "NEFT CR-ACME PAYROLL"),
    ]);
    assert.equal(left.length, 1);
  });
});

describe("a deleted payment stays deleted", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => app.close());

  const upload = async (token: string, pdf: Buffer) => {
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "s.pdf");
    const res = await fetch(`${app.base}/api/parse`, { method: "POST", headers: localHeaders(token), body: form });
    return (await res.json()) as { report: { added: number; previouslyDeleted: number; alreadyRecorded: number } };
  };

  it("a later statement that shows it again does not add it back", async () => {
    const user = await app.newUser("del-stmt");
    const lines = [
      { date: "2026-09-01", narration: "UPI-A-a@ybl-YESB0000001", amount: 100, type: "debit" as const },
      { date: "2026-09-02", narration: "UPI-B-b@ybl-YESB0000001", amount: 200, type: "debit" as const },
    ];
    assert.equal((await upload(user.token, hdfcStatement(1000, lines))).report.added, 2);
    const toDelete = (await app.store.listTransactions(user.id)).find((r) => r.amount === 200)!;
    const del = await app.call(user.token, `/api/imports/transactions/${toDelete.id}`, { method: "DELETE" });
    assert.equal(del.status, 200);

    const next = await upload(
      user.token,
      hdfcStatement(1000, [...lines, { date: "2026-09-03", narration: "UPI-C-c@ybl-YESB0000001", amount: 50, type: "debit" }]),
    );
    assert.equal(next.report.previouslyDeleted, 1);
    assert.equal(next.report.added, 1);
    assert.deepEqual((await app.store.listTransactions(user.id)).map((r) => r.amount).sort((a, b) => a - b), [50, 100]);
  });

  it("a mail rescan skips an alert whose payment was deleted", async () => {
    const user = await app.newUser("del-mail");
    const { ids } = await app.store.insertTransactions(user.id, [
      row("2026-09-01", 75, `m-${user.id}`, { mailMessageId: `gm-${user.id}` }),
    ]);
    await app.call(user.token, `/api/imports/transactions/${ids[0]}`, { method: "DELETE" });
    const result = await processAlertMessage({
      userId: user.id,
      accountId: (await app.store.getOrCreateAccount(user.id)).id,
      connection: { userId: user.id, googleEmail: "x@example.com" } as GmailConnectionRow,
      messageId: `gm-${user.id}`,
      senders: [],
    });
    assert.equal(result, "skipped");
    assert.equal((await app.store.listTransactions(user.id)).length, 0);
  });

  it("adding missing statement lines keeps both identical payments and skips a deleted one", async () => {
    const user = await app.newUser("del-missing");
    const { ids } = await app.store.insertTransactions(user.id, [row("2026-09-04", 250, `x-${user.id}`)]);
    const gone = await app.store.insertTransactions(user.id, [row("2026-09-05", 40, `y-${user.id}`)]);
    await app.call(user.token, `/api/imports/transactions/${gone.ids[0]}`, { method: "DELETE" });
    const line = (date: string, amount: number) => ({ date, amount, type: "debit", description: "UPI-CHAI-chai@ybl", upiId: "chai@ybl" });
    const res = await app.call<{ inserted: number; skipped: number; previouslyDeleted: number }>(
      user.token,
      "/api/statement-match/import-missing",
      { method: "POST", body: { lines: [line("2026-09-04", 250), line("2026-09-04", 250), line("2026-09-04", 250), line("2026-09-05", 40)] } },
    );
    assert.deepEqual(res.body, { inserted: 2, skipped: 1, previouslyDeleted: 1 });
    assert.equal((await app.store.listTransactions(user.id)).filter((r) => r.amount === 250).length, 3);
    assert.equal(ids.length, 1);
  });

  it("clearing all data forgets deletions, so everything can be imported again", async () => {
    const user = await app.newUser("del-clear");
    const { ids } = await app.store.insertTransactions(user.id, [row("2026-09-01", 10, `c-${user.id}`)]);
    await app.call(user.token, `/api/imports/transactions/${ids[0]}`, { method: "DELETE" });
    assert.equal((await app.store.listDeletedTransactions(user.id, { from: "2026-09-01", to: "2026-09-01" })).length, 1);
    await app.call(user.token, "/api/imports/data", { method: "DELETE" });
    assert.equal((await app.store.listDeletedTransactions(user.id, { from: "2026-09-01", to: "2026-09-01" })).length, 0);
  });
});
