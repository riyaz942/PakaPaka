import { deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { CURRICULUM_ATTACH_ALIAS, type DatabaseHandles } from '@/data/database';
import type { AppError, Result } from '@/types/result.types';

/** Byte copies of both databases, sent from the owner tab to a browse-only tab (web). */
export type DbSnapshot = { curriculum: Uint8Array; user: Uint8Array };

/** Web-only method added by patches/expo-sqlite+55.0.17.patch. */
type DeserializeIntoNative = {
  deserializeIntoAsync(schemaName: string, data: Uint8Array): Promise<void>;
};

export async function serializeDatabases(
  handles: DatabaseHandles,
): Promise<Result<DbSnapshot, AppError>> {
  try {
    const curriculum = await handles.curriculumDb.serializeAsync('main');
    const user = await handles.userDb.serializeAsync('main');
    return { ok: true, value: { curriculum, user } };
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'DB_SNAPSHOT_SERIALIZE_ERROR', message: String(cause), cause },
    };
  }
}

/**
 * Opens an in-memory copy of both databases (web browse-only tab). The
 * curriculum copy is also loaded into an attached `curriculum` schema on the
 * user copy, so the cross-database joins work as in the owner tab. Never
 * opens a file: the owner tab holds the OPFS files.
 */
export async function openSnapshotDatabases(
  snapshot: DbSnapshot,
): Promise<Result<DatabaseHandles, AppError>> {
  let curriculumDb: SQLiteDatabase | null = null;
  let userDb: SQLiteDatabase | null = null;

  try {
    curriculumDb = await deserializeDatabaseAsync(snapshot.curriculum);
    userDb = await deserializeDatabaseAsync(snapshot.user);
    userDb.execSync('PRAGMA foreign_keys = ON');
    userDb.execSync(`ATTACH ':memory:' AS ${CURRICULUM_ATTACH_ALIAS}`);
    await (userDb.nativeDatabase as unknown as DeserializeIntoNative).deserializeIntoAsync(
      CURRICULUM_ATTACH_ALIAS,
      snapshot.curriculum,
    );
    return { ok: true, value: { curriculumDb, userDb } };
  } catch (cause) {
    await curriculumDb?.closeAsync().catch(() => undefined);
    await userDb?.closeAsync().catch(() => undefined);
    return {
      ok: false,
      error: { code: 'DB_SNAPSHOT_OPEN_ERROR', message: String(cause), cause },
    };
  }
}
