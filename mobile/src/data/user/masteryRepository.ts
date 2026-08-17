import type { SQLiteDatabase } from 'expo-sqlite';

import { chunkForSqlVariables } from '@/data/sqlChunk';

/**
 * Stages at which a *kanji* counts as learned: guru and above.
 *
 * This is the threshold v2 rule 1 gates reading prompts on — a kanji met in a
 * lesson yesterday cannot answer a question due in four months.
 */
export const KNOWN_SRS_STAGES = ['guru', 'master', 'enlightened', 'burned'];

/**
 * Stages at which a *word* counts as mastered for furigana purposes.
 *
 * Raised from guru+ to master+ by v2 rule 4. Under v2 a word whose kanji are
 * untaught is asked for its meaning only, so it climbs to guru while the
 * learner still cannot read it — hiding its furigana there would leave the
 * word unreadable. Mastery is the second half of the same rule: the first is
 * `readingLiveSql` below.
 */
export const MASTERED_SRS_STAGES = ['master', 'enlightened', 'burned'];

const KANJI_EDGE_TYPES = ['requires', 'builds_on'];

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}

/**
 * Predicate: every kanji written in the vocabulary row `itemIdExpr` has itself
 * reached guru (or been bulk-marked known) — v2 rule 1's "reading card live"
 * flag, and the second half of rule 4.
 *
 * Both graph edge types are read. Phase C narrows `requires` to in-band kanji
 * and leaves the rest a non-gating edge; the reading prompt must see both, or
 * it would ask for a word's reading on the strength of half its kanji.
 *
 * Binds KNOWN_SRS_STAGES.
 */
function readingLiveSql(itemIdExpr: string): string {
  return `NOT EXISTS (
    SELECT 1
    FROM curriculum.item_relationships r
    JOIN curriculum.items p ON p.id = r.parent_item_id
    WHERE r.child_item_id = ${itemIdExpr}
      AND p.item_type = 'kanji'
      AND r.relationship_type IN (${placeholders(KANJI_EDGE_TYPES)})
      AND p.id NOT IN (
        SELECT item_id FROM srs_states WHERE srs_stage_label IN (${placeholders(KNOWN_SRS_STAGES)})
      )
      AND p.id NOT IN (SELECT item_id FROM item_study_status WHERE status = 'known')
  )`;
}

const READING_LIVE_PARAMS = [...KANJI_EDGE_TYPES, ...KNOWN_SRS_STAGES];

/**
 * Characters appearing in vocabulary the user has mastered, for
 * `<FuriganaText>`'s 'auto' mode on embedded multi-word text (example
 * sentences, grammar bodies, passage bodies) where there are no per-word
 * boundaries to key on.
 *
 * The mastery unit is the *word*, not the character (FR78 / BUG6): a kanji
 * counts as known only because it appears in a word the learner has actually
 * mastered — never merely because the standalone kanji item is mastered.
 *
 * An explicit `known` bulk-mark hides furigana on its own: that is the learner
 * saying so directly, not an SRS inference. The SRS route needs both halves of
 * rule 4 — master+ *and* a live reading card.
 *
 * Joins across the `curriculum` alias attached by `attachCurriculumForQuery`
 * (see database.ts).
 */
export function getKnownVocabularyCharacters(userDb: SQLiteDatabase): Set<string> {
  const rows = userDb.getAllSync<{ primary_form: string }>(
    `SELECT DISTINCT i.primary_form
     FROM curriculum.items i
     WHERE i.item_type = 'vocabulary'
       AND (
         i.id IN (SELECT item_id FROM item_study_status WHERE status = 'known')
         OR (
           i.id IN (
             SELECT item_id FROM srs_states
             WHERE srs_stage_label IN (${placeholders(MASTERED_SRS_STAGES)})
           )
           AND ${readingLiveSql('i.id')}
         )
       )`,
    ...MASTERED_SRS_STAGES,
    ...READING_LIVE_PARAMS,
  );

  const characters = new Set<string>();
  for (const row of rows) {
    for (const character of row.primary_form) {
      characters.add(character);
    }
  }

  return characters;
}

/**
 * Whether one specific item is mastered — the mastery unit for surfaces that
 * render a single vocabulary item's own word (detail hero, lesson hero, the
 * passage word sheet). Same predicate as `getKnownVocabularyCharacters`,
 * scoped to one id.
 */
export function isVocabularyItemKnown(
  userDb: SQLiteDatabase,
  itemId: string | null | undefined,
): boolean {
  if (!itemId) {
    return false;
  }

  const row = userDb.getFirstSync<{ known: number }>(
    `SELECT 1 AS known
     WHERE ? IN (SELECT item_id FROM item_study_status WHERE status = 'known')
        OR (
          ? IN (
            SELECT item_id FROM srs_states
            WHERE srs_stage_label IN (${placeholders(MASTERED_SRS_STAGES)})
          )
          AND ${readingLiveSql('?')}
        )`,
    itemId,
    itemId,
    ...MASTERED_SRS_STAGES,
    itemId,
    ...READING_LIVE_PARAMS,
  );

  return row !== null;
}

/**
 * Per vocabulary item, the kanji written in it that the learner has not yet
 * learned — v2 rule 1's gate, in the form the review queue needs it.
 *
 * An empty list (or a missing entry) means every kanji in the word is at guru+,
 * so the reading card is live. The forms come back in curriculum sort order so
 * the "Master until you learn 写 and 真" note reads in teaching order.
 */
export function getUnlearnedKanjiForItems(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (itemIds.length === 0) {
    return result;
  }

  const numericIds = itemIds.map((itemId) => Number(itemId));

  for (const chunk of chunkForSqlVariables(numericIds, READING_LIVE_PARAMS.length)) {
    const rows = userDb.getAllSync<{ child_item_id: number | string; primary_form: string }>(
      `SELECT r.child_item_id, p.primary_form
       FROM curriculum.item_relationships r
       JOIN curriculum.items p ON p.id = r.parent_item_id
       WHERE r.child_item_id IN (${placeholders(chunk)})
         AND p.item_type = 'kanji'
         AND r.relationship_type IN (${placeholders(KANJI_EDGE_TYPES)})
         AND p.id NOT IN (
           SELECT item_id FROM srs_states WHERE srs_stage_label IN (${placeholders(KNOWN_SRS_STAGES)})
         )
         AND p.id NOT IN (SELECT item_id FROM item_study_status WHERE status = 'known')
       ORDER BY r.child_item_id ASC, p.sort_order ASC`,
      ...chunk,
      ...READING_LIVE_PARAMS,
    );

    for (const row of rows) {
      const itemId = String(row.child_item_id);
      const forms = result.get(itemId) ?? [];
      forms.push(row.primary_form);
      result.set(itemId, forms);
    }
  }

  return result;
}

/**
 * How many tracked vocabulary items are held at master by rule 3 — meaning-only
 * words whose reading card is not live yet. Stats reports this so the stage
 * breakdown does not read as stalled progress.
 */
export function countReadingLockedVocabulary(userDb: SQLiteDatabase): number {
  const row = userDb.getFirstSync<{ locked: number }>(
    `SELECT COUNT(*) AS locked
     FROM curriculum.items i
     JOIN srs_states s ON s.item_id = i.id
     WHERE i.item_type = 'vocabulary'
       AND s.is_burned = 0
       AND i.id NOT IN (SELECT item_id FROM item_study_status WHERE status = 'known')
       AND NOT ${readingLiveSql('i.id')}`,
    ...READING_LIVE_PARAMS,
  );

  return row?.locked ?? 0;
}
