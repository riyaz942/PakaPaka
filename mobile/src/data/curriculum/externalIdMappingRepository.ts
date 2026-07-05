import type { SQLiteDatabase } from 'expo-sqlite';

import { chunkForSqlVariables } from '@/data/sqlChunk';

type ExternalIdMappingRow = {
  external_id: string;
  item_id: number | string;
};

export function getExternalIdMappings(
  curriculumDb: SQLiteDatabase,
  source: 'wanikani' | 'bunpro' | 'anki',
  externalIds: string[],
): Map<string, string> {
  const result = new Map<string, string>();

  if (externalIds.length === 0) {
    return result;
  }

  // Imports can pass thousands of ids at once — chunk to respect the SQLite
  // bound-parameter limit (1 reserved for `source`).
  for (const chunk of chunkForSqlVariables(externalIds, 1)) {
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = curriculumDb.getAllSync<ExternalIdMappingRow>(
      `SELECT external_id, item_id
       FROM external_id_mappings
       WHERE source = ? AND external_id IN (${placeholders})`,
      source,
      ...chunk,
    );

    for (const row of rows) {
      result.set(String(row.external_id), String(row.item_id));
    }
  }

  return result;
}
