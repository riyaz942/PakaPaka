import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Mastery for furigana purposes: an explicit `known` study status, or an SRS
 * stage of guru and above.
 */
export const KNOWN_SRS_STAGES = ['guru', 'master', 'enlightened', 'burned'];

const KNOWN_PREDICATE = `(
  ? IN (SELECT item_id FROM item_study_status WHERE status = 'known')
  OR ? IN (
    SELECT item_id FROM srs_states WHERE srs_stage_label IN (${KNOWN_SRS_STAGES.map(() => '?').join(', ')})
  )
)`;

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
         OR i.id IN (
           SELECT item_id FROM srs_states WHERE srs_stage_label IN (${KNOWN_SRS_STAGES.map(() => '?').join(', ')})
         )
       )`,
    ...KNOWN_SRS_STAGES,
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
 * passage word sheet). Same guru+/known predicate as
 * `getKnownVocabularyCharacters`, scoped to one id.
 *
 * Reads `user.db` only: the caller already knows which item it is rendering,
 * so no curriculum join is needed.
 */
export function isVocabularyItemKnown(
  userDb: SQLiteDatabase,
  itemId: string | null | undefined,
): boolean {
  if (!itemId) {
    return false;
  }

  const row = userDb.getFirstSync<{ known: number }>(
    `SELECT 1 AS known WHERE ${KNOWN_PREDICATE}`,
    itemId,
    itemId,
    ...KNOWN_SRS_STAGES,
  );

  return row !== null;
}
