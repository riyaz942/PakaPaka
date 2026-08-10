import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChatWordEntry, ChatWordIndex } from '@/core/ai/chatWordSpans';
import type { WordInflection } from '@/core/content/inflection';
import type { ItemType } from '@/data/curriculum/itemRepository';

/**
 * The curriculum surface index chat word linking matches against (Plan 15.1).
 *
 * Two layers, mirroring what the pipeline derives for passages and examples:
 *
 *  * **dictionary forms** — every item's `primary_form`. Ties between item types
 *    resolve vocabulary → kanji → grammar → radical, the same precedence
 *    `lookupFlaggedWord` uses, so the underline and the lookup sheet always
 *    agree about which item a surface belongs to.
 *  * **taught-inflection surfaces** — the conjugated surfaces 14.1a derived at
 *    build time, read back out of `example_sentence_spans` and
 *    `passage_word_spans` and keyed the other way round. Coverage is therefore
 *    "forms the curriculum actually shows this word in", which is exactly the
 *    scope `getTaughtConjugatedForms` lists on the word's own detail page — the
 *    app never conjugates anything itself.
 *
 * Dictionary forms win, matching `merge_spans` in the pipeline: 勉強 stays 勉強
 * even where 勉強する is also an entry.
 *
 * Built once per curriculum handle and cached. It is ~2k short strings over the
 * whole shipped curriculum, so the alternative — an IN-clause query per reply —
 * would scan more rows more often for a worse result. An OTA swap hands over a
 * new handle, which drops the old entry naturally.
 */

const cache = new WeakMap<SQLiteDatabase, ChatWordIndex>();

const TYPE_PRECEDENCE: Record<string, number> = {
  vocabulary: 0,
  kanji: 1,
  grammar: 2,
};

type ItemFormRow = {
  id: number | string;
  primary_form: string;
  item_type: ItemType;
};

type InflectedSurfaceRow = {
  item_id: number | string;
  inflection: WordInflection;
  start_offset: number;
  end_offset: number;
  text: string;
};

export function getChatWordIndex(curriculumDb: SQLiteDatabase): ChatWordIndex {
  const cached = cache.get(curriculumDb);
  if (cached) {
    return cached;
  }

  const index = new Map<string, ChatWordEntry>();

  const items = curriculumDb.getAllSync<ItemFormRow>(
    'SELECT id, primary_form, item_type FROM items',
  );
  // Precedence is applied here rather than in an ORDER BY so the winner does not
  // depend on the query planner's stability for equal keys.
  const ordered = [...items].sort(
    (left, right) =>
      (TYPE_PRECEDENCE[left.item_type] ?? 3) - (TYPE_PRECEDENCE[right.item_type] ?? 3) ||
      Number(left.id) - Number(right.id),
  );
  for (const row of ordered) {
    if (row.primary_form && !index.has(row.primary_form)) {
      index.set(row.primary_form, { itemId: String(row.id), inflection: null });
    }
  }

  for (const row of readInflectedSurfaces(curriculumDb)) {
    const surface = row.text.slice(row.start_offset, row.end_offset);
    if (surface && !index.has(surface)) {
      index.set(surface, { itemId: String(row.item_id), inflection: row.inflection });
    }
  }

  cache.set(curriculumDb, index);
  return index;
}

/** Every taught-inflected span in the curriculum, with the text it was cut from. */
function readInflectedSurfaces(curriculumDb: SQLiteDatabase): InflectedSurfaceRow[] {
  try {
    return [
      ...curriculumDb.getAllSync<InflectedSurfaceRow>(
        `SELECT sp.item_id AS item_id, sp.inflection AS inflection,
                sp.start_offset AS start_offset, sp.end_offset AS end_offset,
                es.japanese AS text
         FROM example_sentence_spans sp
         JOIN example_sentences es ON es.id = sp.sentence_id
         WHERE sp.inflection IS NOT NULL`,
      ),
      ...curriculumDb.getAllSync<InflectedSurfaceRow>(
        `SELECT sp.vocabulary_item_id AS item_id, sp.inflection AS inflection,
                sp.start_offset AS start_offset, sp.end_offset AS end_offset,
                rp.body AS text
         FROM passage_word_spans sp
         JOIN reading_passages rp ON rp.id = sp.passage_id
         WHERE sp.inflection IS NOT NULL`,
      ),
    ];
  } catch {
    // Pre-14.1a DB without the spans tables: chat links dictionary forms only
    // until the curriculum update lands.
    return [];
  }
}
