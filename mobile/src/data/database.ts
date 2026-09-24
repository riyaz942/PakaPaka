import {
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { CURRICULUM_DB_NAME } from '@/data/curriculum/curriculumConfig';
import { isCurriculumVersionNewer } from '@/data/curriculum/curriculumVersion';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getCurriculumUpdateSource,
  setCurriculumInstallMetadata,
} from '@/data/user/preferencesRepository';
import type { AppError, Result } from '@/types/result.types';

const USER_DB_NAME = 'user.db';

// Metro bundles .db assets when required from the data layer.
const CURRICULUM_ASSET = require('@/assets/curriculum-seed/curriculum.db');
// Written next to the seed by scripts/compile-curriculum.ts.
const BUNDLED_SEED = require('@/assets/curriculum-seed/curriculum-seed.json') as {
  version: number;
};

export type DatabaseHandles = {
  curriculumDb: SQLiteDatabase;
  userDb: SQLiteDatabase;
};

function readCurriculumVersion(curriculumDb: SQLiteDatabase): string | null {
  const metadata = curriculumDb.getFirstSync<{ version: string }>(
    'SELECT version FROM curriculum_metadata LIMIT 1',
  );
  return metadata?.version ?? null;
}

/** True when the seed bundled in this app build is newer than the installed curriculum. */
function bundledSeedIsNewer(curriculumDb: SQLiteDatabase): boolean {
  const installed = readCurriculumVersion(curriculumDb);
  return installed === null || isCurriculumVersionNewer(BUNDLED_SEED.version, installed);
}

/**
 * Imports the bundled seed on first launch, and again when an app update ships
 * a newer seed version — over a bundled or a downloaded (Story 1.6) curriculum.
 */
export async function openCurriculumDatabase(
  userDb: SQLiteDatabase,
): Promise<Result<SQLiteDatabase, AppError>> {
  try {
    const updateSource = getCurriculumUpdateSource(userDb);
    let importedBundled = updateSource === null;

    if (importedBundled) {
      // importDatabaseFromAssetAsync is @hidden in expo-sqlite typings but matches the
      // architecture dual-DB init contract (imperative bundled import, not SQLiteProvider).
      await importDatabaseFromAssetAsync(CURRICULUM_DB_NAME, {
        assetId: CURRICULUM_ASSET,
      });
    }

    let curriculumDb = await openDatabaseAsync(CURRICULUM_DB_NAME);

    if (updateSource !== null && bundledSeedIsNewer(curriculumDb)) {
      await curriculumDb.closeAsync();
      await importDatabaseFromAssetAsync(CURRICULUM_DB_NAME, {
        assetId: CURRICULUM_ASSET,
        forceOverwrite: true,
      });
      curriculumDb = await openDatabaseAsync(CURRICULUM_DB_NAME);
      importedBundled = true;
    }

    if (importedBundled) {
      const version = readCurriculumVersion(curriculumDb);
      if (version) {
        const metadata = curriculumDb.getFirstSync<{ content_hash: string | null }>(
          'SELECT content_hash FROM curriculum_metadata LIMIT 1',
        );
        setCurriculumInstallMetadata(userDb, {
          version,
          source: 'bundled',
          contentHash: metadata?.content_hash ?? null,
        });
      }
    }

    return { ok: true, value: curriculumDb };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'DB_CURRICULUM_OPEN_ERROR',
        message: String(cause),
        cause,
      },
    };
  }
}

/** Reopens curriculum.db after an on-disk atomic swap (Story 1.6). Never touches user.db. */
export async function reopenCurriculumDatabase(): Promise<Result<SQLiteDatabase, AppError>> {
  try {
    const curriculumDb = await openDatabaseAsync(CURRICULUM_DB_NAME);
    return { ok: true, value: curriculumDb };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'DB_CURRICULUM_REOPEN_ERROR',
        message: String(cause),
        cause,
      },
    };
  }
}

export const CURRICULUM_ATTACH_ALIAS = 'curriculum';

/**
 * Attaches curriculum.db onto the user.db connection so repositories can join
 * across both (e.g. mastery lookups joining curriculum.items against
 * item_study_status/srs_states) without a second query round-trip. Safe to
 * call more than once — detaches first if already attached, which is
 * required after `reopenCurriculumDatabase()`'s atomic OTA file swap.
 */
export function attachCurriculumForQuery(
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
): void {
  try {
    userDb.execSync(`DETACH DATABASE ${CURRICULUM_ATTACH_ALIAS}`);
  } catch {
    // Not yet attached — expected on first call.
  }
  userDb.execSync(
    `ATTACH DATABASE '${curriculumDb.databasePath.replace(/'/g, "''")}' AS ${CURRICULUM_ATTACH_ALIAS}`,
  );
}

/**
 * Opens curriculum.db (bundled on first launch) and user.db (sandbox read-write).
 *
 * Curriculum and user databases are fully isolated — no shared migration path.
 * Curriculum import/swap (Story 1.6) must never run DROP/DELETE against user.db.
 */
export async function initializeDatabases(): Promise<Result<DatabaseHandles, AppError>> {
  let curriculumDb: SQLiteDatabase | null = null;
  let userDb: SQLiteDatabase | null = null;

  try {
    userDb = await openDatabaseAsync(USER_DB_NAME);
    // SQLite keeps foreign keys off unless enabled per connection. Migration
    // 017's ON DELETE CASCADE on ai_messages is inert without this.
    userDb.execSync('PRAGMA foreign_keys = ON');

    const migrationResult = runMigrations(userDb, migrations);
    if (!migrationResult.ok) {
      await userDb.closeAsync();
      return migrationResult;
    }

    const curriculumResult = await openCurriculumDatabase(userDb);
    if (!curriculumResult.ok) {
      await userDb.closeAsync();
      return curriculumResult;
    }

    curriculumDb = curriculumResult.value;
    attachCurriculumForQuery(userDb, curriculumDb);

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
