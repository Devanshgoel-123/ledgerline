import { childLogger } from "./index.js";

const log = childLogger({ module: "bank-mail" });

export const mailLog = {
  syncComplete(input: {
    userId: string;
    month: string;
    statements: { scanned: number; imported: number; skipped: number };
    alerts: { scanned: number; imported: number; skipped: number };
  }): void {
    const totalImported = input.statements.imported + input.alerts.imported;
    if (totalImported === 0 && input.statements.scanned === 0 && input.alerts.scanned === 0) {
      log.info(
        { userId: input.userId, month: input.month },
        `pooling sync — no mail matched for ${input.month} (check the bank's sender addresses)`,
      );
      return;
    }
    log.info(
      {
        userId: input.userId,
        month: input.month,
        pdfImported: input.statements.imported,
        pdfSkipped: input.statements.skipped,
        alertImported: input.alerts.imported,
        alertSkipped: input.alerts.skipped,
      },
      `pooling ✓ ${input.month} — alerts +${input.alerts.imported} · PDF +${input.statements.imported}`,
    );
  },

  syncFailed(userId: string, error: unknown): void {
    log.warn(
      {
        userId,
        err: error instanceof Error ? error.message : String(error),
      },
      "pooling poll failed",
    );
  },

  enabled(userId: string, month: string): void {
    log.info({ userId, month }, `pooling enabled for ${month}`);
  },

  /** Milestone log every N processed mails during a scan. */
  mailsProcessed(input: {
    userId: string;
    mode: "statement" | "alert" | "poll";
    scanned: number;
    imported: number;
    skipped: number;
    runId?: string;
  }): void {
    log.info(
      {
        userId: input.userId,
        mode: input.mode,
        scanned: input.scanned,
        imported: input.imported,
        skipped: input.skipped,
        runId: input.runId,
      },
      `pooling progress — ${input.scanned} mails processed (${input.mode}: +${input.imported} imported, ${input.skipped} skipped)`,
    );
  },

  /** A batch of successful imports is now visible; the scan continues. */
  batchPushed(input: {
    userId: string;
    imported: number;
    scanned: number;
    skipped: number;
    runId: string;
  }): void {
    log.info(
      {
        userId: input.userId,
        imported: input.imported,
        scanned: input.scanned,
        skipped: input.skipped,
        runId: input.runId,
      },
      `pooling batch — ${input.imported} imported, continuing scan`,
    );
  },

  searched(input: {
    userId: string;
    mode: "statement" | "alert";
    after: string | null;
    before: string | null;
    found: number;
  }): void {
    log.info(
      input,
      `mail search — ${input.mode}: ${input.found} message(s)` +
        (input.found === 0 ? " (NO MATCHES — check the bank's sender addresses)" : ""),
    );
  },
};
