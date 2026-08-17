import type { SQLiteDatabase } from 'expo-sqlite';

import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import type { RelatedItem } from '@/core/content/content.types';
import { WORD_INFLECTIONS, type WordInflection } from '@/core/content/inflection';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';
import { chunkForSqlVariables } from '@/data/sqlChunk';

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
  /** Annotated (JmdictFurigana bracket notation) form. Vocabulary only, else null. */
  furigana: string | null;
  meaning: string;
  /**
   * Single-blob mnemonic (pre-Rev-1 content). Rendered only when the split
   * fields below are absent — never merged with them.
   */
  mnemonicText: string | null;
  /** Split WaniKani-style mnemonics (content pipeline Rev 1); kanji + vocabulary. */
  meaningMnemonic: string | null;
  readingMnemonic: string | null;
  /**
   * Meaning nuance, glyph description and look-alike contrasts (Rev 1). On
   * radicals it is the story the Tier 2 image is generated from.
   */
  description: string | null;
  visualMnemonicUrl: string | null;
};

export type CurriculumParentItem = {
  id: string;
  primaryForm: string;
  itemType: ItemType;
  /**
   * Display only — the gloss under a "built from" / "kanji in this word" tile.
   * Already selected by the parent query, so it costs nothing extra, and it
   * takes no part in dependency, lock or ordering logic. Optional because the
   * dependency graph builds parents from ids alone and has no gloss to give.
   */
  meaning?: string;
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

/**
 * Levels that actually ship content, in curriculum order. Levels authored later
 * simply appear here once their vocabulary exists — nothing to update by hand.
 *
 * Grammar is the test, not any item at all. N3/N2/N1 ship a derived skeleton —
 * kanji, radicals and 8,500 words with readings and meanings, but no mnemonics,
 * no examples, no grammar and no passages (plan v2 Phase D). Grammar is the one
 * kind only a full-content level has, so it is what separates a level a learner
 * may *start* on from one the ladder merely continues into. Vocabulary was that
 * test until Phase D gave every level words.
 */
export function listLevelsWithContent(db: SQLiteDatabase): JLPTLevel[] {
  const rows = db.getAllSync<{ jlpt_level: JLPTLevel }>(
    `SELECT DISTINCT jlpt_level FROM items WHERE item_type = 'grammar'`,
  );
  const present = new Set(rows.map((row) => row.jlpt_level));
  return JLPT_LEVELS.filter((level) => present.has(level));
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
  furigana: string | null;
  meaning: string;
  mnemonic_text: string | null;
  meaning_mnemonic: string | null;
  reading_mnemonic: string | null;
  description: string | null;
  visual_mnemonic_url: string | null;
};

function mapRowToDetail(row: ItemDetailRow): CurriculumItemDetail {
  return {
    id: String(row.id),
    slug: row.slug,
    itemType: row.item_type,
    jlptLevel: row.jlpt_level,
    primaryForm: row.primary_form,
    furigana: row.furigana ?? null,
    meaning: row.meaning,
    mnemonicText: row.mnemonic_text,
    meaningMnemonic: row.meaning_mnemonic ?? null,
    readingMnemonic: row.reading_mnemonic ?? null,
    description: row.description ?? null,
    visualMnemonicUrl: row.visual_mnemonic_url,
  };
}

export function getItemById(
  db: SQLiteDatabase,
  id: string,
): CurriculumItemDetail | null {
  const row = db.getFirstSync<ItemDetailRow>(
    `SELECT id, slug, item_type, jlpt_level, primary_form, furigana, meaning, mnemonic_text,
            meaning_mnemonic, reading_mnemonic, description, visual_mnemonic_url
     FROM items WHERE id = ?`,
    Number(id),
  );
  return row ? mapRowToDetail(row) : null;
}

/**
 * The same lookup as `getItemById`, keyed on the authored slug.
 *
 * App code that names a specific curriculum item (the day-1 guidance cards,
 * FR-Epic-7) must reference it by slug: integer ids are assigned by the compile
 * step and shift on recompile or a curriculum OTA, while slugs are authored and
 * stable. `(item_type, slug)` is unique in the schema.
 */
export function getItemBySlug(
  db: SQLiteDatabase,
  itemType: ItemType,
  slug: string,
): CurriculumItemDetail | null {
  const row = db.getFirstSync<ItemDetailRow>(
    `SELECT id, slug, item_type, jlpt_level, primary_form, furigana, meaning, mnemonic_text,
            meaning_mnemonic, reading_mnemonic, description, visual_mnemonic_url
     FROM items WHERE item_type = ? AND slug = ?`,
    itemType,
    slug,
  );
  return row ? mapRowToDetail(row) : null;
}

/**
 * Compact labels for a set of item ids, in the order the ids were given.
 *
 * Used by the locked passage to-do list (FR69), which needs a surface form,
 * meaning and type accent for each still-needed vocab/grammar item without
 * paying for a full `getItemById` per row.
 */
export function listItemSummariesByIds(
  db: SQLiteDatabase,
  itemIds: string[],
): CurriculumListItem[] {
  if (itemIds.length === 0) return [];

  const numericIds = itemIds.map((id) => Number(id));
  const byId = new Map<string, CurriculumListItem>();

  for (const chunk of chunkForSqlVariables(numericIds)) {
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = db.getAllSync<ItemRow>(
      `SELECT id, slug, primary_form, meaning, item_type, sort_order
       FROM items WHERE id IN (${placeholders})`,
      ...chunk,
    );
    for (const row of rows) {
      byId.set(String(row.id), mapRowToListItem(row));
    }
  }

  return itemIds
    .map((id) => byId.get(id))
    .filter((item): item is CurriculumListItem => item !== undefined);
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
    meaning: row.meaning,
  };
}

function getParentsByRelationshipType(
  db: SQLiteDatabase,
  itemIds: string[],
  relationshipType: 'requires' | 'builds_on' | 'reinforces',
): Map<string, CurriculumParentItem[]> {
  const result = new Map<string, CurriculumParentItem[]>();

  if (itemIds.length === 0) {
    return result;
  }

  const numericIds = itemIds.map((itemId) => Number(itemId));

  // One `?` is spent on relationshipType. The lesson candidate pool asks about
  // a whole level plus its pulled-forward parents at once, which is well past
  // the bound-parameter limit.
  for (const chunk of chunkForSqlVariables(numericIds, 1)) {
    const placeholders = chunk.map(() => '?').join(', ');

    const rows = db.getAllSync<ParentRow>(
      `SELECT r.child_item_id, p.id, p.primary_form, p.meaning, p.item_type, p.sort_order
       FROM item_relationships r
       JOIN items p ON p.id = r.parent_item_id
       WHERE r.child_item_id IN (${placeholders}) AND r.relationship_type = ?
       ORDER BY r.child_item_id ASC, p.sort_order ASC`,
      ...chunk,
      relationshipType,
    );

    for (const row of rows) {
      const itemId = String(row.child_item_id);
      const parents = result.get(itemId) ?? [];
      parents.push(mapParentRow(row));
      result.set(itemId, parents);
    }
  }

  return result;
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
  return getParentsByRelationshipType(db, itemIds, 'requires');
}

/**
 * Everything the lesson planner may offer while the learner is on `jlptLevel`:
 * that level's own items, and nothing else.
 *
 * Plan v2 Phase C dropped the pull-forward walk that used to add a word's
 * out-of-level `requires` parents to the pool. It is no longer needed, and it
 * would now be harmful: `generate_deps.py` emits `requires` only from a kanji
 * banded at or before the word's level, so every gate an item carries is one
 * this level (or an earlier, already-studied one) teaches. A kanji from a later
 * band — 写 at N3 in the N5 word 写真 — holds a non-gating `builds_on` edge
 * instead, and the word ships on schedule, asked for its meaning until that
 * kanji reaches guru. See docs/content/kanji-coverage-and-dependency-order-plan.md.
 *
 * Radicals need no pull-forward either: Phase A re-filed every radical to the
 * level of the first kanji that needs it, so a component of an N5 kanji is an
 * N5 item.
 */
export function listLessonCandidatePool(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
): CurriculumListItem[] {
  const pool: CurriculumListItem[] = [];
  for (const itemType of ITEM_TYPES) {
    pool.push(...listItemsByLevelAndType(db, jlptLevel, itemType));
  }
  return pool;
}

/**
 * Graph parents for FR72 component chips ("Built from" / "Kanji in this word").
 *
 * Vocabulary reads both kanji → vocabulary edges: `requires` for the in-band
 * kanji and `builds_on` for the later-band ones. The chips answer "what is this
 * word written with", which does not depend on whether the kanji gates the
 * word — dropping the non-gating half would leave 写真 with no components at
 * all. In-band first, then out-of-band; each group in curriculum order.
 *
 * Kanji components use `builds_on` (radical → kanji) — not `requires`, which
 * the curriculum never authors for that edge.
 */
export function getComponentParentsForItem(
  db: SQLiteDatabase,
  itemId: string,
  itemType: ItemType,
): CurriculumParentItem[] {
  if (itemType === 'vocabulary') {
    return [
      ...(getRequiredParentsForItems(db, [itemId]).get(itemId) ?? []),
      ...(getParentsByRelationshipType(db, [itemId], 'builds_on').get(itemId) ?? []),
    ];
  }
  if (itemType === 'kanji') {
    return getParentsByRelationshipType(db, [itemId], 'builds_on').get(itemId) ?? [];
  }
  return [];
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

export type GrammarFamily =
  | 'particles'
  | 'copula'
  | 'conjugations'
  | 'connectors'
  | 'patterns';

export type GrammarRule = {
  structure: string;
  conjugationRules: Record<string, unknown>;
  acceptedForms: string[];
  /** Distractor namespace (Plan 09); null on curriculum DBs compiled before it existed. */
  family: GrammarFamily | null;
  /** Long-form lesson body (content pipeline Phase 0); null when unauthored or on older DBs. */
  explanationMarkdown: string | null;
  /** "Watch out" notes; [] when unauthored or on older DBs. */
  cautionNotes: string[];
};

/** Sibling/contrast grammar point linked from a lesson (content pipeline Phase 0). */
export type RelatedGrammarItem = {
  id: string;
  primaryForm: string;
  meaning: string;
};

/** Authored review-specific cloze variant (Plan 09). */
export type GrammarClozeVariant = {
  id: string;
  /** JP sentence with the grammar chunk replaced by ＿＿＿. */
  jpCloze: string;
  /**
   * Bracket-notation cloze with blank preserved (Plan 11.8). Null when the
   * variant was authored without furigana.
   */
  jpClozeFurigana: string | null;
  /** Full-sentence English — hint rung 2, never on-card by default. */
  english: string;
  /** The chunk the blank expects; aligns with accepted_forms. */
  answer: string;
  /** Short pedagogical poke — hint rung 1. */
  nudge: string;
  sortOrder: number;
};

export type ExampleSentenceVocabLink = {
  itemId: string;
  primaryForm: string;
};

export type ExampleSentence = {
  id: string;
  japanese: string;
  furigana: string | null;
  english: string;
  sortOrder: number;
  /** Authored vocab links (Plan 11.6); empty when the sentence has none. */
  vocabularyLinks: ExampleSentenceVocabLink[];
  /**
   * Compile-time word spans over `japanese` (14.1a) — every occurrence of a
   * linked word, dictionary form and taught inflection alike, in body order.
   * Empty when the sentence has none.
   */
  spans: PassageWordSpan[];
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
  furigana: string | null;
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

type ExampleSentenceVocabRow = {
  sentence_id: number | string;
  item_id: number | string;
  primary_form: string;
};

type ExampleSentenceSpanRow = {
  sentence_id: number | string;
  item_id: number | string;
  start_offset: number;
  end_offset: number;
  inflection: WordInflection | null;
};

function mapExampleSentenceRow(
  row: ExampleSentenceRow,
  vocabularyLinks: ExampleSentenceVocabLink[],
  spans: PassageWordSpan[],
): ExampleSentence {
  return {
    id: String(row.id),
    japanese: row.japanese,
    furigana: row.furigana ?? null,
    english: row.english,
    sortOrder: row.sort_order,
    vocabularyLinks,
    spans,
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

export type AcceptedAnswerMatch = {
  itemId: string;
  primaryForm: string;
  itemType: ItemType;
  /** The stored answer text that matched, for caller-side normalized verification. */
  answerText: string;
};

type AcceptedAnswerMatchRow = {
  item_id: number | string;
  primary_form: string;
  item_type: ItemType;
  answer_text: string;
};

/**
 * Finds curriculum items (other than `excludeItemId`) whose accepted answer
 * matches one of `candidates` — the answer-collision lookup (FR86). Exact
 * lowercase SQL matching keeps this on the sync fast path (NFR1); callers
 * re-verify hits with the JS normalization helpers. For readings, kanji
 * on'yomi/kun'yomi rows are searched in addition to `accepted_answers`.
 */
export function findItemsByAcceptedAnswer(
  db: SQLiteDatabase,
  answerType: 'meaning' | 'reading',
  candidates: string[],
  excludeItemId: string,
): AcceptedAnswerMatch[] {
  const lowered = [...new Set(candidates.map((c) => c.trim().toLowerCase()).filter(Boolean))];
  if (lowered.length === 0) {
    return [];
  }
  const placeholders = lowered.map(() => '?').join(', ');

  const rows = db.getAllSync<AcceptedAnswerMatchRow>(
    `SELECT aa.item_id, aa.answer_text, i.primary_form, i.item_type
     FROM accepted_answers aa
     JOIN items i ON i.id = aa.item_id
     WHERE aa.answer_type = ? AND aa.item_id != ? AND lower(aa.answer_text) IN (${placeholders})`,
    answerType,
    Number(excludeItemId),
    ...lowered,
  );

  const readingRows =
    answerType === 'reading'
      ? db.getAllSync<AcceptedAnswerMatchRow>(
          `SELECT kr.item_id, kr.reading AS answer_text, i.primary_form, i.item_type
           FROM kanji_readings kr
           JOIN items i ON i.id = kr.item_id
           WHERE kr.item_id != ? AND lower(kr.reading) IN (${placeholders})`,
          Number(excludeItemId),
          ...lowered,
        )
      : [];

  const seen = new Set<string>();
  const matches: AcceptedAnswerMatch[] = [];
  for (const row of [...rows, ...readingRows]) {
    const itemId = String(row.item_id);
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    matches.push({
      itemId,
      primaryForm: row.primary_form,
      itemType: row.item_type,
      answerText: row.answer_text,
    });
  }
  return matches;
}

function parseCautionNotes(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((note): note is string => typeof note === 'string') : [];
  } catch {
    return [];
  }
}

type OptionalGrammarColumns = {
  family?: string | null;
  explanation_markdown?: string | null;
  caution_notes?: string | null;
};

export function getGrammarRule(
  db: SQLiteDatabase,
  itemId: string,
): GrammarRule | null {
  // Newer columns arrived over time (`family` in Plan 09,
  // `explanation_markdown`/`caution_notes` in the content pipeline Phase 0);
  // installed devices may still carry a curriculum.db compiled before any of
  // them existed, so fall back column set by column set.
  const columnVariants = [
    `structure, conjugation_rules, accepted_forms, family, explanation_markdown, caution_notes`,
    `structure, conjugation_rules, accepted_forms, family`,
    `structure, conjugation_rules, accepted_forms`,
  ];

  let row: (GrammarRuleRow & OptionalGrammarColumns) | null = null;
  for (const columns of columnVariants) {
    try {
      row = db.getFirstSync<GrammarRuleRow & OptionalGrammarColumns>(
        `SELECT ${columns} FROM grammar_rules WHERE item_id = ?`,
        Number(itemId),
      );
      break;
    } catch {
      // Missing column on an older DB — retry with the previous column set.
    }
  }
  if (!row) {
    return null;
  }
  return {
    structure: row.structure,
    conjugationRules: JSON.parse(row.conjugation_rules) as Record<string, unknown>,
    acceptedForms: JSON.parse(row.accepted_forms) as string[],
    family: (row.family as GrammarFamily | undefined) ?? null,
    explanationMarkdown: row.explanation_markdown ?? null,
    cautionNotes: parseCautionNotes(row.caution_notes),
  };
}

/**
 * Related grammar points for a lesson's contrast/see-also section, in
 * authored order. Returns [] on curriculum DBs compiled before the
 * grammar_related_links table existed.
 */
export function getRelatedGrammarItems(
  db: SQLiteDatabase,
  itemId: string,
): RelatedGrammarItem[] {
  try {
    const rows = db.getAllSync<{ id: number | string; primary_form: string; meaning: string }>(
      `SELECT i.id, i.primary_form, i.meaning
       FROM grammar_related_links grl
       JOIN items i ON i.id = grl.related_item_id
       WHERE grl.grammar_item_id = ?
       ORDER BY grl.sort_order ASC`,
      Number(itemId),
    );
    return rows.map((row) => ({
      id: String(row.id),
      primaryForm: row.primary_form,
      meaning: row.meaning,
    }));
  } catch {
    return [];
  }
}

/** Data-derived look-alike of a radical/kanji (content pipeline Rev 1). */
export type VisuallySimilarItem = {
  id: string;
  primaryForm: string;
  meaning: string;
  itemType: ItemType;
};

/**
 * Look-alikes for a radical/kanji, in authored order. Returns [] on curriculum
 * DBs compiled before the visually_similar_links table existed.
 */
export function getVisuallySimilarItems(
  db: SQLiteDatabase,
  itemId: string,
): VisuallySimilarItem[] {
  try {
    const rows = db.getAllSync<{
      id: number | string;
      primary_form: string;
      meaning: string;
      item_type: ItemType;
    }>(
      `SELECT i.id, i.primary_form, i.meaning, i.item_type
       FROM visually_similar_links vsl
       JOIN items i ON i.id = vsl.similar_item_id
       WHERE vsl.item_id = ?
       ORDER BY vsl.sort_order ASC`,
      Number(itemId),
    );
    return rows.map((row) => ({
      id: String(row.id),
      primaryForm: row.primary_form,
      meaning: row.meaning,
      itemType: row.item_type,
    }));
  } catch {
    return [];
  }
}

/**
 * Authored cloze variants for a grammar item (Plan 09), in sort order.
 * Returns [] on curriculum DBs compiled before the table existed — callers
 * fall back to the Plan 07 sentence-derived cloze.
 */
export function getGrammarClozeVariants(
  db: SQLiteDatabase,
  itemId: string,
): GrammarClozeVariant[] {
  try {
    const rows = db.getAllSync<{
      id: number | string;
      jp_cloze: string;
      jp_cloze_furigana: string | null;
      english: string;
      answer: string;
      nudge: string;
      sort_order: number;
    }>(
      `SELECT id, jp_cloze, jp_cloze_furigana, english, answer, nudge, sort_order
       FROM grammar_cloze_variants WHERE item_id = ? ORDER BY sort_order ASC`,
      Number(itemId),
    );
    return rows.map((row) => ({
      id: String(row.id),
      jpCloze: row.jp_cloze,
      jpClozeFurigana: row.jp_cloze_furigana ?? null,
      english: row.english,
      answer: row.answer,
      nudge: row.nudge,
      sortOrder: row.sort_order,
    }));
  } catch {
    return [];
  }
}

/**
 * Accepted forms of *other* grammar points, for MC distractors (Plan 08):
 * same-family forms first (when this item has a family), then same-JLPT-level
 * forms as the fallback pool. Forms are the parsed accepted_forms entries.
 */
export function getGrammarDistractorPools(
  db: SQLiteDatabase,
  itemId: string,
): { familyForms: string[]; levelForms: string[] } {
  const parseForms = (rows: { accepted_forms: string }[]): string[] => {
    const forms: string[] = [];
    for (const row of rows) {
      try {
        forms.push(...(JSON.parse(row.accepted_forms) as string[]));
      } catch {
        // Skip malformed rows — distractors are best-effort.
      }
    }
    return [...new Set(forms)];
  };

  let familyForms: string[] = [];
  try {
    const familyRows = db.getAllSync<{ accepted_forms: string }>(
      `SELECT gr.accepted_forms FROM grammar_rules gr
       WHERE gr.item_id != ?
         AND gr.family IS NOT NULL
         AND gr.family = (SELECT family FROM grammar_rules WHERE item_id = ?)`,
      Number(itemId),
      Number(itemId),
    );
    familyForms = parseForms(familyRows);
  } catch {
    // Pre-Plan-09 DB without the family column.
  }

  const levelRows = db.getAllSync<{ accepted_forms: string }>(
    `SELECT gr.accepted_forms FROM grammar_rules gr
     JOIN items i ON i.id = gr.item_id
     WHERE gr.item_id != ?
       AND i.jlpt_level = (SELECT jlpt_level FROM items WHERE id = ?)`,
    Number(itemId),
    Number(itemId),
  );

  return { familyForms, levelForms: parseForms(levelRows) };
}

export function getExampleSentences(
  db: SQLiteDatabase,
  itemId: string,
): ExampleSentence[] {
  const rows = db.getAllSync<ExampleSentenceRow>(
    `SELECT id, japanese, furigana, english, sort_order FROM example_sentences WHERE item_id = ? ORDER BY sort_order ASC`,
    Number(itemId),
  );
  if (rows.length === 0) {
    return [];
  }

  const linksBySentence = new Map<string, ExampleSentenceVocabLink[]>();
  try {
    const placeholders = rows.map(() => '?').join(', ');
    const linkRows = db.getAllSync<ExampleSentenceVocabRow>(
      `SELECT esv.sentence_id, esv.item_id, i.primary_form
       FROM example_sentence_vocab esv
       JOIN items i ON i.id = esv.item_id
       WHERE esv.sentence_id IN (${placeholders})
       ORDER BY esv.sort_order ASC`,
      ...rows.map((row) => Number(row.id)),
    );
    for (const link of linkRows) {
      const sentenceId = String(link.sentence_id);
      const list = linksBySentence.get(sentenceId) ?? [];
      list.push({
        itemId: String(link.item_id),
        primaryForm: link.primary_form,
      });
      linksBySentence.set(sentenceId, list);
    }
  } catch {
    // Pre-Plan-11.6 DB without the example_sentence_vocab table.
  }

  const spansBySentence = new Map<string, PassageWordSpan[]>();
  try {
    const placeholders = rows.map(() => '?').join(', ');
    const spanRows = db.getAllSync<ExampleSentenceSpanRow>(
      `SELECT sentence_id, item_id, start_offset, end_offset, inflection
       FROM example_sentence_spans
       WHERE sentence_id IN (${placeholders})
       ORDER BY sort_order ASC`,
      ...rows.map((row) => Number(row.id)),
    );
    for (const span of spanRows) {
      const sentenceId = String(span.sentence_id);
      const list = spansBySentence.get(sentenceId) ?? [];
      list.push({
        vocabularyItemId: String(span.item_id),
        startOffset: span.start_offset,
        endOffset: span.end_offset,
        inflection: span.inflection ?? null,
      });
      spansBySentence.set(sentenceId, list);
    }
  } catch {
    // Pre-14.1a DB without the example_sentence_spans table: the sentence
    // renders as plain text until the curriculum update lands.
  }

  return rows.map((row) =>
    mapExampleSentenceRow(
      row,
      linksBySentence.get(String(row.id)) ?? [],
      spansBySentence.get(String(row.id)) ?? [],
    ),
  );
}

export type TaughtConjugatedForm = {
  inflection: WordInflection;
  /** One representative surface, sliced from the sentence it occurs in. */
  surface: string;
};

/**
 * The taught inflections of a word that the curriculum actually shows it in
 * (14.1) — one representative surface per category, in teaching order.
 *
 * Deliberately not a generated paradigm: the list is what the learner will
 * meet in the examples, so a word with no conjugated usage lists nothing.
 */
export function getTaughtConjugatedForms(
  db: SQLiteDatabase,
  itemId: string,
): TaughtConjugatedForm[] {
  let rows: (ExampleSentenceSpanRow & { japanese: string })[];
  try {
    rows = db.getAllSync<ExampleSentenceSpanRow & { japanese: string }>(
      `SELECT sp.inflection, sp.start_offset, sp.end_offset, es.japanese
       FROM example_sentence_spans sp
       JOIN example_sentences es ON es.id = sp.sentence_id
       WHERE sp.item_id = ? AND sp.inflection IS NOT NULL
       ORDER BY sp.sentence_id ASC, sp.sort_order ASC`,
      Number(itemId),
    );
  } catch {
    // Pre-14.1a DB without the example_sentence_spans table.
    return [];
  }

  const surfaceByInflection = new Map<WordInflection, string>();
  for (const row of rows) {
    if (!row.inflection || surfaceByInflection.has(row.inflection)) continue;
    const surface = row.japanese.slice(row.start_offset, row.end_offset);
    if (surface) {
      surfaceByInflection.set(row.inflection, surface);
    }
  }

  return WORD_INFLECTIONS.filter((inflection) => surfaceByInflection.has(inflection)).map(
    (inflection) => ({ inflection, surface: surfaceByInflection.get(inflection) as string }),
  );
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

type RelatedItemRow = {
  parent_item_id: number | string;
  id: number | string;
  primary_form: string;
  meaning: string;
  item_type: ItemType;
  relationship_type: 'requires' | 'builds_on' | 'reinforces';
};

function mapRelatedItemRow(row: RelatedItemRow): RelatedItem {
  return {
    id: String(row.id),
    itemType: row.item_type,
    primaryForm: row.primary_form,
    meaning: row.meaning,
    relationshipType: row.relationship_type,
  };
}

/**
 * Returns graph children/targets for reviewed items (parent → child traversal).
 * Used for reinforcement display and related-item boosts.
 */
export function getRelatedItemsForItems(
  db: SQLiteDatabase,
  itemIds: string[],
): Map<string, RelatedItem[]> {
  const result = new Map<string, RelatedItem[]>();

  if (itemIds.length === 0) {
    return result;
  }

  const numericIds = itemIds.map((itemId) => Number(itemId));
  const placeholders = numericIds.map(() => '?').join(', ');

  const rows = db.getAllSync<RelatedItemRow>(
    `SELECT r.parent_item_id, c.id, c.primary_form, c.meaning, c.item_type, r.relationship_type
     FROM item_relationships r
     JOIN items c ON c.id = r.child_item_id
     WHERE r.parent_item_id IN (${placeholders})
       AND r.relationship_type IN ('builds_on', 'reinforces', 'requires')
     ORDER BY r.parent_item_id ASC, c.sort_order ASC`,
    ...numericIds,
  );

  for (const row of rows) {
    const parentId = String(row.parent_item_id);
    const related = result.get(parentId) ?? [];
    related.push(mapRelatedItemRow(row));
    result.set(parentId, related);
  }

  return result;
}
