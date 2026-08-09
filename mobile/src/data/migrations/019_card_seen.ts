import type { Migration } from '@/data/migrations/migrations.types';

/**
 * One row per guidance card the learner has been shown (Epic 7).
 *
 * Its own table rather than `user_preferences` keys because the card id set is
 * open-ended: `GUIDANCE_CARDS` grows every time a card is authored, and a
 * key-per-card would mean a migration per card. `user_preferences` is for a
 * fixed, app-known key set; this is a row set keyed by content.
 *
 * Note: the planning docs call this migration `019_card_registry`; every
 * existing migration is named for the table it creates, so `019_card_seen`.
 */
export const migration019CardSeen: Migration = {
  version: 19,
  name: '019_card_seen',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS card_seen (
        card_id TEXT PRIMARY KEY,
        seen_at TEXT NOT NULL
      );
    `);
  },
};
