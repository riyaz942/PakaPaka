import { documentDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as pako from 'pako';

import { buildBackupBundle, serializeBackupBundle } from '@/core/backup/backupSerializer';
import type {
  AiMessageEntry,
  AiSessionEntry,
  BackupData,
  ItemRef,
} from '@/core/backup/backup.types';
import { buildItemIdToRefMap, resolveItemIdToRef } from '@/core/backup/slugResolver';
import { CURRICULUM_ATTACH_ALIAS } from '@/data/database';
import { setLastBackedUpAt } from '@/data/user/preferencesRepository';
import type { AppError, Result } from '@/types/result.types';

const C = CURRICULUM_ATTACH_ALIAS;

const CURRICULUM_LOOKUP_EMPTY = 'CURRICULUM_LOOKUP_EMPTY';
const EXPORT_FAILED_USER_MESSAGE = 'Could not export your backup. Please try again.';
const LOOKUP_EMPTY_USER_MESSAGE =
  'Could not match your progress to the curriculum. Try again after the content has loaded.';

export type ExportBackupOptions = {
  /** AI conversation transcripts are opt-in, off by default (AC4). */
  includeConversations?: boolean;
};

export type ExportBackupResult = {
  fileUri: string;
  itemCount: number;
  byteSize: number;
  omittedCount: number;
};

type MappedRows<TEntry> = {
  entries: TEntry[];
  omitted: number;
};

function backupFileName(exportedAt: string): string {
  return `kizamu-backup-${exportedAt.replace(/[:.]/g, '-')}.json.gz`;
}

const TEST_DOCUMENT_DIRECTORY = 'file:///mock-documents/';

/**
 * `jest-expo`'s setup stubs `expo-file-system/legacy` with stateless
 * `jest.fn()`s that shadow this project's own `__mocks__/expo-file-system.ts`
 * for this exact import path — `documentDirectory` and a working
 * `writeAsStringAsync` are unavailable under test. Same workaround as
 * `curriculumConfig.ts`'s `getDocumentDirectory` and
 * `curriculumUpdate.ts`'s `readFileAsBase64`: branch to the shared
 * `test-support/file-system-test-state` store in test mode.
 */
function resolveDocumentDirectory(): string {
  const directory = process.env.NODE_ENV === 'test' ? TEST_DOCUMENT_DIRECTORY : documentDirectory;
  if (!directory) {
    throw new Error('documentDirectory is unavailable');
  }
  return directory;
}

async function writeBackupFile(fileUri: string, base64Contents: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only file store
    const { setMockFileContents } = require('../../../test-support/file-system-test-state') as {
      setMockFileContents: (uri: string, base64Contents: string) => void;
    };
    setMockFileContents(fileUri, base64Contents);
    return;
  }
  await writeAsStringAsync(fileUri, base64Contents, { encoding: EncodingType.Base64 });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function mapItemRows<TRow, TEntry>(
  rows: TRow[],
  idToRef: ReadonlyMap<number, ItemRef>,
  getItemId: (row: TRow) => number | string,
  toEntry: (row: TRow, item: ItemRef) => TEntry,
): MappedRows<TEntry> {
  const entries: TEntry[] = [];
  let omitted = 0;
  for (const row of rows) {
    const ref = resolveItemIdToRef(idToRef, getItemId(row));
    // Orphaned item_id (curriculum item removed by an OTA update since the row
    // was written) has no slug to key by — skip rather than fall back to the
    // raw id, which is exactly what AC1 forbids. Caller surfaces omittedCount.
    if (ref) {
      entries.push(toEntry(row, ref));
    } else {
      omitted += 1;
    }
  }
  return { entries, omitted };
}

function readCurriculumItemIdToRefMap(userDb: SQLiteDatabase): Map<number, ItemRef> {
  const rows = userDb.getAllSync<{ id: number | string; item_type: ItemRef['itemType']; slug: string }>(
    `SELECT id, item_type, slug FROM ${C}.items`,
  );
  return buildItemIdToRefMap(
    rows.map((row) => ({ id: row.id, itemType: row.item_type, slug: row.slug })),
  );
}

function readCurriculumVersion(userDb: SQLiteDatabase): string | null {
  const row = userDb.getFirstSync<{ version: string }>(
    `SELECT version FROM ${C}.curriculum_metadata LIMIT 1`,
  );
  return row?.version ?? null;
}

function readSchemaVersion(userDb: SQLiteDatabase): number {
  const row = userDb.getFirstSync<{ maxVersion: number | null }>(
    'SELECT MAX(version) AS maxVersion FROM schema_migrations',
  );
  return row?.maxVersion ?? 0;
}

function readUserPreferences(userDb: SQLiteDatabase): BackupData['userPreferences'] {
  return userDb.getAllSync<{ key: string; value: string; updated_at: string }>(
    'SELECT key, value, updated_at FROM user_preferences',
  ).map((row) => ({ key: row.key, value: row.value, updatedAt: row.updated_at }));
}

function readItemStudyStatus(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['itemStudyStatus'][number]> {
  const rows = userDb.getAllSync<{ item_id: number | string; status: string; updated_at: string }>(
    'SELECT item_id, status, updated_at FROM item_study_status',
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    status: row.status as BackupData['itemStudyStatus'][number]['status'],
    updatedAt: row.updated_at,
  }));
}

function readSrsStates(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['srsStates'][number]> {
  const rows = userDb.getAllSync<{
    item_id: number | string;
    stability: number;
    difficulty: number;
    due_date: string;
    fsrs_state: string;
    reps: number;
    lapses: number;
    learning_steps: number;
    is_burned: number;
    srs_stage_label: string;
    last_reviewed_at: string | null;
    updated_at: string;
  }>(
    `SELECT item_id, stability, difficulty, due_date, fsrs_state, reps, lapses,
            learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at
     FROM srs_states`,
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    stability: row.stability,
    difficulty: row.difficulty,
    dueDate: row.due_date,
    fsrsState: row.fsrs_state as BackupData['srsStates'][number]['fsrsState'],
    reps: row.reps,
    lapses: row.lapses,
    learningSteps: row.learning_steps,
    isBurned: row.is_burned === 1,
    srsStageLabel: row.srs_stage_label,
    lastReviewedAt: row.last_reviewed_at,
    updatedAt: row.updated_at,
  }));
}

function readImportMetadata(userDb: SQLiteDatabase): BackupData['importMetadata'] {
  return userDb.getAllSync<{
    source: string;
    imported_at: string;
    mapped_count: number;
    unmatched_count: number;
  }>('SELECT source, imported_at, mapped_count, unmatched_count FROM import_metadata').map(
    (row) => ({
      source: row.source as BackupData['importMetadata'][number]['source'],
      importedAt: row.imported_at,
      mappedCount: row.mapped_count,
      unmatchedCount: row.unmatched_count,
    }),
  );
}

function readPersonalMnemonics(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['personalMnemonics'][number]> {
  const rows = userDb.getAllSync<{ item_id: number | string; mnemonic_text: string; updated_at: string }>(
    'SELECT item_id, mnemonic_text, updated_at FROM personal_mnemonics',
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    mnemonicText: row.mnemonic_text,
    updatedAt: row.updated_at,
  }));
}

function readRelatedItemBoosts(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['relatedItemBoosts'][number]> {
  const rows = userDb.getAllSync<{ item_id: number | string; boost: number; updated_at: string }>(
    'SELECT item_id, boost, updated_at FROM related_item_boosts',
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    boost: row.boost,
    updatedAt: row.updated_at,
  }));
}

function readWeaknessStats(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['weaknessStats'][number]> {
  const rows = userDb.getAllSync<{
    item_id: number | string;
    correct_count: number;
    incorrect_count: number;
    typo_count: number;
    last_error_at: string | null;
    last_error_type: string | null;
    pattern_tags: string | null;
    updated_at: string;
  }>(
    `SELECT item_id, correct_count, incorrect_count, typo_count, last_error_at, last_error_type,
            pattern_tags, updated_at
     FROM weakness_stats`,
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    typoCount: row.typo_count,
    lastErrorAt: row.last_error_at,
    lastErrorType: row.last_error_type,
    patternTags: row.pattern_tags,
    updatedAt: row.updated_at,
  }));
}

function readCognitiveLoadHistory(userDb: SQLiteDatabase): BackupData['cognitiveLoadHistory'] {
  return userDb.getAllSync<{ date: string; load: number; threshold: number; updated_at: string }>(
    'SELECT date, load, threshold, updated_at FROM cognitive_load_history',
  ).map((row) => ({
    date: row.date,
    load: row.load,
    threshold: row.threshold,
    updatedAt: row.updated_at,
  }));
}

function readStreaks(userDb: SQLiteDatabase): BackupData['streaks'] {
  return userDb.getAllSync<{
    current_streak: number;
    longest_streak: number;
    last_review_date: string | null;
    last_celebrated_date: string | null;
    updated_at: string;
  }>(
    'SELECT current_streak, longest_streak, last_review_date, last_celebrated_date, updated_at FROM streaks',
  ).map((row) => ({
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastReviewDate: row.last_review_date,
    lastCelebratedDate: row.last_celebrated_date,
    updatedAt: row.updated_at,
  }));
}

function readUserSynonyms(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['userSynonyms'][number]> {
  const rows = userDb.getAllSync<{
    item_id: number | string;
    answer_type: string;
    answer_text: string;
    created_at: string;
  }>('SELECT item_id, answer_type, answer_text, created_at FROM user_synonyms');
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    answerType: row.answer_type as BackupData['userSynonyms'][number]['answerType'],
    answerText: row.answer_text,
    createdAt: row.created_at,
  }));
}

function readDailyLessonLog(userDb: SQLiteDatabase): BackupData['dailyLessonLog'] {
  return userDb.getAllSync<{ date: string; items_started: number }>(
    'SELECT date, items_started FROM daily_lesson_log',
  ).map((row) => ({ date: row.date, itemsStarted: row.items_started }));
}

function readGoalRingState(userDb: SQLiteDatabase): BackupData['goalRingState'] {
  return userDb.getAllSync<{
    daily_goal_target: number | null;
    goal_week_start: string | null;
    consecutive_miss_weeks: number;
    pending_rise_to: number | null;
    pending_reduction_to: number | null;
    updated_at: string;
  }>(
    `SELECT daily_goal_target, goal_week_start, consecutive_miss_weeks, pending_rise_to,
            pending_reduction_to, updated_at
     FROM goal_ring_state`,
  ).map((row) => ({
    dailyGoalTarget: row.daily_goal_target,
    goalWeekStart: row.goal_week_start,
    consecutiveMissWeeks: row.consecutive_miss_weeks,
    pendingRiseTo: row.pending_rise_to,
    pendingReductionTo: row.pending_reduction_to,
    updatedAt: row.updated_at,
  }));
}

function readFuriganaOverrides(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['furiganaOverrides'][number]> {
  const rows = userDb.getAllSync<{ item_id: string; display_mode: string; updated_at: string }>(
    'SELECT item_id, display_mode, updated_at FROM furigana_overrides',
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    displayMode: row.display_mode as BackupData['furiganaOverrides'][number]['displayMode'],
    updatedAt: row.updated_at,
  }));
}

function readCardSeen(userDb: SQLiteDatabase): BackupData['cardSeen'] {
  return userDb.getAllSync<{ card_id: string; seen_at: string }>(
    'SELECT card_id, seen_at FROM card_seen',
  ).map((row) => ({ cardId: row.card_id, seenAt: row.seen_at }));
}

function readPassagePracticeResults(
  userDb: SQLiteDatabase,
): BackupData['passagePracticeResults'] {
  return userDb.getAllSync<{
    passage_id: number;
    question_id: number;
    is_correct: number;
    user_answer: string;
    answered_at: string;
  }>(
    'SELECT passage_id, question_id, is_correct, user_answer, answered_at FROM passage_practice_results',
  ).map((row) => ({
    passageId: String(row.passage_id),
    questionId: String(row.question_id),
    isCorrect: row.is_correct === 1,
    userAnswer: row.user_answer,
    answeredAt: row.answered_at,
  }));
}

/**
 * Matches `aiSessionRepository.parseTopicItemIds`: a corrupt or pre-018
 * `topic_item_ids` value degrades to the single `topic_item_id`.
 */
function parseTopicItemIds(json: string | null, fallback: string | null): number[] {
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (Array.isArray(parsed)) {
        const ids = parsed
          .filter((entry): entry is string => typeof entry === 'string')
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0);
        if (ids.length > 0) return ids;
      }
    } catch {
      // Fall through to the single-id form below.
    }
  }
  if (!fallback) return [];
  const fallbackId = Number(fallback);
  return Number.isFinite(fallbackId) && fallbackId > 0 ? [fallbackId] : [];
}

/**
 * Rewrite `wordsMet[].itemId` (live curriculum row ids) to slug refs so an
 * opt-in conversation backup stays AC1-safe. Unresolvable ids are dropped;
 * the surface `text` is kept. Parse failure leaves the blob unchanged.
 */
function rewriteSummaryJson(
  raw: string | null,
  idToRef: ReadonlyMap<number, ItemRef>,
): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return raw;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.wordsMet)) return raw;

    const wordsMet = record.wordsMet.map((word) => {
      if (!word || typeof word !== 'object') return word;
      const entry = { ...(word as Record<string, unknown>) };
      if (entry.itemId == null) return word;
      const ref = resolveItemIdToRef(idToRef, String(entry.itemId));
      delete entry.itemId;
      return ref ? { ...entry, item: ref } : entry;
    });

    return JSON.stringify({ ...record, wordsMet });
  } catch {
    return raw;
  }
}

function readAiSessions(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): AiSessionEntry[] {
  const rows = userDb.getAllSync<{
    id: string;
    provider: string;
    model: string;
    mode: string;
    topic_item_id: string | null;
    topic_item_ids: string | null;
    started_at: string;
    ended_at: string | null;
    ended_reason: string | null;
    turn_count: number;
    summary_json: string | null;
    summary_generated_at: string | null;
  }>(
    `SELECT id, provider, model, mode, topic_item_id, topic_item_ids, started_at, ended_at,
            ended_reason, turn_count, summary_json, summary_generated_at
     FROM ai_sessions`,
  );

  return rows.map((row) => {
    const topicItem = row.topic_item_id
      ? resolveItemIdToRef(idToRef, row.topic_item_id)
      : null;
    const topicItems = parseTopicItemIds(row.topic_item_ids, row.topic_item_id)
      .map((id) => resolveItemIdToRef(idToRef, id))
      .filter((ref): ref is ItemRef => ref !== null);

    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      mode: row.mode,
      topicItem,
      topicItems,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      endedReason: row.ended_reason,
      turnCount: row.turn_count,
      summaryJson: rewriteSummaryJson(row.summary_json, idToRef),
      summaryGeneratedAt: row.summary_generated_at,
    };
  });
}

function readAiMessages(userDb: SQLiteDatabase): AiMessageEntry[] {
  return userDb.getAllSync<{
    id: string;
    session_id: string;
    role: string;
    content: string;
    created_at: string;
  }>('SELECT id, session_id, role, content, created_at FROM ai_messages').map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    createdAt: row.created_at,
  }));
}

function countBackupItems(data: BackupData): number {
  return Object.values(data).reduce((total, table) => total + table.length, 0);
}

function exportFailed(message: string, userMessage: string, cause?: unknown): Result<ExportBackupResult, AppError> {
  return {
    ok: false,
    error: {
      code: 'BACKUP_EXPORT_FAILED',
      message,
      userMessage,
      cause,
    },
  };
}

type Snapshot = {
  data: BackupData;
  omittedCount: number;
  schemaVersion: number;
  curriculumVersion: string | null;
};

function readExportSnapshot(
  userDb: SQLiteDatabase,
  includeConversations: boolean,
): Snapshot {
  const idToRef = readCurriculumItemIdToRefMap(userDb);

  const itemStudyStatus = readItemStudyStatus(userDb, idToRef);
  const srsStates = readSrsStates(userDb, idToRef);
  const personalMnemonics = readPersonalMnemonics(userDb, idToRef);
  const relatedItemBoosts = readRelatedItemBoosts(userDb, idToRef);
  const weaknessStats = readWeaknessStats(userDb, idToRef);
  const userSynonyms = readUserSynonyms(userDb, idToRef);
  const furiganaOverrides = readFuriganaOverrides(userDb, idToRef);

  const omittedCount =
    itemStudyStatus.omitted +
    srsStates.omitted +
    personalMnemonics.omitted +
    relatedItemBoosts.omitted +
    weaknessStats.omitted +
    userSynonyms.omitted +
    furiganaOverrides.omitted;

  if (idToRef.size === 0 && omittedCount > 0) {
    throw new Error(CURRICULUM_LOOKUP_EMPTY);
  }

  return {
    omittedCount,
    schemaVersion: readSchemaVersion(userDb),
    curriculumVersion: readCurriculumVersion(userDb),
    data: {
      userPreferences: readUserPreferences(userDb),
      itemStudyStatus: itemStudyStatus.entries,
      srsStates: srsStates.entries,
      importMetadata: readImportMetadata(userDb),
      personalMnemonics: personalMnemonics.entries,
      relatedItemBoosts: relatedItemBoosts.entries,
      weaknessStats: weaknessStats.entries,
      cognitiveLoadHistory: readCognitiveLoadHistory(userDb),
      streaks: readStreaks(userDb),
      userSynonyms: userSynonyms.entries,
      dailyLessonLog: readDailyLessonLog(userDb),
      goalRingState: readGoalRingState(userDb),
      furiganaOverrides: furiganaOverrides.entries,
      cardSeen: readCardSeen(userDb),
      passagePracticeResults: readPassagePracticeResults(userDb),
      aiSessions: includeConversations ? readAiSessions(userDb, idToRef) : [],
      aiMessages: includeConversations ? readAiMessages(userDb) : [],
    },
  };
}

/**
 * Reads every user-progress table (never `curriculum.db`, never secure
 * storage — BYOK credentials are excluded by construction, not filtering),
 * resolves item ids to `{item_type, slug}` refs, gzips the JSON envelope and
 * writes it to `.json.gz` in the app's document directory (AC1–AC6).
 */
export async function exportBackup(
  userDb: SQLiteDatabase,
  options: ExportBackupOptions = {},
): Promise<Result<ExportBackupResult, AppError>> {
  const includeConversations = options.includeConversations ?? false;

  try {
    let snapshot: Snapshot | undefined;
    userDb.withTransactionSync(() => {
      snapshot = readExportSnapshot(userDb, includeConversations);
    });
    if (!snapshot) {
      return exportFailed('Export snapshot was not captured', EXPORT_FAILED_USER_MESSAGE);
    }

    const exportedAt = new Date().toISOString();
    const bundle = buildBackupBundle(
      {
        schemaVersion: snapshot.schemaVersion,
        curriculumVersion: snapshot.curriculumVersion,
        exportedAt,
        includesConversations: includeConversations,
      },
      snapshot.data,
    );

    const json = serializeBackupBundle(bundle);
    const gzipped = pako.gzip(json);
    const base64 = bytesToBase64(gzipped);

    const fileUri = `${resolveDocumentDirectory()}${backupFileName(exportedAt)}`;
    await writeBackupFile(fileUri, base64);

    // The nudge timestamp follows the file write, not the share sheet — a
    // cancelled share is still a backup on this device (9.1 precedent).
    setLastBackedUpAt(userDb, exportedAt);

    return {
      ok: true,
      value: {
        fileUri,
        itemCount: countBackupItems(snapshot.data),
        byteSize: gzipped.byteLength,
        omittedCount: snapshot.omittedCount,
      },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message === CURRICULUM_LOOKUP_EMPTY) {
      return exportFailed(message, LOOKUP_EMPTY_USER_MESSAGE, cause);
    }
    return exportFailed(message, EXPORT_FAILED_USER_MESSAGE, cause);
  }
}
