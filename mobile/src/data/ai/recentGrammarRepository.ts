import type { SQLiteDatabase } from 'expo-sqlite';

import type { GrammarPromptTopic } from '@/core/ai/systemPrompt';

/**
 * "Practise recent grammar" source (FR89).
 *
 * Ordered by the `updated_at` columns that `item_study_status` and `srs_states`
 * already carry — no new tracking table, because "recently touched" is exactly
 * what those timestamps already mean.
 */

export type RecentGrammarItem = GrammarPromptTopic & {
  itemId: string;
  lastTouchedAt: string;
};

type RecentGrammarRow = {
  id: string | number;
  primary_form: string;
  meaning: string | null;
  structure: string | null;
  last_touched_at: string;
};

export function listRecentGrammar(
  userDb: SQLiteDatabase,
  limit = 5,
): RecentGrammarItem[] {
  const rows = userDb.getAllSync<RecentGrammarRow>(
    `SELECT i.id, i.primary_form, i.meaning, g.structure,
            MAX(COALESCE(s.updated_at, ''), COALESCE(r.updated_at, '')) AS last_touched_at
     FROM curriculum.items i
     LEFT JOIN curriculum.grammar_rules g ON g.item_id = i.id
     LEFT JOIN item_study_status s ON s.item_id = i.id
     LEFT JOIN srs_states r ON r.item_id = i.id
     WHERE i.item_type = 'grammar'
       AND (s.updated_at IS NOT NULL OR r.updated_at IS NOT NULL)
     ORDER BY last_touched_at DESC
     LIMIT ?`,
    limit,
  );

  return rows.map((row) => ({
    itemId: String(row.id),
    primaryForm: row.primary_form,
    meaning: row.meaning ?? '',
    structure: row.structure ?? undefined,
    lastTouchedAt: row.last_touched_at,
  }));
}

/** Every grammar item, for the "choose grammar" picker. */
export function listAllGrammar(userDb: SQLiteDatabase, limit = 200): RecentGrammarItem[] {
  const rows = userDb.getAllSync<RecentGrammarRow>(
    `SELECT i.id, i.primary_form, i.meaning, g.structure, '' AS last_touched_at
     FROM curriculum.items i
     LEFT JOIN curriculum.grammar_rules g ON g.item_id = i.id
     WHERE i.item_type = 'grammar'
     ORDER BY i.sort_order ASC
     LIMIT ?`,
    limit,
  );

  return rows.map((row) => ({
    itemId: String(row.id),
    primaryForm: row.primary_form,
    meaning: row.meaning ?? '',
    structure: row.structure ?? undefined,
    lastTouchedAt: row.last_touched_at,
  }));
}
