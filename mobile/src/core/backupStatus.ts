/**
 * Whether it's time to nudge for a backup. Ledgerline keeps everything on the
 * phone, so a lost or reset phone loses every payment not in a backup file.
 */

/** A backup older than this is stale. */
export const BACKUP_STALE_DAYS = 30;
/** Below this many payments a backup isn't worth a nudge yet. */
export const BACKUP_NUDGE_MIN_ENTRIES = 10;

export interface BackupStatus {
  /** Days since the last backup file was made; null if never. */
  daysSince: number | null;
  /** Show a nudge: enough data at risk, and no recent backup. */
  due: boolean;
}

const DAY = 86_400_000;

export function backupStatus(lastBackupAt: string | null, entryCount: number, now: Date = new Date()): BackupStatus {
  const at = lastBackupAt ? new Date(lastBackupAt) : null;
  const daysSince = at && !Number.isNaN(at.getTime()) ? Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY)) : null;
  const due = entryCount >= BACKUP_NUDGE_MIN_ENTRIES && (daysSince === null || daysSince >= BACKUP_STALE_DAYS);
  return { daysSince, due };
}

/** "today", "yesterday", "12 days ago", or "never". */
export function backupAge(daysSince: number | null): string {
  if (daysSince === null) return "never";
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  return `${daysSince} days ago`;
}
