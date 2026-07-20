import type { SQLiteDatabase } from 'expo-sqlite';

import { getExampleSentences, getItemById } from '@/data/curriculum/itemRepository';

/** Max curriculum lookups per greeting resolution — Home focus must stay cheap. */
const GREETING_CANDIDATE_LIMIT = 20;

const GURU_PLUS_STAGES = new Set(['guru', 'master', 'enlightened', 'burned']);

/**
 * Japanese example sentence drawn from the learner's started vocabulary,
 * preferring Guru+ items so the sentence is likely comprehensible.
 *
 * Interim scope (I4): `example_sentences` does not record which vocabulary a
 * sentence uses, so full "every word already learned" filtering is not
 * possible without a curriculum pipeline change. Returns null when the
 * learner has no started vocabulary with an example sentence (day 1).
 */
export function getGreetingSentence(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
): string | null {
  const rows = userDb.getAllSync<{ item_id: number | string; srs_stage_label: string }>(
    'SELECT item_id, srs_stage_label FROM srs_states',
  );

  const guruPlusIds: string[] = [];
  const earlierIds: string[] = [];
  for (const row of rows) {
    (GURU_PLUS_STAGES.has(row.srs_stage_label) ? guruPlusIds : earlierIds).push(
      String(row.item_id),
    );
  }

  const candidates = [...guruPlusIds, ...earlierIds].slice(0, GREETING_CANDIDATE_LIMIT);
  for (const itemId of candidates) {
    const item = getItemById(curriculumDb, itemId);
    if (item?.itemType !== 'vocabulary') continue;
    const sentence = getExampleSentences(curriculumDb, itemId)[0];
    if (sentence) return sentence.japanese;
  }

  return null;
}
