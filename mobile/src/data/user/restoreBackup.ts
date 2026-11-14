import type { SQLiteDatabase } from 'expo-sqlite';
import * as pako from 'pako';

import { parseBackupBundle } from '@/core/backup/backupSerializer';
import { validateBackupData } from '@/core/backup/backupValidator';
import {
  BACKUP_DATA_KEYS,
  type BackupBundle,
  type BackupData,
  type BackupPreview,
  type ItemRef,
} from '@/core/backup/backup.types';
import { buildItemRefToIdMap, itemRefKey, resolveItemRefToId } from '@/core/backup/slugResolver';
import { CURRICULUM_ATTACH_ALIAS } from '@/data/database';
import { readBackupFile } from '@/data/user/backupFile';
import { notifyFuriganaOverridesChanged } from '@/data/user/furiganaOverrideEvents';
import {
  clearPreference,
  PREFERENCE_KEYS,
  setOnboardingPath,
  setPreference,
} from '@/data/user/preferencesRepository';
import type { AppError, Result } from '@/types/result.types';

const C = CURRICULUM_ATTACH_ALIAS;

/**
 * Where the restore was started from. Onboarding must land the learner on the
 * final step, so it overrides the completion flags the backup carries; a
 * Settings restore keeps whatever the file says (AC8).
 */
export type RestoreOrigin = 'onboarding' | 'settings';

export type RestoreBackupResult = {
  restoredRowCount: number;
  unmatchedSlugCount: number;
  unmatchedPassageCount: number;
};

const READ_FAILED_USER_MESSAGE =
  'Could not read that file. Pick the .json.gz backup file you exported.';
const INVALID_GZIP_USER_MESSAGE =
  'That file is not a PakaPaka backup. Pick the .json.gz file you exported.';
const SCHEMA_TOO_NEW_USER_MESSAGE =
  'This backup was made by a newer version of the app. Update PakaPaka, then restore.';
// Matches the honesty of importRepository's failure copy: a rolled-back
// transaction leaves the device exactly as it was.
const RESTORE_FAILED_USER_MESSAGE =
  'Restore could not be saved. Your previous progress was not changed.';

/**
 * Device-local curriculum install state. These describe which `curriculum.db`
 * *this* device has, not learner progress — restoring another device's values
 * would break the OTA update check. Read lazily: screen tests mock
 * `preferencesRepository` partially, and a module-scope read would crash on
 * import.
 */
function preservedPreferenceKeys(): readonly string[] {
  return [
    PREFERENCE_KEYS.installedCurriculumVersion,
    PREFERENCE_KEYS.installedCurriculumContentHash,
    PREFERENCE_KEYS.curriculumUpdateSource,
  ];
}

/**
 * Every table replace-all wipes, in delete order: `ai_messages` before
 * `ai_sessions` so the FK holds on the real handle (`PRAGMA foreign_keys = ON`),
 * which the expo-sqlite mock does not enforce.
 */
const RESTORE_TABLES: readonly string[] = [
  'ai_messages',
  'ai_sessions',
  'user_preferences',
  'item_study_status',
  'srs_states',
  'import_metadata',
  'personal_mnemonics',
  'related_item_boosts',
  'weakness_stats',
  'cognitive_load_history',
  'streaks',
  'user_synonyms',
  'daily_lesson_log',
  'goal_ring_state',
  'furigana_overrides',
  'card_seen',
  'passage_practice_results',
  'user_grammar_answers',
  'grammar_sentence_history',
];

function failure(
  code: string,
  message: string,
  userMessage: string,
  cause?: unknown,
): Result<never, AppError> {
  return { ok: false, error: { code, message, userMessage, cause } };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function readCurriculumItemRefToIdMap(userDb: SQLiteDatabase): Map<string, number> {
  const rows = userDb.getAllSync<{ id: number | string; item_type: ItemRef['itemType']; slug: string }>(
    `SELECT id, item_type, slug FROM ${C}.items`,
  );
  return buildItemRefToIdMap(
    rows.map((row) => ({ id: row.id, itemType: row.item_type, slug: row.slug })),
  );
}

function readCurriculumIdSet(userDb: SQLiteDatabase, table: string): Set<string> {
  const rows = userDb.getAllSync<{ id: number | string }>(`SELECT id FROM ${C}.${table}`);
  return new Set(rows.map((row) => String(row.id)));
}

function readSchemaVersion(userDb: SQLiteDatabase): number {
  const row = userDb.getFirstSync<{ maxVersion: number | null }>(
    'SELECT MAX(version) AS maxVersion FROM schema_migrations',
  );
  return row?.maxVersion ?? 0;
}

/** Every item ref the bundle keys a row by, including AI session topics. */
function collectItemRefs(data: BackupData): ItemRef[] {
  const refs: ItemRef[] = [
    ...data.itemStudyStatus.map((row) => row.item),
    ...data.srsStates.map((row) => row.item),
    ...data.personalMnemonics.map((row) => row.item),
    ...data.relatedItemBoosts.map((row) => row.item),
    ...data.weaknessStats.map((row) => row.item),
    ...data.userSynonyms.map((row) => row.item),
    ...data.furiganaOverrides.map((row) => row.item),
    ...data.grammarAnswers.map((row) => row.item),
    ...data.grammarSentenceHistory.map((row) => row.item),
  ];
  for (const session of data.aiSessions) {
    if (session.topicItem) refs.push(session.topicItem);
    refs.push(...(session.topicItems ?? []));
  }
  return refs;
}

function findUnmatchedSlugs(data: BackupData, refToId: ReadonlyMap<string, number>): string[] {
  const unmatched = new Set<string>();
  for (const ref of collectItemRefs(data)) {
    if (resolveItemRefToId(refToId, ref) === null) {
      unmatched.add(itemRefKey(ref));
    }
  }
  return Array.from(unmatched);
}

function countUnmatchedPassageRows(
  data: BackupData,
  passageIds: ReadonlySet<string>,
  questionIds: ReadonlySet<string>,
): number {
  return data.passagePracticeResults.filter(
    (row) => !passageIds.has(row.passageId) || !questionIds.has(row.questionId),
  ).length;
}

function countRows(data: BackupData): number {
  return BACKUP_DATA_KEYS.reduce((total, key) => total + data[key].length, 0);
}

/**
 * Reads and parses a backup file and counts what a restore would do, against
 * the curriculum currently installed on this device. Writes nothing (AC1).
 */
export async function previewRestore(
  userDb: SQLiteDatabase,
  fileUri: string,
): Promise<Result<BackupPreview, AppError>> {
  let base64: string;
  try {
    base64 = await readBackupFile(fileUri);
  } catch (cause) {
    return failure(
      'BACKUP_READ_FAILED',
      cause instanceof Error ? cause.message : String(cause),
      READ_FAILED_USER_MESSAGE,
      cause,
    );
  }

  let json: string;
  try {
    json = pako.ungzip(base64ToBytes(base64), { to: 'string' });
  } catch (cause) {
    return failure(
      'BACKUP_INVALID_GZIP',
      cause instanceof Error ? cause.message : String(cause),
      INVALID_GZIP_USER_MESSAGE,
      cause,
    );
  }

  const parsed = parseBackupBundle(json);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        ...parsed.error,
        userMessage: parsed.error.userMessage ?? 'This backup file cannot be restored.',
      },
    };
  }

  const validated = validateBackupData(parsed.value.data);
  if (!validated.ok) {
    return validated;
  }

  const bundle = parsed.value;

  try {
    const currentSchemaVersion = readSchemaVersion(userDb);
    if (bundle.schemaVersion > currentSchemaVersion) {
      return failure(
        'BACKUP_SCHEMA_TOO_NEW',
        `Backup schemaVersion ${bundle.schemaVersion} is newer than ${currentSchemaVersion}`,
        SCHEMA_TOO_NEW_USER_MESSAGE,
      );
    }

    const refToId = readCurriculumItemRefToIdMap(userDb);
    const unmatchedSlugs = findUnmatchedSlugs(bundle.data, refToId);
    const unmatchedPassageCount = countUnmatchedPassageRows(
      bundle.data,
      readCurriculumIdSet(userDb, 'reading_passages'),
      readCurriculumIdSet(userDb, 'passage_questions'),
    );

    return {
      ok: true,
      value: {
        bundle,
        unmatchedSlugs,
        summary: {
          itemCount: countRows(bundle.data),
          unmatchedSlugCount: unmatchedSlugs.length,
          unmatchedPassageCount,
          includesConversations: bundle.includesConversations,
          exportedAt: bundle.exportedAt,
          curriculumVersion: bundle.curriculumVersion,
          schemaVersion: bundle.schemaVersion,
        },
      },
    };
  } catch (cause) {
    return failure(
      'BACKUP_RESTORE_FAILED',
      cause instanceof Error ? cause.message : String(cause),
      RESTORE_FAILED_USER_MESSAGE,
      cause,
    );
  }
}

type RowValues = readonly (string | number | null)[];

/** Returns how many rows were actually written, for an honest restore count. */
function insertRows(
  userDb: SQLiteDatabase,
  table: string,
  columns: readonly string[],
  rows: readonly RowValues[],
): number {
  if (rows.length === 0) return 0;
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns
    .map(() => '?')
    .join(', ')})`;
  for (const values of rows) {
    userDb.runSync(sql, ...values);
  }
  return rows.length;
}

/**
 * Inverse of `exportBackup`'s `rewriteSummaryJson`: turn `wordsMet[].item`
 * slug refs back into this device's `itemId`s. Words whose slug is gone lose
 * the id but keep their surface text.
 */
function restoreSummaryJson(raw: string | null, refToId: ReadonlyMap<string, number>): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return raw;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.wordsMet)) return raw;

    const wordsMet = record.wordsMet.map((word) => {
      if (!word || typeof word !== 'object') return word;
      const entry = { ...(word as Record<string, unknown>) };
      const ref = entry.item as ItemRef | undefined;
      if (!ref) return word;
      delete entry.item;
      const itemId = resolveItemRefToId(refToId, ref);
      return itemId === null ? entry : { ...entry, itemId: String(itemId) };
    });

    return JSON.stringify({ ...record, wordsMet });
  } catch {
    return raw;
  }
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

/** Rows whose item slug still exists here, paired with this device's item id. */
function resolvedRows<TRow extends { item: ItemRef }>(
  rows: readonly TRow[],
  refToId: ReadonlyMap<string, number>,
): { row: TRow; itemId: number }[] {
  const resolved: { row: TRow; itemId: number }[] = [];
  for (const row of rows) {
    const itemId = resolveItemRefToId(refToId, row.item);
    // Unmatched slugs were counted at preview time — skipping here is the
    // inverse of export's orphan skip, never a raw-id fallback (AC3).
    if (itemId !== null) resolved.push({ row, itemId });
  }
  return resolved;
}

function writeRestore(
  userDb: SQLiteDatabase,
  bundle: BackupBundle,
  origin: RestoreOrigin,
): RestoreBackupResult {
  const data = bundle.data;

  // Re-resolve inside the transaction: the curriculum may have been swapped by
  // an OTA update between preview and confirm, so preview-time ids are stale.
  const refToId = readCurriculumItemRefToIdMap(userDb);
  const passageIds = readCurriculumIdSet(userDb, 'reading_passages');
  const questionIds = readCurriculumIdSet(userDb, 'passage_questions');

  const preserved = preservedPreferenceKeys().map((key) => ({
    key,
    value: userDb.getFirstSync<{ value: string }>(
      'SELECT value FROM user_preferences WHERE key = ?',
      key,
    )?.value ?? null,
  }));

  for (const table of RESTORE_TABLES) {
    userDb.runSync(`DELETE FROM ${table}`);
  }

  let writtenRows = 0;

  writtenRows += insertRows(
    userDb,
    'user_preferences',
    ['key', 'value', 'updated_at'],
    data.userPreferences.map((row) => [row.key, row.value, row.updatedAt]),
  );

  writtenRows += insertRows(
    userDb,
    'item_study_status',
    ['item_id', 'status', 'updated_at'],
    resolvedRows(data.itemStudyStatus, refToId).map(({ row, itemId }) => [
      itemId,
      row.status,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'srs_states',
    [
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
    resolvedRows(data.srsStates, refToId).map(({ row, itemId }) => [
      itemId,
      row.stability,
      row.difficulty,
      row.dueDate,
      row.fsrsState,
      row.reps,
      row.lapses,
      row.learningSteps,
      boolToInt(row.isBurned),
      row.srsStageLabel,
      row.lastReviewedAt,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'import_metadata',
    ['source', 'imported_at', 'mapped_count', 'unmatched_count'],
    data.importMetadata.map((row) => [
      row.source,
      row.importedAt,
      row.mappedCount,
      row.unmatchedCount,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'personal_mnemonics',
    ['item_id', 'mnemonic_text', 'updated_at'],
    resolvedRows(data.personalMnemonics, refToId).map(({ row, itemId }) => [
      itemId,
      row.mnemonicText,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'related_item_boosts',
    ['item_id', 'boost', 'updated_at'],
    resolvedRows(data.relatedItemBoosts, refToId).map(({ row, itemId }) => [
      itemId,
      row.boost,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'weakness_stats',
    [
      'item_id',
      'correct_count',
      'incorrect_count',
      'typo_count',
      'last_error_at',
      'last_error_type',
      'pattern_tags',
      'updated_at',
    ],
    resolvedRows(data.weaknessStats, refToId).map(({ row, itemId }) => [
      itemId,
      row.correctCount,
      row.incorrectCount,
      row.typoCount,
      row.lastErrorAt,
      row.lastErrorType,
      row.patternTags,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'cognitive_load_history',
    ['date', 'load', 'threshold', 'updated_at'],
    data.cognitiveLoadHistory.map((row) => [row.date, row.load, row.threshold, row.updatedAt]),
  );

  // Single-row tables with CHECK(id = 1): the id is not in the JSON, so supply
  // it, and never write a second row.
  writtenRows += insertRows(
    userDb,
    'streaks',
    [
      'id',
      'current_streak',
      'longest_streak',
      'last_review_date',
      'last_celebrated_date',
      'updated_at',
    ],
    data.streaks.slice(0, 1).map((row) => [
      1,
      row.currentStreak,
      row.longestStreak,
      row.lastReviewDate,
      row.lastCelebratedDate,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'user_synonyms',
    ['item_id', 'answer_type', 'answer_text', 'created_at'],
    resolvedRows(data.userSynonyms, refToId).map(({ row, itemId }) => [
      itemId,
      row.answerType,
      row.answerText,
      row.createdAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'daily_lesson_log',
    ['date', 'items_started'],
    data.dailyLessonLog.map((row) => [row.date, row.itemsStarted]),
  );

  writtenRows += insertRows(
    userDb,
    'goal_ring_state',
    [
      'id',
      'daily_goal_target',
      'goal_week_start',
      'consecutive_miss_weeks',
      'pending_rise_to',
      'pending_reduction_to',
      'updated_at',
    ],
    data.goalRingState.slice(0, 1).map((row) => [
      1,
      row.dailyGoalTarget,
      row.goalWeekStart,
      row.consecutiveMissWeeks,
      row.pendingRiseTo,
      row.pendingReductionTo,
      row.updatedAt,
    ]),
  );

  // `furigana_overrides.item_id` is TEXT (016), unlike every other item table.
  writtenRows += insertRows(
    userDb,
    'furigana_overrides',
    ['item_id', 'display_mode', 'updated_at'],
    resolvedRows(data.furiganaOverrides, refToId).map(({ row, itemId }) => [
      String(itemId),
      row.displayMode,
      row.updatedAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'card_seen',
    ['card_id', 'seen_at'],
    data.cardSeen.map((row) => [row.cardId, row.seenAt]),
  );

  // v1 keeps raw passage/question ids (no slug column on those curriculum
  // tables), so rows pointing at content this device does not have are skipped
  // and counted rather than blocking the whole restore.
  const passageRows = data.passagePracticeResults.filter(
    (row) => passageIds.has(row.passageId) && questionIds.has(row.questionId),
  );
  writtenRows += insertRows(
    userDb,
    'passage_practice_results',
    ['passage_id', 'question_id', 'is_correct', 'user_answer', 'answered_at'],
    passageRows.map((row) => [
      Number(row.passageId),
      Number(row.questionId),
      boolToInt(row.isCorrect),
      row.userAnswer,
      row.answeredAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'user_grammar_answers',
    ['item_id', 'sentence_key', 'answer_text', 'created_at'],
    resolvedRows(data.grammarAnswers, refToId).map(({ row, itemId }) => [
      itemId,
      row.sentenceKey,
      row.answerText,
      row.createdAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'grammar_sentence_history',
    ['item_id', 'sentence_keys', 'updated_at'],
    resolvedRows(data.grammarSentenceHistory, refToId).map(({ row, itemId }) => [
      itemId,
      JSON.stringify(row.sentenceKeys),
      row.updatedAt,
    ]),
  );

  // Sessions before messages: ai_messages.session_id is an FK with CASCADE.
  writtenRows += insertRows(
    userDb,
    'ai_sessions',
    [
      'id',
      'provider',
      'model',
      'mode',
      'topic_item_id',
      'topic_item_ids',
      'started_at',
      'ended_at',
      'ended_reason',
      'turn_count',
      'summary_json',
      'summary_generated_at',
    ],
    data.aiSessions.map((row) => {
      const topicItemId = row.topicItem ? resolveItemRefToId(refToId, row.topicItem) : null;
      const topicItemIds = (row.topicItems ?? [])
        .map((ref) => resolveItemRefToId(refToId, ref))
        .filter((id): id is number => id !== null)
        .map(String);
      return [
        row.id,
        row.provider,
        row.model,
        row.mode,
        // `topic_item_id` is TEXT (017), like `topic_item_ids`' entries.
        topicItemId === null ? null : String(topicItemId),
        topicItemIds.length > 0 ? JSON.stringify(topicItemIds) : null,
        row.startedAt,
        row.endedAt,
        row.endedReason,
        row.turnCount,
        restoreSummaryJson(row.summaryJson, refToId),
        row.summaryGeneratedAt,
      ];
    }),
  );

  const sessionIds = new Set(data.aiSessions.map((session) => session.id));
  writtenRows += insertRows(
    userDb,
    'ai_messages',
    ['id', 'session_id', 'role', 'content', 'created_at'],
    data.aiMessages
      .filter((row) => sessionIds.has(row.sessionId))
      .map((row) => [row.id, row.sessionId, row.role, row.content, row.createdAt]),
  );

  for (const { key, value } of preserved) {
    if (value !== null) {
      setPreference(userDb, key, value);
    } else {
      clearPreference(userDb, key);
    }
  }

  // A freshly restored device is not "Never backed up" — it is as backed up as
  // the file it came from.
  setPreference(userDb, PREFERENCE_KEYS.lastBackedUpAt, bundle.exportedAt);

  if (origin === 'onboarding') {
    // A backup from a finished device carries onboarding_completed = true, and
    // useOnboardingRedirect would then bounce the learner off /onboarding/complete
    // straight to Home (AC8).
    clearPreference(userDb, PREFERENCE_KEYS.onboardingCompleted);
    setOnboardingPath(userDb, 'import');
  }

  return {
    restoredRowCount: writtenRows,
    unmatchedSlugCount: findUnmatchedSlugs(data, refToId).length,
    unmatchedPassageCount: countUnmatchedPassageRows(data, passageIds, questionIds),
  };
}

/**
 * Replace-all restore: every user table is emptied and rewritten from the
 * bundle inside one transaction (AC2). Merging two FSRS histories has no
 * correct answer, so this never merges. `curriculum.db`, `schema_migrations`
 * and secure storage are untouched.
 */
export function restoreBackup(
  userDb: SQLiteDatabase,
  preview: BackupPreview,
  origin: RestoreOrigin,
): Result<RestoreBackupResult, AppError> {
  try {
    let result: RestoreBackupResult | undefined;
    userDb.withTransactionSync(() => {
      result = writeRestore(userDb, preview.bundle, origin);
    });
    if (!result) {
      return failure(
        'BACKUP_RESTORE_FAILED',
        'Restore transaction did not complete',
        RESTORE_FAILED_USER_MESSAGE,
      );
    }
    // Raw SQL does not go through the override repository, so mounted Settings
    // / lesson screens would keep a pre-restore list until they remount.
    notifyFuriganaOverridesChanged();
    return { ok: true, value: result };
  } catch (cause) {
    return failure(
      'BACKUP_RESTORE_FAILED',
      cause instanceof Error ? cause.message : String(cause),
      RESTORE_FAILED_USER_MESSAGE,
      cause,
    );
  }
}
