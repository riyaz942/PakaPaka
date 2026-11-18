import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { itemRefKey } from '@/core/backup/slugResolver';
import { diffSyncData, sameSyncData, type SyncDiff } from '@/core/sync/diffSyncData';
import { SYNC_TABLE_KEYS, type CarriedKeys, type SyncTableKey } from '@/core/sync/sync.types';
import { toSyncData } from '@/core/sync/syncFile';
import { syncError } from '@/core/sync/syncMessages';
import { rowKey, type SyncRow } from '@/core/sync/syncTables';
import { writeSyncBase } from '@/data/sync/syncBaseStore';
import { readUserTables, type CurriculumLookup } from '@/data/sync/syncSnapshot';
import { withSyncTransaction, type SyncSql } from '@/data/sync/syncTransaction';
import { notifyFuriganaOverridesChanged } from '@/data/user/furiganaOverrideEvents';
import type { AppError, Result } from '@/types/result.types';

/** Bound parameters per statement stay under SQLite's old 999 limit. */
const MAX_PARAMS_PER_STATEMENT = 900;

type ItemIdOf = (item: ItemRef) => number;

type TableWriter<K extends SyncTableKey> = {
  table: string;
  /** The primary key columns come first. */
  columns: readonly string[];
  /** How many leading columns are the primary key; 0 = no natural key, so no deletes. */
  keyColumns: number;
  insert: 'INSERT OR REPLACE' | 'INSERT';
  values(row: SyncRow<K>, itemId: ItemIdOf): SQLiteBindValue[];
};

const WRITERS: { [K in SyncTableKey]: TableWriter<K> } = {
  userPreferences: {
    table: 'user_preferences',
    columns: ['key', 'value', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row) => [row.key, row.value, row.updatedAt],
  },
  itemStudyStatus: {
    table: 'item_study_status',
    columns: ['item_id', 'status', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [itemId(row.item), row.status, row.updatedAt],
  },
  srsStates: {
    table: 'srs_states',
    columns: [
      'item_id',
      'stability',
      'difficulty',
      'due_date',
      'fsrs_state',
      'reps',
      'lapses',
      'learning_steps',
      'is_burned',
      'srs_stage_label',
      'last_reviewed_at',
      'updated_at',
    ],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [
      itemId(row.item),
      row.stability,
      row.difficulty,
      row.dueDate,
      row.fsrsState,
      row.reps,
      row.lapses,
      row.learningSteps,
      row.isBurned ? 1 : 0,
      row.srsStageLabel,
      row.lastReviewedAt,
      row.updatedAt,
    ],
  },
  // `id` is AUTOINCREMENT: there is no natural key to replace or delete by.
  importMetadata: {
    table: 'import_metadata',
    columns: ['source', 'imported_at', 'mapped_count', 'unmatched_count'],
    keyColumns: 0,
    insert: 'INSERT',
    values: (row) => [row.source, row.importedAt, row.mappedCount, row.unmatchedCount],
  },
  personalMnemonics: {
    table: 'personal_mnemonics',
    columns: ['item_id', 'mnemonic_text', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [itemId(row.item), row.mnemonicText, row.updatedAt],
  },
  relatedItemBoosts: {
    table: 'related_item_boosts',
    columns: ['item_id', 'boost', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [itemId(row.item), row.boost, row.updatedAt],
  },
  weaknessStats: {
    table: 'weakness_stats',
    columns: [
      'item_id',
      'correct_count',
      'incorrect_count',
      'typo_count',
      'last_error_at',
      'last_error_type',
      'pattern_tags',
      'updated_at',
    ],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [
      itemId(row.item),
      row.correctCount,
      row.incorrectCount,
      row.typoCount,
      row.lastErrorAt,
      row.lastErrorType,
      row.patternTags,
      row.updatedAt,
    ],
  },
  cognitiveLoadHistory: {
    table: 'cognitive_load_history',
    columns: ['date', 'load', 'threshold', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row) => [row.date, row.load, row.threshold, row.updatedAt],
  },
  // One row with CHECK (id = 1); the id is not in the file.
  streaks: {
    table: 'streaks',
    columns: [
      'id',
      'current_streak',
      'longest_streak',
      'last_review_date',
      'last_celebrated_date',
      'updated_at',
    ],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row) => [
      1,
      row.currentStreak,
      row.longestStreak,
      row.lastReviewDate,
      row.lastCelebratedDate,
      row.updatedAt,
    ],
  },
  userSynonyms: {
    table: 'user_synonyms',
    columns: ['item_id', 'answer_type', 'answer_text', 'created_at'],
    keyColumns: 3,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [itemId(row.item), row.answerType, row.answerText, row.createdAt],
  },
  dailyLessonLog: {
    table: 'daily_lesson_log',
    columns: ['date', 'items_started'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row) => [row.date, row.itemsStarted],
  },
  goalRingState: {
    table: 'goal_ring_state',
    columns: [
      'id',
      'daily_goal_target',
      'goal_week_start',
      'consecutive_miss_weeks',
      'pending_rise_to',
      'pending_reduction_to',
      'updated_at',
    ],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row) => [
      1,
      row.dailyGoalTarget,
      row.goalWeekStart,
      row.consecutiveMissWeeks,
      row.pendingRiseTo,
      row.pendingReductionTo,
      row.updatedAt,
    ],
  },
  // `item_id` is TEXT (016).
  furiganaOverrides: {
    table: 'furigana_overrides',
    columns: ['item_id', 'display_mode', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [String(itemId(row.item)), row.displayMode, row.updatedAt],
  },
  cardSeen: {
    table: 'card_seen',
    columns: ['card_id', 'seen_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row) => [row.cardId, row.seenAt],
  },
  passagePracticeResults: {
    table: 'passage_practice_results',
    columns: ['passage_id', 'question_id', 'is_correct', 'user_answer', 'answered_at'],
    keyColumns: 2,
    insert: 'INSERT OR REPLACE',
    values: (row) => [
      Number(row.passageId),
      Number(row.questionId),
      row.isCorrect ? 1 : 0,
      row.userAnswer,
      row.answeredAt,
    ],
  },
  grammarAnswers: {
    table: 'user_grammar_answers',
    columns: ['item_id', 'sentence_key', 'answer_text', 'created_at'],
    keyColumns: 3,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [itemId(row.item), row.sentenceKey, row.answerText, row.createdAt],
  },
  grammarSentenceHistory: {
    table: 'grammar_sentence_history',
    columns: ['item_id', 'sentence_keys', 'updated_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [itemId(row.item), JSON.stringify(row.sentenceKeys), row.updatedAt],
  },
  // `item_id` is TEXT (020).
  lessonOptIns: {
    table: 'lesson_opt_ins',
    columns: ['item_id', 'opted_in_at'],
    keyColumns: 1,
    insert: 'INSERT OR REPLACE',
    values: (row, itemId) => [String(itemId(row.item)), row.optedInAt],
  },
};

/** Deletes then batched upserts, table by table. Returns the number of rows written. */
async function writeDiff(tx: SyncSql, diff: SyncDiff, itemId: ItemIdOf): Promise<number> {
  let changedRows = 0;
  for (const table of SYNC_TABLE_KEYS) {
    const writer = WRITERS[table] as TableWriter<SyncTableKey>;
    const { upserts, deletes } = diff[table] as {
      upserts: SyncRow<SyncTableKey>[];
      deletes: SyncRow<SyncTableKey>[];
    };

    if (writer.keyColumns > 0) {
      const where = writer.columns
        .slice(0, writer.keyColumns)
        .map((column) => `${column} = ?`)
        .join(' AND ');
      for (const row of deletes) {
        await tx.runAsync(
          `DELETE FROM ${writer.table} WHERE ${where}`,
          writer.values(row, itemId).slice(0, writer.keyColumns),
        );
        changedRows += 1;
      }
    }

    const rowsPerStatement = Math.floor(MAX_PARAMS_PER_STATEMENT / writer.columns.length);
    const placeholders = `(${writer.columns.map(() => '?').join(', ')})`;
    for (let start = 0; start < upserts.length; start += rowsPerStatement) {
      const batch = upserts.slice(start, start + rowsPerStatement);
      await tx.runAsync(
        `${writer.insert} INTO ${writer.table} (${writer.columns.join(', ')}) VALUES ${batch
          .map(() => placeholders)
          .join(', ')}`,
        batch.flatMap((row) => writer.values(row, itemId)),
      );
      changedRows += batch.length;
    }
  }
  return changedRows;
}

/** A no-op write: it starts the write transaction (SQLite takes the write lock) and changes nothing. */
const TAKE_WRITE_LOCK = 'UPDATE sync_base SET id = id WHERE 0';

/**
 * `import_metadata` is written with a plain INSERT (no natural key), so an upsert whose key
 * (source + importedAt) `user.db` already has would add a second row with that key, and the next
 * pushed file would be rejected for a duplicate key. Those upserts are left out.
 */
function withoutLocalImportKeys(diff: SyncDiff, expectedLocal: BackupData): SyncDiff {
  const localKeys = new Set(expectedLocal.importMetadata.map((row) => rowKey('importMetadata', row)));
  return {
    ...diff,
    importMetadata: {
      ...diff.importMetadata,
      upserts: diff.importMetadata.upserts.filter((row) => !localKeys.has(rowKey('importMetadata', row))),
    },
  };
}

/**
 * Writes `merged` over `expectedLocal` and stores the new base, in one transaction. If `user.db`
 * no longer matches `expectedLocal` (the learner changed something since the snapshot), nothing
 * is written and the result is `sync_local_changed`. Rows for content this curriculum lacks are
 * not written; they stay in the base.
 */
export async function applySyncMerge(
  userDb: SQLiteDatabase,
  args: {
    expectedLocal: BackupData;
    merged: BackupData;
    lookup: CurriculumLookup;
    base: { revision: number; data: BackupData; carried: CarriedKeys };
  },
): Promise<Result<{ changedRows: number }, AppError>> {
  const { lookup, base } = args;
  // Never-synced preferences are never written or deleted here, whatever the caller passes.
  const expectedLocal = toSyncData(args.expectedLocal);
  const merged = toSyncData(args.merged);
  const itemId: ItemIdOf = (item) => {
    const id = lookup.refToId.get(itemRefKey(item));
    // diffSyncData leaves out unknown items, so this cannot happen; the throw rolls back.
    if (id === undefined) throw new Error(`No curriculum id for ${itemRefKey(item)}`);
    return id;
  };

  let localChanged = false;
  let changedRows = 0;
  try {
    await withSyncTransaction(userDb, async (tx) => {
      // The transaction BEGIN is deferred. Take the write lock before the read: otherwise a UI
      // write that commits between the compare and our first write makes that write fail
      // (WAL: "database is locked"). This statement changes no row.
      await tx.runAsync(TAKE_WRITE_LOCK);
      const now = await readUserTables(tx, lookup);
      if (!sameSyncData(now, expectedLocal)) {
        localChanged = true;
        return;
      }
      const diff = withoutLocalImportKeys(diffSyncData(expectedLocal, merged, lookup.known), expectedLocal);
      changedRows = await writeDiff(tx, diff, itemId);
      await writeSyncBase(tx, base, null);
    });
  } catch (cause) {
    return { ok: false, error: syncError('sync_local_failed', cause) };
  }

  if (localChanged) return { ok: false, error: syncError('sync_local_changed') };
  if (changedRows > 0) notifyFuriganaOverridesChanged();
  return { ok: true, value: { changedRows } };
}
