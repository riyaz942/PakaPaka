import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * An authored word boundary inside a passage body (FR70).
 *
 * Offsets are UTF-16 (JavaScript string) indices into `PassageDetail.body`,
 * inclusive start and exclusive end, so `body.slice(startOffset, endOffset)`
 * is the surface form. The compile step guarantees spans are in body order,
 * in range, and non-overlapping — the reader composes the body by walking
 * them in sequence.
 */
export type PassageWordSpan = {
  vocabularyItemId: string;
  startOffset: number;
  endOffset: number;
};

type PassageWordSpanRow = {
  vocabulary_item_id: number | string;
  start_offset: number;
  end_offset: number;
};

/** Authored word spans for a passage, in body order. */
export function getPassageWordSpans(
  db: SQLiteDatabase,
  passageId: string,
): PassageWordSpan[] {
  const rows = db.getAllSync<PassageWordSpanRow>(
    `SELECT vocabulary_item_id, start_offset, end_offset
     FROM passage_word_spans
     WHERE passage_id = ?
     ORDER BY sort_order ASC`,
    Number(passageId),
  );

  return rows.map((row) => ({
    vocabularyItemId: String(row.vocabulary_item_id),
    startOffset: row.start_offset,
    endOffset: row.end_offset,
  }));
}
