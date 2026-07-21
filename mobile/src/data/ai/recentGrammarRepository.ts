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

type ExampleRow = {
  furigana: string | null;
  japanese: string;
};

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }
  return Math.max(0, Math.floor(limit));
}

/** Up to a few examples per topic — enough for the system prompt, not a dump. */
function loadExampleSentences(userDb: SQLiteDatabase, itemId: string): string[] {
  const rows = userDb.getAllSync<ExampleRow>(
    `SELECT furigana, japanese
     FROM curriculum.example_sentences
     WHERE item_id = ?
     ORDER BY sort_order ASC
     LIMIT 3`,
    Number(itemId),
  );

  return rows.map((row) =>
    row.furigana && row.furigana.trim().length > 0 ? row.furigana : row.japanese,
  );
}

function mapRows(userDb: SQLiteDatabase, rows: RecentGrammarRow[]): RecentGrammarItem[] {
  return rows.map((row) => {
    const itemId = String(row.id);
    const examples = loadExampleSentences(userDb, itemId);
    return {
      itemId,
      primaryForm: row.primary_form,
      meaning: row.meaning ?? '',
      structure: row.structure ?? undefined,
      exampleSentences: examples.length > 0 ? examples : undefined,
      lastTouchedAt: row.last_touched_at,
    };
  });
}

export function listRecentGrammar(
  userDb: SQLiteDatabase,
  limit = 5,
): RecentGrammarItem[] {
  const safeLimit = clampLimit(limit);
  if (safeLimit === 0) {
    return [];
  }

  // GROUP BY is required: without it SQLite collapses MAX(...) + bare columns
  // into a single arbitrary row, so "recent" would always be length 1.
  const rows = userDb.getAllSync<RecentGrammarRow>(
    `SELECT i.id, i.primary_form, i.meaning, g.structure,
            MAX(COALESCE(s.updated_at, ''), COALESCE(r.updated_at, '')) AS last_touched_at
     FROM curriculum.items i
     LEFT JOIN curriculum.grammar_rules g ON g.item_id = i.id
     LEFT JOIN item_study_status s ON s.item_id = i.id
     LEFT JOIN srs_states r ON r.item_id = i.id
     WHERE i.item_type = 'grammar'
       AND (s.updated_at IS NOT NULL OR r.updated_at IS NOT NULL)
     GROUP BY i.id, i.primary_form, i.meaning, g.structure
     ORDER BY last_touched_at DESC
     LIMIT ?`,
    safeLimit,
  );

  return mapRows(userDb, rows);
}

/** Every grammar item, for the "choose grammar" picker. */
export function listAllGrammar(userDb: SQLiteDatabase, limit = 200): RecentGrammarItem[] {
  const safeLimit = clampLimit(limit);
  if (safeLimit === 0) {
    return [];
  }

  const rows = userDb.getAllSync<RecentGrammarRow>(
    `SELECT i.id, i.primary_form, i.meaning, g.structure, '' AS last_touched_at
     FROM curriculum.items i
     LEFT JOIN curriculum.grammar_rules g ON g.item_id = i.id
     WHERE i.item_type = 'grammar'
     ORDER BY i.sort_order ASC
     LIMIT ?`,
    safeLimit,
  );

  return mapRows(userDb, rows);
}
