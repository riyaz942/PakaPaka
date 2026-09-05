import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Items the learner asked for ahead of their level (untaught-kanji plan, step
 * 3): tapping "Learn 昨 now" on an N5 word's out-of-band component chip.
 *
 * Sync and unwrapped, matching `cardSeenRepository.ts`: single-statement writes
 * on the local `user.db`, not fallible I/O.
 */
export function listLessonOptInIds(userDb: SQLiteDatabase): string[] {
  const rows = userDb.getAllSync<{ item_id: string }>(
    'SELECT item_id FROM lesson_opt_ins',
  );
  return rows.map((row) => row.item_id);
}

export function isLessonOptIn(userDb: SQLiteDatabase, itemId: string): boolean {
  const row = userDb.getFirstSync<{ item_id: string }>(
    'SELECT item_id FROM lesson_opt_ins WHERE item_id = ?',
    itemId,
  );
  return row !== null;
}

/**
 * Re-opting-in is a no-op rather than an update: `opted_in_at` records when the
 * learner first asked, and nothing reads it as a "most recently asked" order.
 */
export function addLessonOptIn(userDb: SQLiteDatabase, itemId: string): void {
  userDb.runSync(
    `INSERT INTO lesson_opt_ins (item_id, opted_in_at) VALUES (?, ?)
     ON CONFLICT(item_id) DO NOTHING`,
    itemId,
    new Date().toISOString(),
  );
}

/**
 * Undo, for a mistap. It only takes the item back out of the *pool* — an item
 * already taught keeps its SRS state, because unasking for a lesson is not the
 * same as unlearning it.
 */
export function removeLessonOptIn(userDb: SQLiteDatabase, itemId: string): void {
  userDb.runSync('DELETE FROM lesson_opt_ins WHERE item_id = ?', itemId);
}
