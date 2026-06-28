import type { SQLiteDatabase } from 'expo-sqlite';

import { calculateWeaknessScore } from '@/core/srs/weaknessEngine';
import type { WeaknessStats } from '@/core/srs/srs.types';
import type { AppError, Result } from '@/types/result.types';

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

type OutcomeResult = 'correct' | 'incorrect' | 'typo';

type RecordOutcomeParams = {
  itemId: string;
  result: OutcomeResult;
  /** Prompt type that was answered: 'meaning' | 'reading' | 'production'. */
  promptType: string;
};

/**
 * Record a review outcome for an item.
 *
 * Uses INSERT … ON CONFLICT DO UPDATE to increment the appropriate counter.
 * On 'incorrect', also sets last_error_at and last_error_type.
 * Typos increment typo_count only and do NOT set last_error_at/last_error_type.
 *
 * Returns Result<void> — never throws.
 */
export function recordOutcome(
  userDb: SQLiteDatabase,
  params: RecordOutcomeParams,
): Result<void, AppError> {
  try {
    const numericId = parseItemId(params.itemId);
    const updatedAt = new Date().toISOString();

    if (params.result === 'correct') {
      userDb.runSync(
        `INSERT INTO weakness_stats (item_id, correct_count, incorrect_count, typo_count, updated_at)
         VALUES (?, 1, 0, 0, ?)
         ON CONFLICT(item_id) DO UPDATE SET
           correct_count = correct_count + 1,
           updated_at = excluded.updated_at`,
        numericId,
        updatedAt,
      );
    } else if (params.result === 'incorrect') {
      const lastErrorAt = updatedAt;
      userDb.runSync(
        `INSERT INTO weakness_stats (item_id, correct_count, incorrect_count, typo_count, last_error_at, last_error_type, updated_at)
         VALUES (?, 0, 1, 0, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET
           incorrect_count = incorrect_count + 1,
           last_error_at = excluded.last_error_at,
           last_error_type = excluded.last_error_type,
           updated_at = excluded.updated_at`,
        numericId,
        lastErrorAt,
        params.promptType,
        updatedAt,
      );
    } else {
      // typo — increment typo_count only
      userDb.runSync(
        `INSERT INTO weakness_stats (item_id, correct_count, incorrect_count, typo_count, updated_at)
         VALUES (?, 0, 0, 1, ?)
         ON CONFLICT(item_id) DO UPDATE SET
           typo_count = typo_count + 1,
           updated_at = excluded.updated_at`,
        numericId,
        updatedAt,
      );
    }

    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'weakness_record_failed',
        message: 'Failed to record weakness outcome',
        cause,
      },
    };
  }
}

type WeaknessStatsRow = {
  item_id: number | string;
  correct_count: number;
  incorrect_count: number;
  typo_count: number;
  last_error_at: string | null;
  last_error_type: string | null;
  pattern_tags: string | null;
};

function rowToStats(row: WeaknessStatsRow): WeaknessStats {
  return {
    itemId: String(row.item_id),
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    typoCount: row.typo_count,
    lastErrorAt: row.last_error_at ?? null,
    lastErrorType: row.last_error_type ?? null,
    patternTags: row.pattern_tags ? (JSON.parse(row.pattern_tags) as string[]) : [],
  };
}

/**
 * Batched read of weakness scores for a set of item IDs.
 * Mirrors getBoosts() shape: returns a Map<itemId, score> with 0 for unrecorded items.
 *
 * Uses a single IN (...) query — no per-item synchronous reads.
 */
export function getWeaknessScores(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (itemIds.length === 0) return result;

  const numericIds = itemIds.map((id) => parseItemId(id));
  const placeholders = numericIds.map(() => '?').join(', ');

  const rows = userDb.getAllSync<WeaknessStatsRow>(
    `SELECT item_id, correct_count, incorrect_count, typo_count, last_error_at, last_error_type, pattern_tags
     FROM weakness_stats WHERE item_id IN (${placeholders})`,
    ...numericIds,
  );

  for (const row of rows) {
    const stats = rowToStats(row);
    result.set(String(row.item_id), calculateWeaknessScore(stats));
  }

  // Items with no row default to 0 (not added to map; callers use ?? 0)
  return result;
}

/**
 * Fetch all weakness stats for cluster aggregation or Stats-tab display (6.2).
 * Returns an empty array when the table is empty.
 */
export function getAllWeaknessStats(userDb: SQLiteDatabase): WeaknessStats[] {
  const rows = userDb.getAllSync<WeaknessStatsRow>(
    `SELECT item_id, correct_count, incorrect_count, typo_count, last_error_at, last_error_type, pattern_tags
     FROM weakness_stats`,
  );
  return rows.map(rowToStats);
}
