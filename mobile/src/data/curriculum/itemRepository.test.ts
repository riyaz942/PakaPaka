import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetAcceptedAnswers,
  __mockSetExampleSentences,
  __mockSetGrammarRelatedLinks,
  __mockSetGrammarRules,
  __mockSetGrammarVocabLinks,
  __mockSetItemRelationships,
  __mockSetItems,
  __mockSetKanjiReadings,
  __mockSetVisuallySimilarLinks,
} from '../../../__mocks__/expo-sqlite';

import {
  countItemsByLevel,
  countItemsByLevelAndType,
  findItemsByAcceptedAnswer,
  getAcceptedAnswers,
  getComponentParentsForItem,
  getExampleSentences,
  getGrammarLinksForVocab,
  getGrammarRule,
  getItemById,
  getKanjiReadings,
  getRequiredParentLabels,
  getRequiredParentLabelsForItems,
  getRequiredParentsForItems,
  getRelatedGrammarItems,
  getRelatedItemsForItems,
  getVisuallySimilarItems,
  ITEM_TYPES,
  listItemsByLevelAndType,
} from '@/data/curriculum/itemRepository';

const N5_COUNTS: Record<(typeof ITEM_TYPES)[number], number> = {
  radical: 25,
  kanji: 32,
  vocabulary: 41,
  grammar: 16,
};

function buildN5Items() {
  const items = [];
  let id = 1;

  for (const itemType of ITEM_TYPES) {
    const count = N5_COUNTS[itemType];
    for (let index = 0; index < count; index += 1) {
      items.push({
        id,
        item_type: itemType,
        jlpt_level: 'N5',
        slug: `${itemType}-${id}`,
        primary_form: `${itemType}-${id}`,
        meaning: `meaning-${id}`,
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: index + 1,
      });
      id += 1;
    }
  }

  return items;
}

describe('itemRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('returns N5 items per type ordered by sort_order', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', buildN5Items());

    for (const itemType of ITEM_TYPES) {
      const items = listItemsByLevelAndType(db, 'N5', itemType);
      expect(items).toHaveLength(N5_COUNTS[itemType]);
      expect(items[0]?.itemType).toBe(itemType);
      expect(items[0]?.sortOrder).toBe(1);
      expect(items.at(-1)?.sortOrder).toBe(N5_COUNTS[itemType]);
    }
  });

  it('returns count by level and type without loading full lists', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', buildN5Items());

    for (const itemType of ITEM_TYPES) {
      expect(countItemsByLevelAndType(db, 'N5', itemType)).toBe(N5_COUNTS[itemType]);
    }

    const batchCounts = countItemsByLevel(db, 'N5');
    expect(batchCounts).toEqual(N5_COUNTS);
  });

  it('returns required parent labels for single and batched kanji ids', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '日',
        meaning: 'sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 11,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'book',
        primary_form: '本',
        meaning: 'book',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        child_item_id: 10,
        parent_item_id: 1,
        relationship_type: 'requires',
      },
    ]);

    expect(getRequiredParentLabels(db, '10')).toEqual(['日']);
    expect(getRequiredParentLabelsForItems(db, ['10', '11']).get('10')).toEqual(['日']);
    expect(getRequiredParentLabelsForItems(db, ['10', '11']).has('11')).toBe(false);
  });

  it('returns item detail by id', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'one',
        primary_form: '一',
        meaning: 'one',
        mnemonic_text: 'Radical one (一)',
        visual_mnemonic_url: 'https://example.com/one.png',
        sort_order: 1,
      },
    ]);

    const detail = getItemById(db, '1');
    expect(detail).toEqual({
      id: '1',
      slug: 'one',
      itemType: 'radical',
      jlptLevel: 'N5',
      primaryForm: '一',
      furigana: null,
      meaning: 'one',
      mnemonicText: 'Radical one (一)',
      meaningMnemonic: null,
      readingMnemonic: null,
      description: null,
      visualMnemonicUrl: 'https://example.com/one.png',
    });
    expect(getItemById(db, '999')).toBeNull();
  });

  it('returns required parents with ids for batched kanji ids', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '日',
        meaning: 'sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'mouth',
        primary_form: '口',
        meaning: 'mouth',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        child_item_id: 10,
        parent_item_id: 1,
        relationship_type: 'requires',
      },
      {
        child_item_id: 10,
        parent_item_id: 2,
        relationship_type: 'requires',
      },
    ]);

    const parents = getRequiredParentsForItems(db, ['10']);
    expect(parents.get('10')).toEqual([
      { id: '1', primaryForm: '日', itemType: 'radical' },
      { id: '2', primaryForm: '口', itemType: 'radical' },
    ]);
  });

  it('returns builds_on radical parents for kanji component chips', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '日',
        meaning: 'sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        child_item_id: 10,
        parent_item_id: 1,
        relationship_type: 'builds_on',
      },
    ]);

    expect(getComponentParentsForItem(db, '10', 'kanji')).toEqual([
      { id: '1', primaryForm: '日', itemType: 'radical' },
    ]);
    expect(getRequiredParentsForItems(db, ['10']).get('10')).toBeUndefined();
  });

  it('returns kanji readings ordered by sort_order', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetKanjiReadings('curriculum.db.test', [
      {
        id: 1,
        item_id: 10,
        reading_type: 'onyomi',
        reading: 'ニチ',
        sort_order: 1,
      },
      {
        id: 2,
        item_id: 10,
        reading_type: 'kunyomi',
        reading: 'ひ',
        sort_order: 2,
      },
    ]);

    expect(getKanjiReadings(db, '10')).toEqual([
      { id: '1', readingType: 'onyomi', reading: 'ニチ', sortOrder: 1 },
      { id: '2', readingType: 'kunyomi', reading: 'ひ', sortOrder: 2 },
    ]);
  });

  it('returns accepted answers with primary first', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetAcceptedAnswers('curriculum.db.test', [
      {
        id: 2,
        item_id: 10,
        answer_type: 'meaning',
        answer_text: 'sun',
        is_primary: 0,
      },
      {
        id: 1,
        item_id: 10,
        answer_type: 'meaning',
        answer_text: 'day',
        is_primary: 1,
      },
    ]);

    expect(getAcceptedAnswers(db, '10')).toEqual([
      { id: '1', answerType: 'meaning', answerText: 'day', isPrimary: true },
      { id: '2', answerType: 'meaning', answerText: 'sun', isPrimary: false },
    ]);
  });

  it('returns grammar rule with parsed JSON fields', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetGrammarRules('curriculum.db.test', [
      {
        id: 1,
        item_id: 50,
        structure: 'Noun + です',
        conjugation_rules: '{"polite": true}',
        accepted_forms: '["です", "だ"]',
      },
    ]);

    expect(getGrammarRule(db, '50')).toEqual({
      structure: 'Noun + です',
      conjugationRules: { polite: true },
      acceptedForms: ['です', 'だ'],
      family: null,
      explanationMarkdown: null,
      cautionNotes: [],
    });
    expect(getGrammarRule(db, '999')).toBeNull();
  });

  it('returns grammar rule lesson fields when present', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetGrammarRules('curriculum.db.test', [
      {
        id: 1,
        item_id: 50,
        structure: 'Noun + です',
        conjugation_rules: '{"polite": true}',
        accepted_forms: '["です"]',
        family: 'copula',
        explanation_markdown: '# です\n\nThe polite copula.',
        caution_notes: '["Never attaches directly to verbs."]',
      },
    ]);

    expect(getGrammarRule(db, '50')).toEqual({
      structure: 'Noun + です',
      conjugationRules: { polite: true },
      acceptedForms: ['です'],
      family: 'copula',
      explanationMarkdown: '# です\n\nThe polite copula.',
      cautionNotes: ['Never attaches directly to verbs.'],
    });
  });

  it('returns the Rev 1 split mnemonics and description on item detail', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'east',
        primary_form: '東',
        meaning: 'east',
        mnemonic_text: null,
        meaning_mnemonic: 'The sun rises through the tree in the east.',
        reading_mnemonic: 'とう like a tow truck heading east.',
        description: 'Used in 東京. Do not confuse it with 車.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    const detail = getItemById(db, '10');
    expect(detail?.meaningMnemonic).toBe('The sun rises through the tree in the east.');
    expect(detail?.readingMnemonic).toBe('とう like a tow truck heading east.');
    expect(detail?.description).toBe('Used in 東京. Do not confuse it with 車.');
    expect(detail?.mnemonicText).toBeNull();
  });

  it('returns visually similar items in authored order', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 60,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'person',
        primary_form: '人',
        meaning: 'person',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 61,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'enter',
        primary_form: '入',
        meaning: 'enter',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 62,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'eight',
        primary_form: '八',
        meaning: 'eight',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 3,
      },
    ]);
    __mockSetVisuallySimilarLinks('curriculum.db.test', [
      { id: 1, item_id: 60, similar_item_id: 62, sort_order: 1 },
      { id: 2, item_id: 60, similar_item_id: 61, sort_order: 0 },
      { id: 3, item_id: 61, similar_item_id: 60, sort_order: 0 },
    ]);

    expect(getVisuallySimilarItems(db, '60')).toEqual([
      { id: '61', primaryForm: '入', meaning: 'enter', itemType: 'kanji' },
      { id: '62', primaryForm: '八', meaning: 'eight', itemType: 'radical' },
    ]);
    expect(getVisuallySimilarItems(db, '62')).toEqual([]);
  });

  it('returns related grammar items in authored order', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 51,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'ja-nai',
        primary_form: 'じゃない',
        meaning: 'negative copula',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 52,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'deshita',
        primary_form: 'でした',
        meaning: 'past copula',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 3,
      },
    ]);
    __mockSetGrammarRelatedLinks('curriculum.db.test', [
      { id: 1, grammar_item_id: 50, related_item_id: 52, sort_order: 1 },
      { id: 2, grammar_item_id: 50, related_item_id: 51, sort_order: 0 },
      { id: 3, grammar_item_id: 99, related_item_id: 51, sort_order: 0 },
    ]);

    expect(getRelatedGrammarItems(db, '50')).toEqual([
      { id: '51', primaryForm: 'じゃない', meaning: 'negative copula' },
      { id: '52', primaryForm: 'でした', meaning: 'past copula' },
    ]);
    expect(getRelatedGrammarItems(db, '51')).toEqual([]);
  });

  it('returns example sentences ordered by sort_order', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetExampleSentences('curriculum.db.test', [
      {
        id: 2,
        item_id: 20,
        japanese: '私は学生です。',
        english: 'I am a student.',
        sort_order: 2,
      },
      {
        id: 1,
        item_id: 20,
        japanese: 'これは本です。',
        english: 'This is a book.',
        sort_order: 1,
      },
    ]);

    expect(getExampleSentences(db, '20')).toEqual([
      {
        id: '1',
        japanese: 'これは本です。',
        furigana: null,
        english: 'This is a book.',
        sortOrder: 1,
      },
      {
        id: '2',
        japanese: '私は学生です。',
        furigana: null,
        english: 'I am a student.',
        sortOrder: 2,
      },
    ]);
  });

  it('returns grammar links for vocabulary with grammar item details', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 20,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'watashi',
        primary_form: '私',
        meaning: 'I, me',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 50,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'desu',
        primary_form: 'です',
        meaning: 'to be (polite)',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    __mockSetGrammarVocabLinks('curriculum.db.test', [
      {
        id: 1,
        grammar_item_id: 50,
        vocabulary_item_id: 20,
      },
    ]);

    expect(getGrammarLinksForVocab(db, '20')).toEqual([
      {
        grammarItemId: '50',
        vocabularyItemId: '20',
        vocabularyPrimaryForm: 'です',
        vocabularyMeaning: 'to be (polite)',
      },
    ]);
  });

  it('returns related children/targets for a parent item', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 50,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'desu',
        primary_form: 'です',
        meaning: 'to be',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 20,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'taberu',
        primary_form: '食べる',
        meaning: 'to eat',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        parent_item_id: 50,
        child_item_id: 20,
        relationship_type: 'reinforces',
      },
    ]);

    const related = getRelatedItemsForItems(db, ['50']);
    expect(related.get('50')).toEqual([
      {
        id: '20',
        itemType: 'vocabulary',
        primaryForm: '食べる',
        meaning: 'to eat',
        relationshipType: 'reinforces',
      },
    ]);
  });

  it('returns empty related list for leaf items', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', [
      {
        id: 20,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'taberu',
        primary_form: '食べる',
        meaning: 'to eat',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    expect(getRelatedItemsForItems(db, ['20']).get('20')).toBeUndefined();
  });

  it('groups related items by parent id when multiple parents are queried', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', [
      {
        id: 50,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'desu',
        primary_form: 'です',
        meaning: 'to be',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 51,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'masu',
        primary_form: 'ます',
        meaning: 'polite verb ending',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 20,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'taberu',
        primary_form: '食べる',
        meaning: 'to eat',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 21,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'nomu',
        primary_form: '飲む',
        meaning: 'to drink',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      { parent_item_id: 50, child_item_id: 20, relationship_type: 'reinforces' },
      { parent_item_id: 51, child_item_id: 21, relationship_type: 'reinforces' },
    ]);

    const result = getRelatedItemsForItems(db, ['50', '51']);

    expect(result.get('50')).toEqual([
      { id: '20', itemType: 'vocabulary', primaryForm: '食べる', meaning: 'to eat', relationshipType: 'reinforces' },
    ]);
    expect(result.get('51')).toEqual([
      { id: '21', itemType: 'vocabulary', primaryForm: '飲む', meaning: 'to drink', relationshipType: 'reinforces' },
    ]);
  });
});

describe('itemRepository answer-collision lookup (Story 1.2, FR86)', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createCollisionDb() {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'eat',
        primary_form: '食',
        meaning: 'eat, food',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'drink',
        primary_form: '飲',
        meaning: 'drink',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);
    __mockSetAcceptedAnswers('curriculum.db.test', [
      { id: 1, item_id: 1, answer_type: 'meaning', answer_text: 'eat', is_primary: 1 },
      { id: 2, item_id: 2, answer_type: 'meaning', answer_text: 'drink', is_primary: 1 },
      { id: 3, item_id: 2, answer_type: 'reading', answer_text: 'イン', is_primary: 1 },
    ]);
    __mockSetKanjiReadings('curriculum.db.test', [
      { id: 1, item_id: 2, reading_type: 'onyomi', reading: 'イン', sort_order: 0 },
      { id: 2, item_id: 2, reading_type: 'kunyomi', reading: 'のむ', sort_order: 1 },
    ]);

    return db;
  }

  it('finds another item by accepted meaning, excluding the current item', async () => {
    const db = await createCollisionDb();

    const matches = findItemsByAcceptedAnswer(db, 'meaning', ['drink'], '1');

    expect(matches).toEqual([
      { itemId: '2', primaryForm: '飲', itemType: 'kanji', answerText: 'drink' },
    ]);
  });

  it('excludes the current item from its own accepted answers', async () => {
    const db = await createCollisionDb();

    const matches = findItemsByAcceptedAnswer(db, 'meaning', ['eat'], '1');

    expect(matches).toEqual([]);
  });

  it('finds reading collisions in kanji_readings and dedupes with accepted_answers', async () => {
    const db = await createCollisionDb();

    // 'イン' is both an accepted reading answer and an on'yomi row for item 2 —
    // must come back exactly once.
    const matches = findItemsByAcceptedAnswer(db, 'reading', ['イン'], '1');

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ itemId: '2', primaryForm: '飲' });
  });

  it('finds a kun\'yomi collision that only exists in kanji_readings', async () => {
    const db = await createCollisionDb();

    const matches = findItemsByAcceptedAnswer(db, 'reading', ['のむ'], '1');

    expect(matches).toEqual([
      { itemId: '2', primaryForm: '飲', itemType: 'kanji', answerText: 'のむ' },
    ]);
  });

  it('returns empty for blank candidates without querying', async () => {
    const db = await createCollisionDb();

    expect(findItemsByAcceptedAnswer(db, 'meaning', ['', '  '], '1')).toEqual([]);
  });
});
