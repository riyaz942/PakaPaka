import type { SQLiteDatabase } from 'expo-sqlite';

import { RELATED_ITEM_BOOST_CAP } from '@/config/constants';
import type { BoostDelta } from '@/core/srs/boostEngine';
import type { AppError, Result } from '@/types/result.types';

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

export function applyBoosts(
  userDb: SQLiteDatabase,
  deltas: BoostDelta[],
): Result<void, AppError> {
  if (deltas.length === 0) {
    return { ok: true, value: undefined };
  }

  // Deduplicate and accumulate deltas in-memory; skip non-positive deltas.
  const accumulated = new Map<string, number>();
  for (const { itemId, delta } of deltas) {
    if (delta <= 0) continue;
    accumulated.set(itemId, (accumulated.get(itemId) ?? 0) + delta);
  }

  if (accumulated.size === 0) {
    return { ok: true, value: undefined };
  }

  try {
    // Batch-read current values once, outside the transaction, to avoid
    // re-entrant reads inside withTransactionSync.
    const currentValues = getBoosts(userDb, [...accumulated.keys()]);
    const updatedAt = new Date().toISOString();

    userDb.withTransactionSync(() => {
      for (const [itemId, totalDelta] of accumulated) {
        const current = currentValues.get(itemId) ?? 0;
        const nextBoost = Math.min(current + totalDelta, RELATED_ITEM_BOOST_CAP);
        userDb.runSync(
          `INSERT INTO related_item_boosts (item_id, boost, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(item_id) DO UPDATE SET
             boost = excluded.boost,
             updated_at = excluded.updated_at`,
          parseItemId(itemId),
          nextBoost,
          updatedAt,
        );
      }
    });
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'boost_apply_failed',
        message: 'Failed to apply related-item boosts',
        cause,
      },
    };
  }
}

export function getBoosts(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (itemIds.length === 0) return result;

  const numericIds = itemIds.map((id) => parseItemId(id));
  const placeholders = numericIds.map(() => '?').join(', ');

  const rows = userDb.getAllSync<{ item_id: number | string; boost: number }>(
    `SELECT item_id, boost FROM related_item_boosts WHERE item_id IN (${placeholders})`,
    ...numericIds,
  );

  for (const row of rows) {
    result.set(String(row.item_id), row.boost);
  }

  return result;
}

export function clearBoosts(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Result<void, AppError> {
  if (itemIds.length === 0) {
    return { ok: true, value: undefined };
  }

  try {
    const numericIds = itemIds.map((id) => parseItemId(id));
    const placeholders = numericIds.map(() => '?').join(', ');
    userDb.runSync(
      `DELETE FROM related_item_boosts WHERE item_id IN (${placeholders})`,
      ...numericIds,
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'boost_clear_failed',
        message: 'Failed to clear related-item boosts',
        cause,
      },
    };
  }
}
