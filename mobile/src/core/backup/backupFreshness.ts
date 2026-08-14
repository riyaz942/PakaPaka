/**
 * Safari evicts unused browser storage after ~7 days (backup-and-web-plan B0),
 * so that is when the web Home nudge starts asking for a fresh backup.
 */
export const BACKUP_STALE_AFTER_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Calendar days between the two instants, or null if `iso` is unusable.
 * Calendar rather than elapsed hours: a backup taken at 11pm is "yesterday" at
 * noon the next day, not "today".
 */
function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / MS_PER_DAY);
}

export function formatLastBackedUp(iso: string | null, now: Date = new Date()): string {
  const days = daysSince(iso, now);
  if (days === null) return 'Never backed up';
  // Clock skew can put exportedAt slightly in the future; that is still a backup.
  if (days <= 0) return 'Last backed up today';
  if (days === 1) return 'Last backed up yesterday';
  return `Last backed up ${days} days ago`;
}

export function isBackupStale(iso: string | null, now: Date = new Date()): boolean {
  const days = daysSince(iso, now);
  if (days === null) return true;
  return days >= BACKUP_STALE_AFTER_DAYS;
}
