import * as sqlite from 'expo-sqlite';

import {
  __mockClearImportedAssets,
  __mockGetImportedAssetDatabase,
  __mockResetSqlite,
} from '../../__mocks__/expo-sqlite';

import { initializeDatabases } from '@/data/database';
import { migrations } from '@/data/migrations';
import {
  PREFERENCE_KEYS,
  setCurriculumInstallMetadata,
} from '@/data/user/preferencesRepository';

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
    const updateSource = result.value.userDb.getFirstSync<{ value: string }>(
      'SELECT value FROM user_preferences WHERE key = ?',
      PREFERENCE_KEYS.curriculumUpdateSource,
    );

    expect(curriculumVersion?.version).toBe('1');
    expect(migrationCount?.count).toBe(migrations.length);
    expect(updateSource?.value).toBe('bundled');
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

    expect(migrationCount?.count).toBe(migrations.length);
  });

  it('does not re-import bundled asset on second initializeDatabases', async () => {
    const first = await initializeDatabases();
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    __mockClearImportedAssets();

    const second = await initializeDatabases();
    expect(second.ok).toBe(true);
    expect(__mockGetImportedAssetDatabase(CURRICULUM_ASSET)).toBeUndefined();
  });

  it('skips bundled import when curriculum was downloaded', async () => {
    const first = await initializeDatabases();
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    setCurriculumInstallMetadata(first.value.userDb, {
      version: '2',
      source: 'downloaded',
    });

    await first.value.curriculumDb.closeAsync();
    await first.value.userDb.closeAsync();
    __mockClearImportedAssets();

    const second = await initializeDatabases();
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(__mockGetImportedAssetDatabase(CURRICULUM_ASSET)).toBeUndefined();
    expect(
      second.value.userDb.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.curriculumUpdateSource,
      )?.value,
    ).toBe('downloaded');
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

  // Web: another tab holds the OPFS access handles. The worker passes the
  // browser's error on as text, e.g. "NoModificationAllowedError: ... Access
  // Handles cannot be created if there is another open Access Handle ...".
  it('reports DB_LOCKED_BY_OTHER_TAB when another tab holds the files', async () => {
    const spy = jest
      .spyOn(sqlite, 'openDatabaseAsync')
      .mockRejectedValueOnce(
        new Error(
          "NoModificationAllowedError: Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.",
        ),
      );

    const result = await initializeDatabases();
    spy.mockRestore();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('DB_LOCKED_BY_OTHER_TAB');
  });

  it('keeps DB_INIT_ERROR for other open failures', async () => {
    const spy = jest
      .spyOn(sqlite, 'openDatabaseAsync')
      .mockRejectedValueOnce(new Error('disk I/O error'));

    const result = await initializeDatabases();
    spy.mockRestore();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('DB_INIT_ERROR');
  });
});
