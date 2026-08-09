import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migrations } from '@/data/migrations';
import { migration019CardSeen } from '@/data/migrations/019_card_seen';

describe('019_card_seen', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('claims version 19 and is registered in version order', () => {
    expect(migration019CardSeen.version).toBe(19);
    expect(migration019CardSeen.name).toBe('019_card_seen');
    expect(migrations[18]).toBe(migration019CardSeen);
  });

  it('creates card_seen and is idempotent on re-run', async () => {
    const db = await openDatabaseAsync('user.db');

    migration019CardSeen.up(db);
    expect(
      db.getAllSync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", 'card_seen'),
    ).toHaveLength(1);

    db.runSync(
      'INSERT INTO card_seen (card_id, seen_at) VALUES (?, ?) ON CONFLICT(card_id) DO NOTHING',
      'three-scripts',
      'then',
    );

    // CREATE TABLE IF NOT EXISTS — re-running must not drop what is there.
    migration019CardSeen.up(db);
    expect(db.getAllSync('SELECT card_id FROM card_seen')).toHaveLength(1);
  });
});
