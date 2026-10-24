import type { SQLiteDatabase } from 'expo-sqlite';

import type { GrammarStart } from '@/core/lesson/grammarPace';
import { chunkForSqlVariables } from '@/data/sqlChunk';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';

/**
 * Ids with an srs_states row or status in_progress / known, each counted once.
 * Placement-known items have no SRS row, so the status read is what counts them.
 */
export function countStartedOrKnownItems(userDb: SQLiteDatabase, itemIds: string[]): number {
  const started = new Set(getSrsStatesForItems(userDb, itemIds).keys());
  for (const [itemId, status] of listStudyStatusesForItems(userDb, itemIds)) {
    if (status === 'in_progress' || status === 'known') started.add(itemId);
  }
  return started.size;
}

/**
 * in_progress items among `grammarIds`. `item_study_status.updated_at` is the
 * start time: only starting a lesson, import, or the per-item status control
 * write `in_progress`, so nothing rewrites the row while the item is learned.
 */
export function listGrammarStarts(userDb: SQLiteDatabase, grammarIds: string[]): GrammarStart[] {
  if (grammarIds.length === 0) return [];

  const rows: { item_id: number | string; updated_at: string }[] = [];
  for (const chunk of chunkForSqlVariables(grammarIds.map((id) => Number(id)))) {
    const placeholders = chunk.map(() => '?').join(', ');
    rows.push(
      ...userDb.getAllSync<{ item_id: number | string; updated_at: string }>(
        `SELECT item_id, updated_at FROM item_study_status WHERE status = 'in_progress' AND item_id IN (${placeholders})`,
        ...chunk,
      ),
    );
  }

  const stages = getSrsStatesForItems(
    userDb,
    rows.map((row) => String(row.item_id)),
  );
  return rows.map((row) => {
    const itemId = String(row.item_id);
    return {
      itemId,
      startedAt: row.updated_at,
      stage: stages.get(itemId)?.srsStageLabel ?? null,
    };
  });
}
