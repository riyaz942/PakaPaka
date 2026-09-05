import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migrations } from '@/data/migrations';
import { migration020LessonOptIns } from '@/data/migrations/020_lesson_opt_ins';

describe('020_lesson_opt_ins', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('claims version 20 and is registered in version order', () => {
    expect(migration020LessonOptIns.version).toBe(20);
    expect(migration020LessonOptIns.name).toBe('020_lesson_opt_ins');
    expect(migrations[19]).toBe(migration020LessonOptIns);
  });

  it('creates lesson_opt_ins and is idempotent on re-run', async () => {
    const db = await openDatabaseAsync('user.db');

    migration020LessonOptIns.up(db);
    expect(
      db.getAllSync(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        'lesson_opt_ins',
      ),
    ).toHaveLength(1);

    db.runSync(
      'INSERT INTO lesson_opt_ins (item_id, opted_in_at) VALUES (?, ?) ON CONFLICT(item_id) DO NOTHING',
      '2552',
      'then',
    );

    // CREATE TABLE IF NOT EXISTS — re-running must not drop what is there.
    migration020LessonOptIns.up(db);
    expect(db.getAllSync('SELECT item_id FROM lesson_opt_ins')).toHaveLength(1);
  });
});
