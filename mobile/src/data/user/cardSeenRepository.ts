import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Which guidance cards (Epic 7) the learner has already been shown.
 *
 * Sync and unwrapped, matching `preferencesRepository.ts`: these are two
 * single-row SQLite statements on the local `user.db`, not fallible I/O.
 */
export function isCardSeen(userDb: SQLiteDatabase, cardId: string): boolean {
  const row = userDb.getFirstSync<{ card_id: string }>(
    'SELECT card_id FROM card_seen WHERE card_id = ?',
    cardId,
  );
  return row !== null;
}

/**
 * Records a card as seen. Re-marking is a no-op rather than an update: the
 * first sighting is the one that matters, so `seen_at` must not move.
 */
export function markCardSeen(userDb: SQLiteDatabase, cardId: string): void {
  userDb.runSync(
    `INSERT INTO card_seen (card_id, seen_at) VALUES (?, ?)
     ON CONFLICT(card_id) DO NOTHING`,
    cardId,
    new Date().toISOString(),
  );
}
