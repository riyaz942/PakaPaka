import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetAcceptedAnswers,
  __mockSetExampleSentences,
  __mockSetGrammarRules,
  __mockSetGrammarVocabLinks,
  __mockSetItemRelationships,
  __mockSetItems,
  __mockSetKanjiReadings,
} from '../../../__mocks__/expo-sqlite';

import {
  countItemsByLevel,
  countItemsByLevelAndType,
  getAcceptedAnswers,
  getExampleSentences,
  getGrammarLinksForVocab,
  getGrammarRule,
  getItemById,
  getKanjiReadings,
  getRequiredParentLabels,
  getRequiredParentLabelsForItems,
  getRequiredParentsForItems,
  getRelatedItemsForItems,
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
    });
    expect(getGrammarRule(db, '999')).toBeNull();
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
