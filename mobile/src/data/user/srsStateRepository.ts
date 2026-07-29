import type { SQLiteDatabase } from 'expo-sqlite';

import { QUEUE_FETCH_LIMIT } from '@/config/constants';
import { createInitialSrsState } from '@/core/srs/fsrsScheduler';
import type { FsrsStateString, SRSStageLabel, SRSState } from '@/core/srs/srs.types';
import { chunkForSqlVariables } from '@/data/sqlChunk';
import { setStudyStatus } from '@/data/user/itemStudyStatusRepository';
import type { AppError, Result } from '@/types/result.types';

type SrsStateRow = {
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
};

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

function mapRowToState(row: SrsStateRow): SRSState {
  return {
    itemId: String(row.item_id),
    stability: row.stability,
    difficulty: row.difficulty,
    dueDate: row.due_date,
    fsrsState: row.fsrs_state as FsrsStateString,
    reps: row.reps,
    lapses: row.lapses,
    learningSteps: row.learning_steps ?? 0,
    isBurned: row.is_burned === 1,
    srsStageLabel: row.srs_stage_label as SRSStageLabel,
    lastReviewedAt: row.last_reviewed_at ?? null,
    updatedAt: row.updated_at,
  };
}

const SRS_STAGE_LABELS: SRSStageLabel[] = [
  'apprentice',
  'guru',
  'master',
  'enlightened',
  'burned',
];

function emptyStageCounts(): Record<SRSStageLabel, number> {
  return {
    apprentice: 0,
    guru: 0,
    master: 0,
    enlightened: 0,
    burned: 0,
  };
}

/** Inventory counts per SRS stage label (burned items included). */
export function getSrsStageCounts(userDb: SQLiteDatabase): Record<SRSStageLabel, number> {
  const counts = emptyStageCounts();

  const rows = userDb.getAllSync<{ srs_stage_label: string; count: number }>(
    `SELECT srs_stage_label, COUNT(*) AS count FROM srs_states GROUP BY srs_stage_label`,
  );

  for (const row of rows) {
    const label = row.srs_stage_label as SRSStageLabel;
    if (SRS_STAGE_LABELS.includes(label)) {
      counts[label] = row.count;
    }
  }

  return counts;
}

/** Returns SRS states with due_date <= now, excluding burned items. */
export function getDueSrsStates(
  userDb: SQLiteDatabase,
  now: Date = new Date(),
  limit: number = QUEUE_FETCH_LIMIT,
): SRSState[] {
  const rows = userDb.getAllSync<SrsStateRow>(
    `SELECT item_id, stability, difficulty, due_date, fsrs_state, reps, lapses, learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at
     FROM srs_states
     WHERE due_date <= ? AND is_burned = 0
     ORDER BY due_date ASC
     LIMIT ?`,
    now.toISOString(),
    limit,
  );
  return rows.map(mapRowToState);
}

/**
 * Uncapped due item ids (non-burned) for Home CTA / welcome-back copy (FR61).
 * Ids, not counts: Home filters them through the queue's eligibility rules
 * before showing a number (see `data/reviewEligibility.ts`).
 */
export function getDueItemIds(userDb: SQLiteDatabase, now: Date = new Date()): string[] {
  const rows = userDb.getAllSync<{ item_id: number | string }>(
    `SELECT item_id FROM srs_states
     WHERE due_date <= ? AND is_burned = 0`,
    now.toISOString(),
  );
  return rows.map((row) => String(row.item_id));
}

export type UpcomingDue = { itemId: string; dueDate: string };

/**
 * Item id + due date only (non-burned, due on or before untilIso) — cheap Home
 * forecast read that avoids materializing full SRS rows on every focus.
 * No row cap: the 7-day wall annotation needs the full window.
 */
export function getUpcomingDueItems(userDb: SQLiteDatabase, untilIso: string): UpcomingDue[] {
  const rows = userDb.getAllSync<{ item_id: number | string; due_date: string }>(
    `SELECT item_id, due_date FROM srs_states
     WHERE due_date <= ? AND is_burned = 0
     ORDER BY due_date ASC`,
    untilIso,
  );
  return rows.map((row) => ({ itemId: String(row.item_id), dueDate: row.due_date }));
}

export function getSrsState(userDb: SQLiteDatabase, itemId: string): SRSState | null {
  const row = userDb.getFirstSync<SrsStateRow>(
    `SELECT item_id, stability, difficulty, due_date, fsrs_state, reps, lapses, learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at
     FROM srs_states WHERE item_id = ?`,
    parseItemId(itemId),
  );
  return row ? mapRowToState(row) : null;
}

/** Batch-fetch SRS states for related-item reinforcement resolution. */
export function getSrsStatesForItems(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Map<string, SRSState> {
  const result = new Map<string, SRSState>();
  if (itemIds.length === 0) return result;

  const numericIds = itemIds.map((id) => parseItemId(id));

  for (const chunk of chunkForSqlVariables(numericIds)) {
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = userDb.getAllSync<SrsStateRow>(
      `SELECT item_id, stability, difficulty, due_date, fsrs_state, reps, lapses, learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at
       FROM srs_states WHERE item_id IN (${placeholders})`,
      ...chunk,
    );

    for (const row of rows) {
      const state = mapRowToState(row);
      result.set(state.itemId, state);
    }
  }

  return result;
}

/** Batch-count SRS states present for the given item IDs. Chunks to respect SQLite SQLITE_MAX_VARIABLE_NUMBER. */
export function countStartedItemsByIds(
  userDb: SQLiteDatabase,
  itemIds: string[],
): number {
  if (itemIds.length === 0) return 0;

  const numericIds = itemIds.map((id) => parseItemId(id));
  let total = 0;

  for (const chunk of chunkForSqlVariables(numericIds)) {
    const placeholders = chunk.map(() => '?').join(', ');
    const row = userDb.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM srs_states WHERE item_id IN (${placeholders})`,
      ...chunk,
    );
    total += row?.count ?? 0;
  }

  return total;
}

/**
 * Pushes every not-yet-due card forward by `shiftMs` — the vacation-mode
 * resume step. Cards already overdue when the break began (`due_date <=
 * afterIso`) stay put; everything else keeps its spacing relative to the
 * others, so the backlog re-spreads over the days after resume instead of
 * landing all at once.
 *
 * `last_reviewed_at` moves by the same delta so FSRS sees the same elapsed
 * gap it would have without the break — otherwise it would credit the user
 * with retaining each card across the whole vacation and stretch every
 * subsequent interval (see core/srs/fsrsScheduler.ts `toFsrsCard`).
 *
 * Timestamps are recomputed in JS rather than with SQLite's `datetime()`,
 * which emits `YYYY-MM-DD HH:MM:SS` and would break the lexicographic ISO
 * comparison the whole due path relies on.
 *
 * Returns the number of rows shifted.
 */
export function shiftDueDatesAfter(
  userDb: SQLiteDatabase,
  afterIso: string,
  shiftMs: number,
): number {
  if (shiftMs <= 0) return 0;

  const rows = userDb.getAllSync<{
    item_id: number | string;
    due_date: string;
    last_reviewed_at: string | null;
  }>(
    `SELECT item_id, due_date, last_reviewed_at FROM srs_states
     WHERE due_date > ? AND is_burned = 0`,
    afterIso,
  );
  if (rows.length === 0) return 0;

  const updatedAt = new Date().toISOString();
  userDb.withTransactionSync(() => {
    for (const row of rows) {
      const shiftedDue = new Date(
        new Date(row.due_date).getTime() + shiftMs,
      ).toISOString();
      const shiftedLastReviewed =
        row.last_reviewed_at === null
          ? null
          : new Date(new Date(row.last_reviewed_at).getTime() + shiftMs).toISOString();

      userDb.runSync(
        `UPDATE srs_states
         SET due_date = ?, last_reviewed_at = ?, updated_at = ?
         WHERE item_id = ?`,
        shiftedDue,
        shiftedLastReviewed,
        updatedAt,
        row.item_id,
      );
    }
  });

  return rows.length;
}

export function upsertSrsState(
  userDb: SQLiteDatabase,
  state: SRSState,
): Result<void, AppError> {
  try {
    const updatedAt = state.updatedAt || new Date().toISOString();
    userDb.withTransactionSync(() => {
      userDb.runSync(
        `INSERT INTO srs_states (
           item_id, stability, difficulty, due_date, fsrs_state,
           reps, lapses, learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET
           stability = excluded.stability,
           difficulty = excluded.difficulty,
           due_date = excluded.due_date,
           fsrs_state = excluded.fsrs_state,
           reps = excluded.reps,
           lapses = excluded.lapses,
           learning_steps = excluded.learning_steps,
           is_burned = excluded.is_burned,
           srs_stage_label = excluded.srs_stage_label,
           last_reviewed_at = excluded.last_reviewed_at,
           updated_at = excluded.updated_at`,
        parseItemId(state.itemId),
        state.stability,
        state.difficulty,
        state.dueDate,
        state.fsrsState,
        state.reps,
        state.lapses,
        state.learningSteps,
        state.isBurned ? 1 : 0,
        state.srsStageLabel,
        state.lastReviewedAt,
        updatedAt,
      );

      // Mirror burned items to item_study_status (matches importRepository behavior)
      if (state.isBurned) {
        setStudyStatus(userDb, state.itemId, 'known');
      }
    });

    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'srs_state_upsert_failed',
        message: `Failed to upsert SRS state for item ${state.itemId}`,
        userMessage: 'Progress could not be saved. Your session will continue.',
        cause,
      },
    };
  }
}

/**
 * Seeds SRS state for in_progress items that have no existing srs_states row.
 * Import-populated rows are never overwritten (INSERT OR IGNORE semantics).
 */
export function seedMissingSrsStatesForInProgress(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Result<void, AppError> {
  if (itemIds.length === 0) {
    return { ok: true, value: undefined };
  }

  try {
    const now = new Date();
    userDb.withTransactionSync(() => {
      for (const itemId of itemIds) {
        const existing = getSrsState(userDb, itemId);
        if (existing) continue; // never overwrite import data

        const initial = createInitialSrsState(itemId, now);
        userDb.runSync(
          `INSERT OR IGNORE INTO srs_states (
             item_id, stability, difficulty, due_date, fsrs_state,
             reps, lapses, learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          parseItemId(itemId),
          initial.stability,
          initial.difficulty,
          initial.dueDate,
          initial.fsrsState,
          initial.reps,
          initial.lapses,
          initial.learningSteps,
          initial.isBurned ? 1 : 0,
          initial.srsStageLabel,
          initial.lastReviewedAt,
          initial.updatedAt,
        );
      }
    });

    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'srs_seed_failed',
        message: 'Failed to seed SRS states for in_progress items',
        userMessage: 'Some items may not appear in your review session.',
        cause,
      },
    };
  }
}
