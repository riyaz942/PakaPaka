import { __mockResetSqlite, openDatabaseAsync } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migrations } from '@/data/migrations';
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

  it('applies 002_item_study_status after 001_initial', async () => {
    const db = await openDatabaseAsync('user.db');

    const result = runMigrations(db, [migration001Initial, migration002ItemStudyStatus]);

    expect(result.ok).toBe(true);
    expect(db.getAllSync('SELECT version FROM schema_migrations ORDER BY version')).toEqual([
      expect.objectContaining({ version: 1 }),
      expect.objectContaining({ version: 2 }),
    ]);
    expect(
      db.getAllSync(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_study_status'",
      ),
    ).toHaveLength(1);
  });

  it('is idempotent when 002 is re-run on an already migrated database', async () => {
    const db = await openDatabaseAsync('user.db');

    const firstRun = runMigrations(db, [migration001Initial, migration002ItemStudyStatus]);
    const secondRun = runMigrations(db, [migration001Initial, migration002ItemStudyStatus]);

    expect(firstRun.ok).toBe(true);
    expect(secondRun.ok).toBe(true);
    expect(db.getAllSync('SELECT version FROM schema_migrations')).toHaveLength(2);
  });

  it('applies the full migration list, ending with 016_furigana_overrides', async () => {
    const db = await openDatabaseAsync('user.db');

    const result = runMigrations(db, migrations);

    expect(result.ok).toBe(true);
    expect(migrations.map((migration) => migration.version)).toEqual(
      migrations.map((_, index) => index + 1),
    );
    expect(migrations[migrations.length - 1].name).toBe('016_furigana_overrides');
    expect(
      // Parameterized form: the shared mock only special-cases a few literal
      // table names in sqlite_master queries, but handles `name = ?` generically.
      db.getAllSync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [
        'furigana_overrides',
      ]),
    ).toHaveLength(1);
  });
});
