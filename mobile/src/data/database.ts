import {
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import type { AppError, Result } from '@/types/result.types';

const CURRICULUM_DB_NAME = 'curriculum.db';
const USER_DB_NAME = 'user.db';

// Metro bundles .db assets when required from the data layer.
const CURRICULUM_ASSET = require('@/assets/curriculum-seed/curriculum.db');

export type DatabaseHandles = {
  curriculumDb: SQLiteDatabase;
  userDb: SQLiteDatabase;
};

/**
 * Opens curriculum.db (bundled, read-only usage) and user.db (sandbox read-write).
 *
 * Curriculum and user databases are fully isolated — no shared migration path.
 * Curriculum import/swap (Story 1.6) must never run DROP/DELETE against user.db.
 *
 * TODO Story 1.5: add attachCurriculumForQuery(userDb) when repositories need cross-DB joins.
 */
export async function initializeDatabases(): Promise<Result<DatabaseHandles, AppError>> {
  let curriculumDb: SQLiteDatabase | null = null;
  let userDb: SQLiteDatabase | null = null;

  try {
    // importDatabaseFromAssetAsync is @hidden in expo-sqlite typings but matches the
    // architecture dual-DB init contract (imperative bundled import, not SQLiteProvider).
    await importDatabaseFromAssetAsync(CURRICULUM_DB_NAME, {
      assetId: CURRICULUM_ASSET,
    });

    curriculumDb = await openDatabaseAsync(CURRICULUM_DB_NAME);
    userDb = await openDatabaseAsync(USER_DB_NAME);

    const migrationResult = runMigrations(userDb, migrations);
    if (!migrationResult.ok) {
      await curriculumDb.closeAsync();
      await userDb.closeAsync();
      return migrationResult;
    }

    return {
      ok: true,
      value: {
        curriculumDb,
        userDb,
      },
    };
  } catch (cause) {
    if (curriculumDb) {
      await curriculumDb.closeAsync();
    }
    if (userDb) {
      await userDb.closeAsync();
    }

    return {
      ok: false,
      error: {
        code: 'DB_INIT_ERROR',
        message: String(cause),
        cause,
      },
    };
  }
}
