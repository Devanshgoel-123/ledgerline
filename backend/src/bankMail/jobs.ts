import { BACKFILL_DEFAULT_MAX_MESSAGES } from "../constants/index.js";
import { config } from "../config.js";
import { PoolingRunTrigger } from "../enums/pooling.js";
import { poolingScanWindow } from "../helpers/dates.js";
import { childLogger } from "../logger/index.js";
import { runAllPoolingBackfills } from "./poolingService.js";

const log = childLogger({ module: "mail-jobs" });

let scanInFlight = false;

/** A current-month bank-mail scan shortly after boot, then every MAIL_SCAN_INTERVAL_MS (6 hours). */
export function startMailJobs(): void {
  log.info(
    { intervalMs: config.mailJobs.intervalMs },
    "bank mail scans scheduled for the current month",
  );

  setTimeout(() => {
    void scanAllMailboxes("boot");
  }, 15_000).unref?.();

  setInterval(() => {
    void scanAllMailboxes("interval");
  }, config.mailJobs.intervalMs).unref?.();
}

async function scanAllMailboxes(source: "boot" | "interval"): Promise<void> {
  if (scanInFlight) {
    log.warn({ source }, "mail scan skipped — previous run still in flight");
    return;
  }
  scanInFlight = true;
  try {
    const month = poolingScanWindow().to.slice(0, 7);
    log.info({ source, month }, "mail scan tick");
    const result = await runAllPoolingBackfills({
      month,
      maxMessages: BACKFILL_DEFAULT_MAX_MESSAGES,
      trigger: PoolingRunTrigger.Dispatcher,
    });
    log.info(
      {
        source,
        month,
        accountCount: result.accountCount,
        succeeded: result.succeeded,
        failed: result.failed,
      },
      "mail scan tick complete",
    );
  } catch (error) {
    log.error(
      {
        source,
        err: error instanceof Error ? error.message : String(error),
      },
      "mail scan tick failed",
    );
  } finally {
    scanInFlight = false;
  }
}
