import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import {
  buildItemIdToRefMap,
  buildItemRefToIdMap,
  itemRefKey,
  resolveItemIdToRef,
} from '@/core/backup/slugResolver';
import type { KnownContent } from '@/core/sync/sync.types';
import { toSyncData } from '@/core/sync/syncFile';
import { syncError } from '@/core/sync/syncMessages';
import { CURRICULUM_ATTACH_ALIAS } from '@/data/database';
import type { SyncSql } from '@/data/sync/syncTransaction';
import type { AppError, Result } from '@/types/result.types';

const C = CURRICULUM_ATTACH_ALIAS;

export type CurriculumLookup = {
  idToRef: Map<number, ItemRef>;
  refToId: Map<string, number>;
  known: KnownContent;
  curriculumVersion: string | null;
};

export type SyncSnapshot = {
  data: BackupData;
  schemaVersion: number;
  lookup: CurriculumLookup;
};

type Entry<K extends keyof BackupData> = BackupData[K][number];

async function readIdSet(userDb: SQLiteDatabase, table: string): Promise<Set<string>> {
  const rows = await userDb.getAllAsync<{ id: number | string }>(`SELECT id FROM ${C}.${table}`);
  return new Set(rows.map((row) => String(row.id)));
}

/**
 * This device's curriculum, read through the `curriculum` ATTACH on the main handle. A native
 * transaction connection has no ATTACH, so call this before `withSyncTransaction`.
 */
export async function readCurriculumLookup(userDb: SQLiteDatabase): Promise<CurriculumLookup> {
  const items = (
    await userDb.getAllAsync<{ id: number | string; item_type: ItemRef['itemType']; slug: string }>(
      `SELECT id, item_type, slug FROM ${C}.items`,
    )
  ).map((row) => ({ id: row.id, itemType: row.item_type, slug: row.slug }));
  const passageIds = await readIdSet(userDb, 'reading_passages');
  const questionIds = await readIdSet(userDb, 'passage_questions');
  const metadata = await userDb.getFirstAsync<{ version: string }>(
    `SELECT version FROM ${C}.curriculum_metadata LIMIT 1`,
  );

  const refToId = buildItemRefToIdMap(items);
  return {
    idToRef: buildItemIdToRefMap(items),
    refToId,
    // Raw passage / question ids, as the backup format stores them (same check as restore).
    known: {
      hasItem: (ref) => refToId.has(itemRefKey(ref)),
      hasPassageQuestion: (passageId, questionId) =>
        passageIds.has(passageId) && questionIds.has(questionId),
    },
    curriculumVersion: metadata?.version ?? null,
  };
}

/** Rows whose item is in this curriculum, keyed by slug; the rest are left out. */
function knownItemRows<TRow extends { item_id: number | string }, TEntry>(
  rows: TRow[],
  idToRef: ReadonlyMap<number, ItemRef>,
  toEntry: (row: TRow, item: ItemRef) => TEntry,
): TEntry[] {
  const entries: TEntry[] = [];
  for (const row of rows) {
    const item = resolveItemIdToRef(idToRef, row.item_id);
    if (item) entries.push(toEntry(row, item));
  }
  return entries;
}

/**
 * Every sync table as the sync file holds it (the columns `exportBackup` reads). Rows for items
 * this curriculum lacks and never-synced preferences are left out.
 */
export async function readUserTables(sql: SyncSql, lookup: CurriculumLookup): Promise<BackupData> {
  const { idToRef } = lookup;

  const userPreferences = (
    await sql.getAllAsync<{ key: string; value: string; updated_at: string }>(
      'SELECT key, value, updated_at FROM user_preferences',
    )
  ).map((row): Entry<'userPreferences'> => ({ key: row.key, value: row.value, updatedAt: row.updated_at }));

  const itemStudyStatus = knownItemRows(
    await sql.getAllAsync<{ item_id: number; status: string; updated_at: string }>(
      'SELECT item_id, status, updated_at FROM item_study_status',
    ),
    idToRef,
    (row, item): Entry<'itemStudyStatus'> => ({
      item,
      status: row.status as Entry<'itemStudyStatus'>['status'],
      updatedAt: row.updated_at,
    }),
  );

  const srsStates = knownItemRows(
    await sql.getAllAsync<{
      item_id: number;
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
    ),
    idToRef,
    (row, item): Entry<'srsStates'> => ({
      item,
      stability: row.stability,
      difficulty: row.difficulty,
      dueDate: row.due_date,
      fsrsState: row.fsrs_state as Entry<'srsStates'>['fsrsState'],
      reps: row.reps,
      lapses: row.lapses,
      learningSteps: row.learning_steps,
      isBurned: row.is_burned === 1,
      srsStageLabel: row.srs_stage_label,
      lastReviewedAt: row.last_reviewed_at,
      updatedAt: row.updated_at,
    }),
  );

  const importMetadata = (
    await sql.getAllAsync<{
      source: string;
      imported_at: string;
      mapped_count: number;
      unmatched_count: number;
    }>('SELECT source, imported_at, mapped_count, unmatched_count FROM import_metadata')
  ).map(
    (row): Entry<'importMetadata'> => ({
      source: row.source as Entry<'importMetadata'>['source'],
      importedAt: row.imported_at,
      mappedCount: row.mapped_count,
      unmatchedCount: row.unmatched_count,
    }),
  );

  const personalMnemonics = knownItemRows(
    await sql.getAllAsync<{ item_id: number; mnemonic_text: string; updated_at: string }>(
      'SELECT item_id, mnemonic_text, updated_at FROM personal_mnemonics',
    ),
    idToRef,
    (row, item): Entry<'personalMnemonics'> => ({
      item,
      mnemonicText: row.mnemonic_text,
      updatedAt: row.updated_at,
    }),
  );

  const relatedItemBoosts = knownItemRows(
    await sql.getAllAsync<{ item_id: number; boost: number; updated_at: string }>(
      'SELECT item_id, boost, updated_at FROM related_item_boosts',
    ),
    idToRef,
    (row, item): Entry<'relatedItemBoosts'> => ({ item, boost: row.boost, updatedAt: row.updated_at }),
  );

  const weaknessStats = knownItemRows(
    await sql.getAllAsync<{
      item_id: number;
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
    ),
    idToRef,
    (row, item): Entry<'weaknessStats'> => ({
      item,
      correctCount: row.correct_count,
      incorrectCount: row.incorrect_count,
      typoCount: row.typo_count,
      lastErrorAt: row.last_error_at,
      lastErrorType: row.last_error_type,
      patternTags: row.pattern_tags,
      updatedAt: row.updated_at,
    }),
  );

  const cognitiveLoadHistory = (
    await sql.getAllAsync<{ date: string; load: number; threshold: number; updated_at: string }>(
      'SELECT date, load, threshold, updated_at FROM cognitive_load_history',
    )
  ).map(
    (row): Entry<'cognitiveLoadHistory'> => ({
      date: row.date,
      load: row.load,
      threshold: row.threshold,
      updatedAt: row.updated_at,
    }),
  );

  const streaks = (
    await sql.getAllAsync<{
      current_streak: number;
      longest_streak: number;
      last_review_date: string | null;
      last_celebrated_date: string | null;
      updated_at: string;
    }>(
      'SELECT current_streak, longest_streak, last_review_date, last_celebrated_date, updated_at FROM streaks',
    )
  ).map(
    (row): Entry<'streaks'> => ({
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastReviewDate: row.last_review_date,
      lastCelebratedDate: row.last_celebrated_date,
      updatedAt: row.updated_at,
    }),
  );

  const userSynonyms = knownItemRows(
    await sql.getAllAsync<{ item_id: number; answer_type: string; answer_text: string; created_at: string }>(
      'SELECT item_id, answer_type, answer_text, created_at FROM user_synonyms',
    ),
    idToRef,
    (row, item): Entry<'userSynonyms'> => ({
      item,
      answerType: row.answer_type as Entry<'userSynonyms'>['answerType'],
      answerText: row.answer_text,
      createdAt: row.created_at,
    }),
  );

  const dailyLessonLog = (
    await sql.getAllAsync<{ date: string; items_started: number }>(
      'SELECT date, items_started FROM daily_lesson_log',
    )
  ).map((row): Entry<'dailyLessonLog'> => ({ date: row.date, itemsStarted: row.items_started }));

  const goalRingState = (
    await sql.getAllAsync<{
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
    )
  ).map(
    (row): Entry<'goalRingState'> => ({
      dailyGoalTarget: row.daily_goal_target,
      goalWeekStart: row.goal_week_start,
      consecutiveMissWeeks: row.consecutive_miss_weeks,
      pendingRiseTo: row.pending_rise_to,
      pendingReductionTo: row.pending_reduction_to,
      updatedAt: row.updated_at,
    }),
  );

  // `furigana_overrides.item_id` is TEXT (016).
  const furiganaOverrides = knownItemRows(
    await sql.getAllAsync<{ item_id: string; display_mode: string; updated_at: string }>(
      'SELECT item_id, display_mode, updated_at FROM furigana_overrides',
    ),
    idToRef,
    (row, item): Entry<'furiganaOverrides'> => ({
      item,
      displayMode: row.display_mode as Entry<'furiganaOverrides'>['displayMode'],
      updatedAt: row.updated_at,
    }),
  );

  const cardSeen = (
    await sql.getAllAsync<{ card_id: string; seen_at: string }>('SELECT card_id, seen_at FROM card_seen')
  ).map((row): Entry<'cardSeen'> => ({ cardId: row.card_id, seenAt: row.seen_at }));

  const passagePracticeResults = (
    await sql.getAllAsync<{
      passage_id: number;
      question_id: number;
      is_correct: number;
      user_answer: string;
      answered_at: string;
    }>(
      'SELECT passage_id, question_id, is_correct, user_answer, answered_at FROM passage_practice_results',
    )
  ).map(
    (row): Entry<'passagePracticeResults'> => ({
      passageId: String(row.passage_id),
      questionId: String(row.question_id),
      isCorrect: row.is_correct === 1,
      userAnswer: row.user_answer,
      answeredAt: row.answered_at,
    }),
  );

  const grammarAnswers = knownItemRows(
    await sql.getAllAsync<{ item_id: number; sentence_key: string; answer_text: string; created_at: string }>(
      'SELECT item_id, sentence_key, answer_text, created_at FROM user_grammar_answers',
    ),
    idToRef,
    (row, item): Entry<'grammarAnswers'> => ({
      item,
      sentenceKey: row.sentence_key,
      answerText: row.answer_text,
      createdAt: row.created_at,
    }),
  );

  const grammarSentenceHistory = knownItemRows(
    await sql.getAllAsync<{ item_id: number; sentence_keys: string; updated_at: string }>(
      'SELECT item_id, sentence_keys, updated_at FROM grammar_sentence_history',
    ),
    idToRef,
    (row, item): Entry<'grammarSentenceHistory'> => ({
      item,
      sentenceKeys: JSON.parse(row.sentence_keys) as string[],
      updatedAt: row.updated_at,
    }),
  );

  // `lesson_opt_ins.item_id` is TEXT (020).
  const lessonOptIns = knownItemRows(
    await sql.getAllAsync<{ item_id: string; opted_in_at: string }>(
      'SELECT item_id, opted_in_at FROM lesson_opt_ins',
    ),
    idToRef,
    (row, item): Entry<'lessonOptIns'> => ({ item, optedInAt: row.opted_in_at }),
  );

  return toSyncData({
    userPreferences,
    itemStudyStatus,
    srsStates,
    importMetadata,
    personalMnemonics,
    relatedItemBoosts,
    weaknessStats,
    cognitiveLoadHistory,
    streaks,
    userSynonyms,
    dailyLessonLog,
    goalRingState,
    furiganaOverrides,
    cardSeen,
    passagePracticeResults,
    grammarAnswers,
    grammarSentenceHistory,
    lessonOptIns,
    aiSessions: [],
    aiMessages: [],
  });
}

/** This device's sync data, schema version and curriculum lookup. */
export async function readSyncSnapshot(userDb: SQLiteDatabase): Promise<Result<SyncSnapshot, AppError>> {
  try {
    const lookup = await readCurriculumLookup(userDb);
    const data = await readUserTables(userDb, lookup);
    const schema = await userDb.getFirstAsync<{ maxVersion: number | null }>(
      'SELECT MAX(version) AS maxVersion FROM schema_migrations',
    );
    return { ok: true, value: { data, schemaVersion: schema?.maxVersion ?? 0, lookup } };
  } catch (cause) {
    return { ok: false, error: syncError('sync_local_failed', cause) };
  }
}
