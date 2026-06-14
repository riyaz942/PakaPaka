import type { SQLiteDatabase } from 'expo-sqlite';

import type { ImportSummary, MappedImportItem } from '@/core/import/import.types';
import { mapAnkiCards } from '@/core/import/ankiMapper';
import { mapBunproGrammarItems } from '@/core/import/bunproMapper';
import { mapWaniKaniAssignments } from '@/core/import/wanikaniMapper';
import { getExternalIdMappings } from '@/data/curriculum/externalIdMappingRepository';
import {
  cleanupAnkiImportFile,
  readAnkiApkgFile,
  type AnkiFileReaderDeps,
} from '@/data/import/ankiFileReader';
import { fetchBunproGrammarProgress, type BunproClientDeps } from '@/data/import/bunproClient';
import { fetchWaniKaniAssignments, type WaniKaniClientDeps } from '@/data/import/wanikaniClient';
import { discardImportCredential, getImportCredential } from '@/data/user/credentialStore';
import { bulkSetStudyStatusKnown, setStudyStatus } from '@/data/user/itemStudyStatusRepository';
import type { AppError, Result } from '@/types/result.types';

const BUNPRO_PARTIAL_IMPORT_WARNING =
  'Imported partial Bunpro progress. Some SRS levels were unavailable, so higher-level or burned grammar may be missing. You can retry later or mark grammar manually.';

type PersistMappedImportOptions = {
  onBeforeInsert?: (item: MappedImportItem, index: number) => void;
};

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

export function persistMappedImportItems(
  userDb: SQLiteDatabase,
  mapped: MappedImportItem[],
  summary: ImportSummary,
  options: PersistMappedImportOptions = {},
): Result<void, AppError> {
  try {
    const updatedAt = new Date().toISOString();
    const burnedItemIds: string[] = [];

    userDb.withTransactionSync(() => {
      for (const [index, item] of mapped.entries()) {
        options.onBeforeInsert?.(item, index);

        userDb.runSync(
          `INSERT INTO srs_states (
             item_id, stability, difficulty, due_date, fsrs_state,
             reps, lapses, is_burned, srs_stage_label, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(item_id) DO UPDATE SET
             stability = excluded.stability,
             difficulty = excluded.difficulty,
             due_date = excluded.due_date,
             fsrs_state = excluded.fsrs_state,
             reps = excluded.reps,
             lapses = excluded.lapses,
             is_burned = excluded.is_burned,
             srs_stage_label = excluded.srs_stage_label,
             updated_at = excluded.updated_at`,
          parseItemId(item.itemId),
          item.fsrsState.stability,
          item.fsrsState.difficulty,
          item.fsrsState.dueDate,
          item.fsrsState.state,
          item.fsrsState.reps,
          item.fsrsState.lapses,
          item.fsrsState.isBurned ? 1 : 0,
          item.fsrsState.srsStageLabel,
          updatedAt,
        );

        if (item.fsrsState.isBurned) {
          burnedItemIds.push(item.itemId);
        } else {
          setStudyStatus(userDb, item.itemId, 'in_progress');
        }
      }

      if (burnedItemIds.length > 0) {
        bulkSetStudyStatusKnown(userDb, burnedItemIds);
      }

      userDb.runSync(
        `INSERT INTO import_metadata (source, imported_at, mapped_count, unmatched_count)
         VALUES (?, ?, ?, ?)`,
        summary.source,
        updatedAt,
        summary.mappedCount,
        summary.unmatchedCount,
      );
    });

    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'import_persist_failed',
        message: 'Failed to persist imported progress',
        userMessage: 'Import could not be saved. Your previous progress was not changed.',
        cause,
      },
    };
  }
}

export async function runWaniKaniImport(
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
  deps: WaniKaniClientDeps = {},
): Promise<Result<ImportSummary, AppError>> {
  const credentialResult = await getImportCredential('wanikani');
  if (!credentialResult.ok) {
    return credentialResult;
  }

  if (!credentialResult.value) {
    return {
      ok: false,
      error: {
        code: 'import_credential_missing',
        message: 'WaniKani API key is not stored',
        userMessage: 'Add your WaniKani API key before importing.',
      },
    };
  }

  const assignmentsResult = await fetchWaniKaniAssignments(credentialResult.value, deps);
  if (!assignmentsResult.ok) {
    return assignmentsResult;
  }

  const externalIds = assignmentsResult.value.map((assignment) => String(assignment.subject_id));
  const mappingLookup = getExternalIdMappings(curriculumDb, 'wanikani', externalIds);
  const mapResult = mapWaniKaniAssignments(assignmentsResult.value, mappingLookup);

  const persistResult = persistMappedImportItems(userDb, mapResult.mapped, mapResult.summary);
  if (!persistResult.ok) {
    return persistResult;
  }

  const discardResult = await discardImportCredential('wanikani');
  if (!discardResult.ok) {
    return discardResult;
  }

  return { ok: true, value: mapResult.summary };
}

export async function runBunproImport(
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
  deps: BunproClientDeps = {},
): Promise<Result<ImportSummary, AppError>> {
  const credentialResult = await getImportCredential('bunpro');
  if (!credentialResult.ok) {
    return credentialResult;
  }

  if (!credentialResult.value) {
    return {
      ok: false,
      error: {
        code: 'import_credential_missing',
        message: 'Bunpro frontend token is not stored',
        userMessage: 'Add your Bunpro frontend token before importing.',
      },
    };
  }

  const grammarResult = await fetchBunproGrammarProgress(credentialResult.value, deps);
  if (!grammarResult.ok) {
    return grammarResult;
  }

  const { items, unavailableLevelCount } = grammarResult.value;
  const externalIds = items.map((item) => item.grammarPointId);
  const mappingLookup = getExternalIdMappings(curriculumDb, 'bunpro', externalIds);
  const mapResult = mapBunproGrammarItems(items, mappingLookup);

  if (unavailableLevelCount > 0) {
    mapResult.summary.warningMessage = BUNPRO_PARTIAL_IMPORT_WARNING;
  }

  const persistResult = persistMappedImportItems(userDb, mapResult.mapped, mapResult.summary);
  if (!persistResult.ok) {
    return persistResult;
  }

  const discardResult = await discardImportCredential('bunpro');
  if (!discardResult.ok) {
    return discardResult;
  }

  return { ok: true, value: mapResult.summary };
}

export async function runAnkiImport(
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
  filePath: string,
  deps: AnkiFileReaderDeps = {},
): Promise<Result<ImportSummary, AppError>> {
  const parseResult = await readAnkiApkgFile(filePath, deps);
  if (!parseResult.ok) {
    await cleanupAnkiImportFile(filePath, deps);
    return parseResult;
  }

  const externalIds = parseResult.value.notes.map((note) => note.sfld);
  const mappingLookup = getExternalIdMappings(curriculumDb, 'anki', externalIds);
  const mapResult = mapAnkiCards(parseResult.value, mappingLookup);

  const persistResult = persistMappedImportItems(userDb, mapResult.mapped, mapResult.summary);
  await cleanupAnkiImportFile(filePath, deps);

  if (!persistResult.ok) {
    return persistResult;
  }

  return { ok: true, value: mapResult.summary };
}

export function countSrsStates(userDb: SQLiteDatabase): number {
  const row = userDb.getFirstSync<{ count: number }>('SELECT COUNT(*) AS count FROM srs_states');
  return row?.count ?? 0;
}

export function countImportMetadataRows(userDb: SQLiteDatabase): number {
  const row = userDb.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM import_metadata',
  );
  return row?.count ?? 0;
}
