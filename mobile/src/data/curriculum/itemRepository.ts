import type { SQLiteDatabase } from 'expo-sqlite';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';

export type ItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export const ITEM_TYPES: readonly ItemType[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
] as const;

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
};

export type CurriculumListItem = {
  id: string;
  slug: string;
  primaryForm: string;
  meaning: string;
  itemType: ItemType;
  sortOrder: number;
};

export type CurriculumItemDetail = {
  id: string;
  slug: string;
  itemType: ItemType;
  jlptLevel: JLPTLevel;
  primaryForm: string;
  meaning: string;
  mnemonicText: string | null;
  visualMnemonicUrl: string | null;
};

export type CurriculumParentItem = {
  id: string;
  primaryForm: string;
  itemType: ItemType;
};

type ItemRow = {
  id: number | string;
  slug: string;
  primary_form: string;
  meaning: string;
  item_type: ItemType;
  sort_order: number;
};

function mapRowToListItem(row: ItemRow): CurriculumListItem {
  return {
    id: String(row.id),
    slug: row.slug,
    primaryForm: row.primary_form,
    meaning: row.meaning,
    itemType: row.item_type,
    sortOrder: row.sort_order,
  };
}

export function countItemsByLevelAndType(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
  itemType: ItemType,
): number {
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM items WHERE item_type = ? AND jlpt_level = ?`,
    itemType,
    jlptLevel,
  );
  return row?.count ?? 0;
}

export function countItemsByLevel(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
): Record<ItemType, number> {
  const rows = db.getAllSync<{ item_type: ItemType; count: number }>(
    `SELECT item_type, COUNT(*) AS count
     FROM items
     WHERE jlpt_level = ?
     GROUP BY item_type`,
    jlptLevel,
  );

  const counts: Record<ItemType, number> = {
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    grammar: 0,
  };

  for (const row of rows) {
    counts[row.item_type] = row.count;
  }

  return counts;
}

export function listItemsByLevelAndType(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
  itemType: ItemType,
): CurriculumListItem[] {
  const rows = db.getAllSync<ItemRow>(
    `SELECT id, slug, primary_form, meaning, item_type, sort_order
     FROM items
     WHERE item_type = ? AND jlpt_level = ?
     ORDER BY sort_order ASC`,
    itemType,
    jlptLevel,
  );

  return rows.map(mapRowToListItem);
}

type ItemDetailRow = {
  id: number | string;
  slug: string;
  item_type: ItemType;
  jlpt_level: JLPTLevel;
  primary_form: string;
  meaning: string;
  mnemonic_text: string | null;
  visual_mnemonic_url: string | null;
};

function mapRowToDetail(row: ItemDetailRow): CurriculumItemDetail {
  return {
    id: String(row.id),
    slug: row.slug,
    itemType: row.item_type,
    jlptLevel: row.jlpt_level,
    primaryForm: row.primary_form,
    meaning: row.meaning,
    mnemonicText: row.mnemonic_text,
    visualMnemonicUrl: row.visual_mnemonic_url,
  };
}

export function getItemById(
  db: SQLiteDatabase,
  id: string,
): CurriculumItemDetail | null {
  const row = db.getFirstSync<ItemDetailRow>(
    `SELECT id, slug, item_type, jlpt_level, primary_form, meaning, mnemonic_text, visual_mnemonic_url
     FROM items WHERE id = ?`,
    Number(id),
  );
  return row ? mapRowToDetail(row) : null;
}

type ParentRow = {
  child_item_id: number | string;
  id: number | string;
  primary_form: string;
  meaning: string;
  item_type: ItemType;
  sort_order: number;
};

function mapParentRow(row: ParentRow): CurriculumParentItem {
  return {
    id: String(row.id),
    primaryForm: row.primary_form || row.meaning,
    itemType: row.item_type,
  };
}

export function getRequiredParentLabels(
  db: SQLiteDatabase,
  itemId: string,
): string[] {
  return getRequiredParentLabelsForItems(db, [itemId]).get(itemId) ?? [];
}

export function getRequiredParentsForItems(
  db: SQLiteDatabase,
  itemIds: string[],
): Map<string, CurriculumParentItem[]> {
  const result = new Map<string, CurriculumParentItem[]>();

  if (itemIds.length === 0) {
    return result;
  }

  const numericIds = itemIds.map((itemId) => Number(itemId));
  const placeholders = numericIds.map(() => '?').join(', ');

  const rows = db.getAllSync<ParentRow>(
    `SELECT r.child_item_id, p.id, p.primary_form, p.meaning, p.item_type, p.sort_order
     FROM item_relationships r
     JOIN items p ON p.id = r.parent_item_id
     WHERE r.child_item_id IN (${placeholders}) AND r.relationship_type = 'requires'
     ORDER BY r.child_item_id ASC, p.sort_order ASC`,
    ...numericIds,
  );

  for (const row of rows) {
    const itemId = String(row.child_item_id);
    const parents = result.get(itemId) ?? [];
    parents.push(mapParentRow(row));
    result.set(itemId, parents);
  }

  return result;
}

export function getRequiredParentLabelsForItems(
  db: SQLiteDatabase,
  itemIds: string[],
): Map<string, string[]> {
  const parentsByItemId = getRequiredParentsForItems(db, itemIds);
  const result = new Map<string, string[]>();

  for (const [itemId, parents] of parentsByItemId) {
    result.set(
      itemId,
      parents.map((parent) => parent.primaryForm),
    );
  }

  return result;
}

export type KanjiReading = {
  id: string;
  readingType: 'onyomi' | 'kunyomi';
  reading: string;
  sortOrder: number;
};

export type AcceptedAnswer = {
  id: string;
  answerType: 'meaning' | 'reading' | 'production';
  answerText: string;
  isPrimary: boolean;
};

export type GrammarRule = {
  structure: string;
  conjugationRules: Record<string, unknown>;
  acceptedForms: string[];
};

export type ExampleSentence = {
  id: string;
  japanese: string;
  english: string;
  sortOrder: number;
};

export type GrammarVocabLink = {
  grammarItemId: string;
  vocabularyItemId: string;
  vocabularyPrimaryForm: string;
  vocabularyMeaning: string;
};

type KanjiReadingRow = {
  id: number | string;
  reading_type: 'onyomi' | 'kunyomi';
  reading: string;
  sort_order: number;
};

type AcceptedAnswerRow = {
  id: number | string;
  answer_type: 'meaning' | 'reading' | 'production';
  answer_text: string;
  is_primary: number;
};

type GrammarRuleRow = {
  structure: string;
  conjugation_rules: string;
  accepted_forms: string;
};

type ExampleSentenceRow = {
  id: number | string;
  japanese: string;
  english: string;
  sort_order: number;
};

type GrammarVocabLinkRow = {
  grammar_item_id: number | string;
  vocabulary_item_id: number | string;
  primary_form: string;
  meaning: string;
};

function mapKanjiReadingRow(row: KanjiReadingRow): KanjiReading {
  return {
    id: String(row.id),
    readingType: row.reading_type,
    reading: row.reading,
    sortOrder: row.sort_order,
  };
}

function mapAcceptedAnswerRow(row: AcceptedAnswerRow): AcceptedAnswer {
  return {
    id: String(row.id),
    answerType: row.answer_type,
    answerText: row.answer_text,
    isPrimary: row.is_primary === 1,
  };
}

function mapExampleSentenceRow(row: ExampleSentenceRow): ExampleSentence {
  return {
    id: String(row.id),
    japanese: row.japanese,
    english: row.english,
    sortOrder: row.sort_order,
  };
}

function mapGrammarVocabLinkRow(row: GrammarVocabLinkRow): GrammarVocabLink {
  return {
    grammarItemId: String(row.grammar_item_id),
    vocabularyItemId: String(row.vocabulary_item_id),
    vocabularyPrimaryForm: row.primary_form,
    vocabularyMeaning: row.meaning,
  };
}

export function getKanjiReadings(
  db: SQLiteDatabase,
  itemId: string,
): KanjiReading[] {
  const rows = db.getAllSync<KanjiReadingRow>(
    `SELECT id, reading_type, reading, sort_order FROM kanji_readings WHERE item_id = ? ORDER BY sort_order ASC`,
    Number(itemId),
  );
  return rows.map(mapKanjiReadingRow);
}

export function getAcceptedAnswers(
  db: SQLiteDatabase,
  itemId: string,
): AcceptedAnswer[] {
  const rows = db.getAllSync<AcceptedAnswerRow>(
    `SELECT id, answer_type, answer_text, is_primary FROM accepted_answers WHERE item_id = ? ORDER BY is_primary DESC, id ASC`,
    Number(itemId),
  );
  return rows.map(mapAcceptedAnswerRow);
}

export function getGrammarRule(
  db: SQLiteDatabase,
  itemId: string,
): GrammarRule | null {
  const row = db.getFirstSync<GrammarRuleRow>(
    `SELECT structure, conjugation_rules, accepted_forms FROM grammar_rules WHERE item_id = ?`,
    Number(itemId),
  );
  if (!row) {
    return null;
  }
  return {
    structure: row.structure,
    conjugationRules: JSON.parse(row.conjugation_rules) as Record<string, unknown>,
    acceptedForms: JSON.parse(row.accepted_forms) as string[],
  };
}

export function getExampleSentences(
  db: SQLiteDatabase,
  itemId: string,
): ExampleSentence[] {
  const rows = db.getAllSync<ExampleSentenceRow>(
    `SELECT id, japanese, english, sort_order FROM example_sentences WHERE item_id = ? ORDER BY sort_order ASC`,
    Number(itemId),
  );
  return rows.map(mapExampleSentenceRow);
}

export function getGrammarLinksForVocab(
  db: SQLiteDatabase,
  vocabItemId: string,
): GrammarVocabLink[] {
  const rows = db.getAllSync<GrammarVocabLinkRow>(
    `SELECT gvl.grammar_item_id, gvl.vocabulary_item_id, i.primary_form, i.meaning
     FROM grammar_vocabulary_links gvl
     JOIN items i ON i.id = gvl.grammar_item_id
     WHERE gvl.vocabulary_item_id = ?
     ORDER BY i.sort_order ASC`,
    Number(vocabItemId),
  );
  return rows.map(mapGrammarVocabLinkRow);
}
