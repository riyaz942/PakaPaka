import type { SQLiteDatabase } from 'expo-sqlite';

import { getExampleSentences, type ExampleSentence } from '@/data/curriculum/itemRepository';

/** A grammar example sentence that is also a review card (spec §4–§5.1). */
export type GrammarPoolSentence = ExampleSentence & {
  grammarStart: number;
  grammarEnd: number;
  register: 'polite' | 'plain';
  /** Furigana notation, `valid` alternates, in authored order. */
  validAnswers: string[];
  /** Furigana notation, `other_grammar` alternates, in authored order. */
  otherGrammarAnswers: string[];
};

/**
 * The review pool of one grammar item. Only sentences with a compiled grammar
 * span are pool sentences; the compile gate guarantees ≥ 8 of them per point.
 */
export function getGrammarSentencePool(db: SQLiteDatabase, itemId: string): GrammarPoolSentence[] {
  const sentences = getExampleSentences(db, itemId);
  if (sentences.length === 0) return [];

  const grammarRows = db.getAllSync<{
    id: number | string;
    grammar_start: number | null;
    grammar_end: number | null;
    register: 'polite' | 'plain' | null;
  }>(
    'SELECT id, grammar_start, grammar_end, register FROM example_sentences WHERE item_id = ? ORDER BY sort_order ASC',
    Number(itemId),
  );
  const grammarById = new Map(
    grammarRows
      .filter((row) => row.grammar_start != null && row.grammar_end != null && row.register != null)
      .map((row) => [String(row.id), row]),
  );
  const poolSentences = sentences.filter((sentence) => grammarById.has(sentence.id));
  if (poolSentences.length === 0) return [];

  const placeholders = poolSentences.map(() => '?').join(', ');
  const answerRows = db.getAllSync<{
    sentence_id: number | string;
    answer_furigana: string;
    kind: 'valid' | 'other_grammar';
  }>(
    `SELECT sentence_id, answer_furigana, kind FROM grammar_sentence_answers
     WHERE sentence_id IN (${placeholders}) ORDER BY sort_order ASC`,
    ...poolSentences.map((sentence) => Number(sentence.id)),
  );

  return poolSentences.map((sentence) => {
    const row = grammarById.get(sentence.id)!;
    const answers = answerRows.filter((answer) => String(answer.sentence_id) === sentence.id);
    return {
      ...sentence,
      grammarStart: row.grammar_start!,
      grammarEnd: row.grammar_end!,
      register: row.register!,
      validAnswers: answers.filter((a) => a.kind === 'valid').map((a) => a.answer_furigana),
      otherGrammarAnswers: answers
        .filter((a) => a.kind === 'other_grammar')
        .map((a) => a.answer_furigana),
    };
  });
}

export type ItemForm = { primaryForm: string; furigana: string | null };

/** Dictionary form + bracket furigana per item id, for the Build card's word list. */
export function getItemFormsByIds(db: SQLiteDatabase, itemIds: string[]): Map<string, ItemForm> {
  const result = new Map<string, ItemForm>();
  if (itemIds.length === 0) return result;
  const placeholders = itemIds.map(() => '?').join(', ');
  const rows = db.getAllSync<{ id: number | string; primary_form: string; furigana: string | null }>(
    `SELECT id, primary_form, furigana FROM items WHERE id IN (${placeholders})`,
    ...itemIds.map(Number),
  );
  for (const row of rows) {
    result.set(String(row.id), { primaryForm: row.primary_form, furigana: row.furigana ?? null });
  }
  return result;
}
