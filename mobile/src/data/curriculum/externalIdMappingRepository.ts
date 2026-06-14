import type { SQLiteDatabase } from 'expo-sqlite';

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

  const placeholders = externalIds.map(() => '?').join(', ');
  const rows = curriculumDb.getAllSync<ExternalIdMappingRow>(
    `SELECT external_id, item_id
     FROM external_id_mappings
     WHERE source = ? AND external_id IN (${placeholders})`,
    source,
    ...externalIds,
  );

  for (const row of rows) {
    result.set(String(row.external_id), String(row.item_id));
  }

  return result;
}
