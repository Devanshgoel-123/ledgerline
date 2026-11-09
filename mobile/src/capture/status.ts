import { useEffect, useState } from "react";
import { emptyMessageSince } from "@/capture/inbox";
import { captureStatus, NOTHING_SEEN, type CaptureSeen, type CaptureStatus } from "@/core/automations";
import { getSetting } from "@/db/repo";
import { useLedger } from "@/state/ledger";

export { whenSeen } from "@/core/automations";

/** Whether iOS automatic capture is working, refreshed whenever entries change. Null while loading. */
export function useCaptureStatus(): CaptureStatus | null {
  const { db, entries } = useLedger();
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const [seen, last, emptySince] = await Promise.all([
        getSetting<CaptureSeen>(db, "captureSeen", NOTHING_SEEN),
        // Set whenever the automation's messages are added (pasting one doesn't count).
        getSetting<{ at: string } | null>(db, "lastInbox", null),
        emptyMessageSince(),
      ]);
      if (live) setStatus(captureStatus(seen, { emptySince, lastCaptured: last?.at ?? null }));
    })();
    return () => {
      live = false;
    };
  }, [db, entries]);
  return status;
}
