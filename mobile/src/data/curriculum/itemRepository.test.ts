import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetAcceptedAnswers,
  __mockSetExampleSentences,
  __mockSetExampleSentenceSpans,
  __mockSetExampleSentenceVocab,
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
  getItemBySlug,
  getKanjiReadings,
  getRequiredParentLabels,
  getRequiredParentLabelsForItems,
  getRequiredParentsForItems,
  getRelatedGrammarItems,
  getRelatedItemsForItems,
  getTaughtConjugatedForms,
  getVisuallySimilarItems,
  ITEM_TYPES,
  listItemsByLevelAndType,
  listLessonCandidatePool,
  listLevelsWithContent,
} from '@/data/curriculum/itemRepository';
import { planLesson } from '@/core/lesson/lessonPlanner';

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

  it('reports only levels with grammar as having content, skipping the derived skeleton', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', [
      ...buildN5Items(),
      // N3/N2/N1 ship radicals, kanji and derived vocabulary and no grammar at
      // all, so starting onboarding there would drop the learner into a level
      // with no lessons to explain anything (plan v2 Phase D).
      {
        id: 902,
        item_type: 'vocabulary',
        jlpt_level: 'N3',
        slug: 'v-anpo',
        primary_form: '安保',
        meaning: 'security',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 900,
        item_type: 'kanji',
        jlpt_level: 'N3',
        slug: 'n3-copy',
        primary_form: '写',
        meaning: 'copy',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 901,
        item_type: 'radical',
        jlpt_level: 'N3',
        slug: 'katahen',
        primary_form: '方',
        meaning: 'direction',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    expect(listLevelsWithContent(db)).toEqual(['N5']);
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

  it('returns item detail by slug, scoped to the requested item type', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'nihongo',
        primary_form: 'grammar-nihongo',
        meaning: 'not the one we want',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'nihongo',
        primary_form: '日本語',
        furigana: '日本[にほん]語[ご]',
        meaning: 'Japanese',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);

    const detail = getItemBySlug(db, 'vocabulary', 'nihongo');
    expect(detail?.id).toBe('2');
    expect(detail?.primaryForm).toBe('日本語');
    expect(detail?.furigana).toBe('日本[にほん]語[ご]');

    // The same slug on another type must not leak across.
    expect(getItemBySlug(db, 'grammar', 'nihongo')?.primaryForm).toBe('grammar-nihongo');
    expect(getItemBySlug(db, 'vocabulary', 'no-such-slug')).toBeNull();
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
      { id: '1', primaryForm: '日', itemType: 'radical', meaning: 'sun' },
      { id: '2', primaryForm: '口', itemType: 'radical', meaning: 'mouth' },
    ]);
  });

  describe('lesson candidate pool (band-gated)', () => {
    /**
     * 写真 is the plan's worked example: an N5 word written with two N3 kanji.
     * Under plan v2 the out-of-band kanji hold `builds_on` edges, which never
     * gate, so the word is offered on its own level and asked for its meaning
     * until those kanji reach guru. 日本 is the control: 日 is banded at N5, so
     * that edge is `requires` and still gates.
     */
    function setPhotoCurriculum(): void {
      __mockSetItems('curriculum.db.test', [
        {
          id: 1,
          item_type: 'vocabulary',
          jlpt_level: 'N5',
          slug: 'shashin',
          primary_form: '写真',
          meaning: 'photograph',
          mnemonic_text: null,
          visual_mnemonic_url: null,
          sort_order: 261,
        },
        {
          id: 2,
          item_type: 'kanji',
          jlpt_level: 'N3',
          slug: 'n3-copy',
          primary_form: '写',
          meaning: 'copy',
          mnemonic_text: null,
          visual_mnemonic_url: null,
          sort_order: 83,
        },
        {
          id: 3,
          item_type: 'kanji',
          jlpt_level: 'N3',
          slug: 'n3-true',
          primary_form: '真',
          meaning: 'true',
          mnemonic_text: null,
          visual_mnemonic_url: null,
          sort_order: 30,
        },
        {
          id: 4,
          item_type: 'kanji',
          jlpt_level: 'N5',
          slug: 'n5-nichi',
          primary_form: '日',
          meaning: 'day',
          mnemonic_text: null,
          visual_mnemonic_url: null,
          sort_order: 1,
        },
        {
          id: 5,
          item_type: 'radical',
          jlpt_level: 'N3',
          slug: 'n3-crown',
          primary_form: '冖',
          meaning: 'crown',
          mnemonic_text: null,
          visual_mnemonic_url: null,
          sort_order: 3,
        },
        {
          id: 6,
          item_type: 'vocabulary',
          jlpt_level: 'N5',
          slug: 'nihon',
          primary_form: '日本',
          meaning: 'Japan',
          mnemonic_text: null,
          visual_mnemonic_url: null,
          sort_order: 4,
        },
      ]);

      __mockSetItemRelationships('curriculum.db.test', [
        // 写 and 真 are banded at N3, later than the N5 word they are written
        // in, so their edges do not gate.
        { child_item_id: 1, parent_item_id: 2, relationship_type: 'builds_on' },
        { child_item_id: 1, parent_item_id: 3, relationship_type: 'builds_on' },
        { child_item_id: 2, parent_item_id: 5, relationship_type: 'builds_on' },
        // 日 is banded at N5, in band for an N5 word, so its edge gates.
        { child_item_id: 6, parent_item_id: 4, relationship_type: 'requires' },
      ]);
    }

    it('holds the pool to the level being studied', async () => {
      const db = await openDatabaseAsync('curriculum.db.test');
      setPhotoCurriculum();

      const pool = listLessonCandidatePool(db, 'N5');
      const bySlug = new Map(pool.map((item) => [item.slug, item]));

      // The N5 level's own items and nothing else: no N3 kanji, no N3 radical.
      expect([...bySlug.keys()].sort()).toEqual(['n5-nichi', 'nihon', 'shashin']);
      // Each item keeps its own authored position — nothing is reseated.
      expect(bySlug.get('n5-nichi')?.sortOrder).toBe(1);
      expect(bySlug.get('shashin')?.sortOrder).toBe(261);
    });

    it('offers 写真 to an N5 profile without teaching its N3 kanji first', async () => {
      const db = await openDatabaseAsync('curriculum.db.test');
      setPhotoCurriculum();

      const pool = listLessonCandidatePool(db, 'N5');
      const candidates = pool.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        primaryForm: item.primaryForm,
        meaning: item.meaning,
        sortOrder: item.sortOrder,
      }));
      const parentsByItemId = getRequiredParentsForItems(
        db,
        candidates.map((candidate) => candidate.id),
      );

      const firstLesson = planLesson({
        candidates,
        studyStatuses: new Map(),
        startedItemIds: new Set(),
        parentsByItemId,
        parentStatuses: new Map(),
        size: 10,
      });
      const offered = firstLesson.map((item) => item.primaryForm);

      // 写真 carries only non-gating edges, so it ships in the first lesson.
      // 日本 does not: 日 is in band, unstudied, and still gates.
      expect(offered).toEqual(expect.arrayContaining(['写真', '日']));
      expect(offered).not.toContain('日本');

      const afterKanji = planLesson({
        candidates,
        studyStatuses: new Map([['4', 'in_progress' as const]]),
        startedItemIds: new Set(['1', '4']),
        parentsByItemId,
        parentStatuses: new Map([['4', 'in_progress' as const]]),
        size: 10,
      });

      expect(afterKanji.map((item) => item.primaryForm)).toEqual(['日本']);
    });

    it('keeps an out-of-band kanji on its own JLPT level for Browse and detail', async () => {
      const db = await openDatabaseAsync('curriculum.db.test');
      setPhotoCurriculum();

      expect(getItemBySlug(db, 'kanji', 'n3-copy')?.jlptLevel).toBe('N3');
      expect(getItemById(db, '2')?.jlptLevel).toBe('N3');
    });
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
      { id: '1', primaryForm: '日', itemType: 'radical', meaning: 'sun' },
    ]);
    expect(getRequiredParentsForItems(db, ['10']).get('10')).toBeUndefined();
  });

  it('lists both in-band and out-of-band kanji as a word’s component chips', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'n5-nichi',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N3',
        slug: 'n3-record',
        primary_form: '記',
        meaning: 'record',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 9,
      },
      {
        id: 10,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'nikki',
        primary_form: '日記',
        meaning: 'diary',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 5,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      { child_item_id: 10, parent_item_id: 1, relationship_type: 'requires' },
      // 記 is banded at N3, so its edge is the non-gating kind — the chip must
      // still show, or 日記 would read as a word written with one kanji.
      { child_item_id: 10, parent_item_id: 2, relationship_type: 'builds_on' },
    ]);

    expect(getComponentParentsForItem(db, '10', 'vocabulary')).toEqual([
      { id: '1', primaryForm: '日', itemType: 'kanji', meaning: 'day' },
      { id: '2', primaryForm: '記', itemType: 'kanji', meaning: 'record' },
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
        vocabularyLinks: [],
        spans: [],
      },
      {
        id: '2',
        japanese: '私は学生です。',
        furigana: null,
        english: 'I am a student.',
        sortOrder: 2,
        vocabularyLinks: [],
        spans: [],
      },
    ]);
  });

  it('attaches authored vocabulary links to example sentences', async () => {
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
        id: 21,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'gakusei',
        primary_form: '学生',
        meaning: 'student',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);
    __mockSetExampleSentences('curriculum.db.test', [
      {
        id: 1,
        item_id: 20,
        japanese: '私は学生です。',
        furigana: '私[わたし]は学生[がくせい]です。',
        english: 'I am a student.',
        sort_order: 0,
      },
    ]);
    __mockSetExampleSentenceVocab('curriculum.db.test', [
      { id: 1, sentence_id: 1, item_id: 20, sort_order: 0 },
      { id: 2, sentence_id: 1, item_id: 21, sort_order: 1 },
    ]);

    expect(getExampleSentences(db, '20')).toEqual([
      {
        id: '1',
        japanese: '私は学生です。',
        furigana: '私[わたし]は学生[がくせい]です。',
        english: 'I am a student.',
        sortOrder: 0,
        vocabularyLinks: [
          { itemId: '20', primaryForm: '私' },
          { itemId: '21', primaryForm: '学生' },
        ],
        spans: [],
      },
    ]);
  });

  it('attaches compiled word spans, inflected occurrences included (14.1a)', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetExampleSentences('curriculum.db.test', [
      {
        id: 6,
        item_id: 537,
        japanese: '猫がここへ来ます。',
        furigana: '猫[ねこ]がここへ来[き]ます。',
        english: 'The cat comes here.',
        sort_order: 0,
      },
    ]);
    __mockSetExampleSentenceSpans('curriculum.db.test', [
      {
        id: 2,
        sentence_id: 6,
        item_id: 537,
        start_offset: 5,
        end_offset: 8,
        inflection: 'masu',
        sort_order: 1,
      },
      {
        id: 1,
        sentence_id: 6,
        item_id: 30,
        start_offset: 0,
        end_offset: 1,
        inflection: null,
        sort_order: 0,
      },
      // Another sentence's span must not leak in.
      {
        id: 3,
        sentence_id: 7,
        item_id: 30,
        start_offset: 0,
        end_offset: 1,
        inflection: null,
        sort_order: 0,
      },
    ]);

    expect(getExampleSentences(db, '537')[0].spans).toEqual([
      { vocabularyItemId: '30', startOffset: 0, endOffset: 1, inflection: null },
      // The inflected span still resolves to the base item, never a synthetic one.
      { vocabularyItemId: '537', startOffset: 5, endOffset: 8, inflection: 'masu' },
    ]);
  });

  it('lists a word\'s taught conjugated forms, one representative surface each', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetExampleSentences('curriculum.db.test', [
      { id: 6, item_id: 537, japanese: '二十日に彼女が来ます。', english: '', sort_order: 0 },
      { id: 7, item_id: 537, japanese: '学生が百人来ました。', english: '', sort_order: 1 },
      { id: 8, item_id: 537, japanese: '来て、座ってください。', english: '', sort_order: 2 },
    ]);
    __mockSetExampleSentenceSpans('curriculum.db.test', [
      { id: 1, sentence_id: 6, item_id: 537, start_offset: 7, end_offset: 10, inflection: 'masu', sort_order: 0 },
      { id: 2, sentence_id: 7, item_id: 537, start_offset: 5, end_offset: 9, inflection: 'masu', sort_order: 0 },
      { id: 3, sentence_id: 8, item_id: 537, start_offset: 0, end_offset: 2, inflection: 'te', sort_order: 0 },
      // A dictionary-form occurrence is not a conjugated form.
      { id: 4, sentence_id: 8, item_id: 537, start_offset: 0, end_offset: 2, inflection: null, sort_order: 1 },
      // Another word's forms stay out.
      { id: 5, sentence_id: 6, item_id: 30, start_offset: 0, end_offset: 1, inflection: 'ta', sort_order: 1 },
    ]);

    expect(getTaughtConjugatedForms(db, '537')).toEqual([
      { inflection: 'masu', surface: '来ます' },
      { inflection: 'te', surface: '来て' },
    ]);
  });

  it('lists no conjugated forms for a word the curriculum never inflects', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetExampleSentences('curriculum.db.test', [
      { id: 6, item_id: 20, japanese: '私は学生です。', english: '', sort_order: 0 },
    ]);
    __mockSetExampleSentenceSpans('curriculum.db.test', [
      { id: 1, sentence_id: 6, item_id: 20, start_offset: 0, end_offset: 1, inflection: null, sort_order: 0 },
    ]);

    expect(getTaughtConjugatedForms(db, '20')).toEqual([]);
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
