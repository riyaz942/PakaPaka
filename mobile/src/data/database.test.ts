import {
  __mockGetImportedAssetDatabase,
  __mockResetSqlite,
} from '../../__mocks__/expo-sqlite';

import { initializeDatabases } from '@/data/database';

const CURRICULUM_ASSET = require('@/assets/curriculum-seed/curriculum.db');

describe('initializeDatabases', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('imports the bundled curriculum asset and migrates user.db', async () => {
    const result = await initializeDatabases();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(__mockGetImportedAssetDatabase(CURRICULUM_ASSET)).toBe('curriculum.db');

    const curriculumVersion = result.value.curriculumDb.getFirstSync<{ version: string }>(
      'SELECT version FROM curriculum_metadata LIMIT 1',
    );
    const migrationCount = result.value.userDb.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM schema_migrations',
    );

    expect(curriculumVersion?.version).toBe('0.0.0-stub');
    expect(migrationCount?.count).toBe(1);
  });

  it('is idempotent when initializeDatabases runs twice', async () => {
    const first = await initializeDatabases();
    const second = await initializeDatabases();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    const migrationCount = second.value.userDb.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM schema_migrations',
    );

    expect(migrationCount?.count).toBe(1);
  });

  it('preserves user_preferences across a second initializeDatabases call', async () => {
    const first = await initializeDatabases();
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    first.value.userDb.runSync(
      'INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)',
      'theme',
      'dark',
      '2026-05-24T00:00:00.000Z',
    );

    const second = await initializeDatabases();
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    const preference = second.value.userDb.getFirstSync<{ value: string }>(
      'SELECT value FROM user_preferences WHERE key = ?',
      'theme',
    );

    expect(preference?.value).toBe('dark');
  });
});
