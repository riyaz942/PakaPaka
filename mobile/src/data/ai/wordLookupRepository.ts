import type { SQLiteDatabase } from 'expo-sqlite';

import { KNOWN_SRS_STAGES } from '@/data/user/masteryRepository';

/**
 * Local curriculum lookup for AI-flagged words (FR92, FR93).
 *
 * Zero token cost: membership is decided against the bundled curriculum, not by
 * asking the model. Reads only — flagging a word must never create SRS state,
 * because every SRS row is keyed to a curriculum `item_id` and an off-curriculum
 * word has none.
 *
 * Joins the `curriculum` alias attached to the user handle (see database.ts),
 * the same shape `masteryRepository` uses.
 */

export type FlaggedWordLookup =
  | {
      kind: 'curriculum';
      itemId: string;
      primaryForm: string;
      meaning: string;
      /** Studied or mastered already — decides "review this" vs "learn this" wording. */
      studied: boolean;
    }
  | { kind: 'off_curriculum'; text: string };

type LookupRow = {
  id: string | number;
  primary_form: string;
  meaning: string | null;
  studied: number | null;
};

/**
 * Resolves one flagged surface form. An unmatched word is not an error — most
 * words a conversation partner uses are legitimately off-curriculum, and those
 * are display-and-translate only.
 */
export function lookupFlaggedWord(
  userDb: SQLiteDatabase,
  text: string,
): FlaggedWordLookup {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { kind: 'off_curriculum', text };
  }

  const row = userDb.getFirstSync<LookupRow>(
    `SELECT i.id, i.primary_form, i.meaning,
            CASE WHEN i.id IN (SELECT item_id FROM item_study_status WHERE status IN ('learning', 'known'))
                   OR i.id IN (
                     SELECT item_id FROM srs_states
                     WHERE srs_stage_label IN (${KNOWN_SRS_STAGES.map(() => '?').join(', ')})
                   )
                 THEN 1 ELSE 0 END AS studied
     FROM curriculum.items i
     WHERE i.primary_form = ?
     LIMIT 1`,
    ...KNOWN_SRS_STAGES,
    trimmed,
  );

  if (!row) {
    return { kind: 'off_curriculum', text: trimmed };
  }

  return {
    kind: 'curriculum',
    itemId: String(row.id),
    primaryForm: row.primary_form,
    meaning: row.meaning ?? '',
    studied: Number(row.studied ?? 0) === 1,
  };
}
