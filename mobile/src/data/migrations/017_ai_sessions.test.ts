import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migrations } from '@/data/migrations';
import { migration017AiSessions } from '@/data/migrations/017_ai_sessions';
import { runMigrations } from '@/data/migrations/migrationRunner';

function tableExists(db: SQLiteDatabase, name: string) {
  return (
    db.getAllSync(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      name,
    ).length === 1
  );
}

describe('017_ai_sessions', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('claims version 17 — 16 is already taken by 016_furigana_overrides', () => {
    expect(migration017AiSessions.version).toBe(17);
    expect(migration017AiSessions.name).toBe('017_ai_sessions');
  });

  it('is registered last in the migration list with no duplicate versions', () => {
    expect(migrations[migrations.length - 1]).toBe(migration017AiSessions);

    const versions = migrations.map((migration) => migration.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });

  it('creates both AI tables when applied', async () => {
    const db = await openDatabaseAsync('user.db');

    const result = runMigrations(db, migrations);

    expect(result.ok).toBe(true);
    expect(tableExists(db, 'ai_sessions')).toBe(true);
    expect(tableExists(db, 'ai_messages')).toBe(true);
  });

  it('is idempotent when re-run', async () => {
    const db = await openDatabaseAsync('user.db');

    expect(runMigrations(db, migrations).ok).toBe(true);
    expect(runMigrations(db, migrations).ok).toBe(true);

    expect(db.getAllSync('SELECT version FROM schema_migrations')).toHaveLength(
      migrations.length,
    );
  });

  it('does not disturb data written by earlier migrations', async () => {
    const db = await openDatabaseAsync('user.db');
    // Apply everything up to 016, write user state, then apply 017 on top.
    runMigrations(db, migrations.slice(0, 16));
    db.runSync(
      `INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      'session_intensity',
      'standard',
      '2026-01-01T00:00:00.000Z',
    );

    expect(runMigrations(db, migrations).ok).toBe(true);

    const preserved = db.getFirstSync<{ value: string }>(
      'SELECT value FROM user_preferences WHERE key = ?',
      'session_intensity',
    );
    expect(preserved?.value).toBe('standard');
  });
});
