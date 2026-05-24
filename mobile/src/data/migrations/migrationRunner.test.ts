import { __mockResetSqlite, openDatabaseAsync } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';

describe('runMigrations', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('applies 001_initial on an empty database', async () => {
    const db = await openDatabaseAsync('user.db');

    const result = runMigrations(db, [migration001Initial]);

    expect(result.ok).toBe(true);
    expect(db.getAllSync('SELECT version FROM schema_migrations')).toEqual([
      expect.objectContaining({ version: 1 }),
    ]);
    expect(
      db.getAllSync(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_preferences'",
      ),
    ).toHaveLength(1);
  });

  it('is idempotent when migrations are re-run', async () => {
    const db = await openDatabaseAsync('user.db');

    const firstRun = runMigrations(db, [migration001Initial]);
    const secondRun = runMigrations(db, [migration001Initial]);

    expect(firstRun.ok).toBe(true);
    expect(secondRun.ok).toBe(true);
    expect(db.getAllSync('SELECT version FROM schema_migrations')).toHaveLength(1);
  });
});
