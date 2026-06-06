import type { SQLiteDatabase } from 'expo-sqlite';

import { isStudyStatus, type StudyStatus } from '@/data/user/studyStatus.types';

// Strict dependency gating (radical → kanji unlock order) is deferred to Epic 4
// (dependencyGraph.ts) and Epic 5 queue builder. Onboarding calibration allows
// self-reported status without blocking (FR23).

type StudyStatusRow = {
  item_id: number | string;
  status: string;
};

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

export function getStudyStatus(
  userDb: SQLiteDatabase,
  itemId: string,
): StudyStatus | null {
  const row = userDb.getFirstSync<{ status: string }>(
    'SELECT status FROM item_study_status WHERE item_id = ?',
    parseItemId(itemId),
  );

  if (!row?.status || !isStudyStatus(row.status)) {
    return null;
  }

  return row.status;
}

export function getStudyStatusOrDefault(
  userDb: SQLiteDatabase,
  itemId: string,
): StudyStatus {
  return getStudyStatus(userDb, itemId) ?? 'not_started';
}

export function clearStudyStatus(userDb: SQLiteDatabase, itemId: string): void {
  userDb.runSync('DELETE FROM item_study_status WHERE item_id = ?', parseItemId(itemId));
}

export function setStudyStatus(
  userDb: SQLiteDatabase,
  itemId: string,
  status: StudyStatus,
): void {
  if (!isStudyStatus(status)) {
    throw new Error(`Invalid study status: ${status}`);
  }

  if (status === 'not_started') {
    clearStudyStatus(userDb, itemId);
    return;
  }

  const updatedAt = new Date().toISOString();
  userDb.runSync(
    `INSERT INTO item_study_status (item_id, status, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    parseItemId(itemId),
    status,
    updatedAt,
  );
}

export function listStudyStatusesForItems(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Map<string, StudyStatus> {
  const result = new Map<string, StudyStatus>();

  if (itemIds.length === 0) {
    return result;
  }

  const placeholders = itemIds.map(() => '?').join(', ');
  const numericIds = itemIds.map(parseItemId);

  const rows = userDb.getAllSync<StudyStatusRow>(
    `SELECT item_id, status FROM item_study_status WHERE item_id IN (${placeholders})`,
    ...numericIds,
  );

  for (const row of rows) {
    if (isStudyStatus(row.status)) {
      result.set(String(row.item_id), row.status);
    }
  }

  return result;
}
