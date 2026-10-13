import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PostgresStore } from "../../src/db/postgres.js";
import type { NewTransactionInput } from "../../src/db/types.js";
import { hdfcStatement } from "../helpers/statementPdf.js";
import { startTestApp } from "../helpers/testApp.js";

type Report = {
  duplicate: boolean;
  lines: number;
  alreadyRecorded: number;
  added: number;
  directionCorrected: number;
  needsReview: number;
  previouslyDeleted: number;
  outsideWindow: number;
  statementFrom: string | null;
  statementTo: string | null;
};

const mailRow = (date: string, amount: number, id: string): NewTransactionInput => ({
  importId: null, accountId: null, date, time: null, description: `UPI-SHOP-${id}`,
  amount, type: "debit", upiId: null, merchant: null, payee: null, providerId: null,
  categorySlug: null, classificationSource: "parser", fingerprint: `mail-${id}`,
  mailMessageId: `gmail-${id}`, origin: "mail", verifiedAt: null,
});

const SEPT = [
  { date: "2026-09-01", narration: "UPI-SWIGGY-swiggy@icici-ICIC0000001", amount: 500, type: "debit" as const },
  { date: "2026-09-02", narration: "NEFT CR-ACME PAYROLL", amount: 50000, type: "credit" as const },
  { date: "2026-09-03", narration: "UPI-SHOP-shop@okaxis-UTIB0000001", amount: 250, type: "debit" as const },
  { date: "2026-09-04", narration: "UPI-CHAI-chai@ybl-YESB0000001", amount: 120, type: "debit" as const },
];

describe("statement upload", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;

  before(async () => {
    app = await startTestApp();
  });
  after(async () => app.close());

  async function upload(token: string, pdf: Buffer) {
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "statement.pdf");
    const res = await fetch(`${app.base}/api/parse`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: res.status, body: (await res.json()) as { report: Report; error?: unknown } };
  }

  it("reports lines read, already recorded, added, and needing a look", async () => {
    const user = await app.newUser("importer");
    await app.store.insertTransactions(user.id, [mailRow("2026-09-01", 500, "a"), mailRow("2026-09-03", 250, "b")]);
    // The last line's closing balance is 1.00 off, so it must not be added.
    const pdf = hdfcStatement(10000, [
      ...SEPT,
      { date: "2026-09-05", narration: "UPI-ODD-odd@ybl-YESB0000001", amount: 80, type: "debit", closing: 59049 },
    ]);
    const first = await upload(user.token, pdf);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.report, {
      duplicate: false,
      previousImportDate: null,
      lines: 5,
      alreadyRecorded: 2,
      added: 2,
      directionCorrected: 0,
      needsReview: 1,
      previouslyDeleted: 0,
      outsideWindow: 0,
      statementFrom: "2026-09-01",
      statementTo: "2026-09-05",
    });

    const rows = await app.store.listTransactions(user.id);
    assert.deepEqual(
      rows.map((r) => [r.date, r.type, r.amount, r.origin, Boolean(r.verifiedAt)]).sort(),
      [
        ["2026-09-01", "debit", 500, "mail", true],
        ["2026-09-02", "credit", 50000, "statement", true],
        ["2026-09-03", "debit", 250, "mail", true],
        ["2026-09-04", "debit", 120, "statement", true],
      ],
    );

    const again = await upload(user.token, pdf);
    assert.equal(again.body.report.duplicate, true);
    assert.equal(again.body.report.statementTo, "2026-09-05", "a repeat upload still links to its month");
    assert.equal((await app.store.listTransactions(user.id)).length, 4, "same file adds nothing");

    // A later statement that overlaps: known lines match, only the new one is added.
    const next = await upload(
      user.token,
      hdfcStatement(10000, [...SEPT, { date: "2026-09-06", narration: "UPI-BOOK-book@ybl-YESB0000001", amount: 60, type: "debit" }]),
    );
    assert.equal(next.body.report.duplicate, false);
    assert.equal(next.body.report.alreadyRecorded, 4);
    assert.equal(next.body.report.added, 1);
    assert.equal((await app.store.listTransactions(user.id)).length, 5);
  });

  it("a failure halfway leaves the ledger exactly as it was, and a retry works", async (t) => {
    if (!(app.store instanceof PostgresStore)) {
      t.skip("rollback needs Postgres (npm run test:db)");
      return;
    }
    const user = await app.newUser("rollback");
    await app.store.insertTransactions(user.id, [mailRow("2026-09-01", 500, `r-${user.id}`)]);
    const pdf = hdfcStatement(10000, SEPT);

    const original = PostgresStore.prototype.setStatementLineMatches;
    PostgresStore.prototype.setStatementLineMatches = async () => {
      throw new Error("simulated database failure");
    };
    try {
      const failed = await upload(user.token, pdf);
      assert.ok(failed.status >= 400);
    } finally {
      PostgresStore.prototype.setStatementLineMatches = original;
    }

    const rows = await app.store.listTransactions(user.id);
    assert.equal(rows.length, 1, "no statement rows were added");
    assert.equal(rows[0]!.verifiedAt, null, "the mail row was not marked verified");
    assert.equal((await app.store.listStatementLines(user.id)).length, 0, "no statement lines kept");
    const [importRow] = await app.store.listImports(user.id);
    assert.equal(importRow?.status, "failed");

    const retry = await upload(user.token, pdf);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.report.added, 3);
    assert.equal((await app.store.listTransactions(user.id)).length, 4);
  });
});
