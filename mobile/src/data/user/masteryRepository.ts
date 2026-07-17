import type { SQLiteDatabase } from 'expo-sqlite';

const KNOWN_SRS_STAGES = ['guru', 'master', 'enlightened', 'burned'];

/**
 * Kanji characters the user already knows, for `<FuriganaText>`'s 'auto' mode
 * (hide furigana only once every kanji in a run is known). Joins across the
 * `curriculum` alias attached by `attachCurriculumForQuery` (see database.ts)
 * — the first cross-DB query in the app, ahead of the Epic 5 review queue
 * builder that was originally slated to introduce it.
 *
 * "Known" mirrors the WaniKani convention referenced in
 * docs/content/furigana-support-plan.md Phase 4: item_study_status = 'known', or an
 * SRS stage of guru and above.
 */
export function getKnownKanjiCharacters(userDb: SQLiteDatabase): Set<string> {
  const rows = userDb.getAllSync<{ primary_form: string }>(
    `SELECT DISTINCT i.primary_form
     FROM curriculum.items i
     WHERE i.item_type = 'kanji'
       AND (
         i.id IN (SELECT item_id FROM item_study_status WHERE status = 'known')
         OR i.id IN (
           SELECT item_id FROM srs_states WHERE srs_stage_label IN (${KNOWN_SRS_STAGES.map(() => '?').join(', ')})
         )
       )`,
    ...KNOWN_SRS_STAGES,
  );

  return new Set(rows.map((row) => row.primary_form));
}
