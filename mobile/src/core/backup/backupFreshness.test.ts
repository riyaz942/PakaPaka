import { formatLastBackedUp, isBackupStale } from '@/core/backup/backupFreshness';

/** Local-time fixtures: the helpers count calendar days in the device's zone. */
function localIso(year: number, month: number, day: number, hour: number): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const NOW = new Date(2026, 7, 14, 12);

describe('formatLastBackedUp', () => {
  it('says never when there is no backup', () => {
    expect(formatLastBackedUp(null, NOW)).toBe('Never backed up');
  });

  it('says today for a backup taken earlier today', () => {
    expect(formatLastBackedUp(localIso(2026, 8, 14, 1), NOW)).toBe('Last backed up today');
  });

  it('says yesterday for a backup taken late the previous evening', () => {
    expect(formatLastBackedUp(localIso(2026, 8, 13, 23), NOW)).toBe('Last backed up yesterday');
  });

  it('counts whole days for anything older', () => {
    expect(formatLastBackedUp(localIso(2026, 8, 5, 12), NOW)).toBe('Last backed up 9 days ago');
  });

  it('treats an unparseable timestamp as never', () => {
    expect(formatLastBackedUp('not-a-date', NOW)).toBe('Never backed up');
  });

  it('treats a future timestamp as today, not never', () => {
    expect(formatLastBackedUp(localIso(2026, 8, 15, 12), NOW)).toBe('Last backed up today');
  });
});

describe('isBackupStale', () => {
  it('is stale when no backup was ever taken', () => {
    expect(isBackupStale(null, NOW)).toBe(true);
  });

  it('is fresh inside the eviction window', () => {
    expect(isBackupStale(localIso(2026, 8, 10, 12), NOW)).toBe(false);
  });

  it('is stale at seven days', () => {
    expect(isBackupStale(localIso(2026, 8, 7, 12), NOW)).toBe(true);
  });

  it('is stale when the timestamp cannot be parsed', () => {
    expect(isBackupStale('not-a-date', NOW)).toBe(true);
  });

  it('does not treat a future timestamp as stale', () => {
    expect(isBackupStale(localIso(2026, 8, 15, 12), NOW)).toBe(false);
  });
});
