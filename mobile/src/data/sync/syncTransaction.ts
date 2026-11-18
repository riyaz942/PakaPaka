import type { SQLiteDatabase } from 'expo-sqlite';

import { supportsExclusiveTransaction } from '@/platform/capabilities';

/** The async statements sync code runs, on the main handle or inside a transaction. */
export type SyncSql = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

/**
 * One transaction for a sync write. Native uses the exclusive form (its own connection, so a UI
 * write cannot join it; that connection has no `curriculum` ATTACH). Web has only the plain form.
 */
export function withSyncTransaction(
  db: SQLiteDatabase,
  task: (tx: SyncSql) => Promise<void>,
): Promise<void> {
  if (supportsExclusiveTransaction()) return db.withExclusiveTransactionAsync(task);
  return db.withTransactionAsync(() => task(db));
}
