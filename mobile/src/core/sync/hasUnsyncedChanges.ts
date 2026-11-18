import type { BackupData } from '@/core/backup/backup.types';
import { sameSyncData } from '@/core/sync/diffSyncData';
import { isEmptyProgress, withCarriedRows } from '@/core/sync/mergeSyncData';
import type { KnownContent } from '@/core/sync/sync.types';
import type { SyncBase } from '@/data/sync/syncBaseStore';

/**
 * True when this device holds progress the server does not have: the same rule the sync runner
 * uses for its `up_to_date` shortcut. Without a base, any study progress counts as unsynced.
 */
export function hasUnsyncedChanges(
  local: BackupData,
  base: SyncBase | null,
  known: KnownContent,
): boolean {
  if (base === null) return !isEmptyProgress(local);
  if (base.pendingReplace) return true;
  return !sameSyncData(withCarriedRows(local, base.data, known, base.carried), base.data);
}
