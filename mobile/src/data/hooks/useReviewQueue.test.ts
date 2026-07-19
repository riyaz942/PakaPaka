import type { SQLiteDatabase } from 'expo-sqlite';

import { buildAnswerKey } from './useReviewQueue';

const mockGetAcceptedAnswers = jest.fn();
const mockGetKanjiReadings = jest.fn();
const mockGetGrammarRule = jest.fn();

jest.mock('@/data/curriculum/itemRepository', () => ({
  getAcceptedAnswers: (...args: unknown[]) => mockGetAcceptedAnswers(...args),
  getKanjiReadings: (...args: unknown[]) => mockGetKanjiReadings(...args),
  getGrammarRule: (...args: unknown[]) => mockGetGrammarRule(...args),
  getItemById: jest.fn(),
  getRelatedItemsForItems: jest.fn(),
  getRequiredParentsForItems: jest.fn(),
  getExampleSentences: jest.fn(),
  getGrammarClozeVariants: jest.fn(),
  getGrammarDistractorPools: jest.fn(),
}));

const db = {} as SQLiteDatabase;

describe('buildAnswerKey — kanji on\'yomi-only reading key (BUG3 fix, Story 1.1)', () => {
  beforeEach(() => {
    mockGetAcceptedAnswers.mockReset().mockReturnValue([]);
    mockGetKanjiReadings.mockReset().mockReturnValue([]);
    mockGetGrammarRule.mockReset().mockReturnValue(null);
  });

  it('accepts only on\'yomi rows for kanji; kun\'yomi goes to alternateReadings', () => {
    mockGetKanjiReadings.mockReturnValue([
      { id: 1, readingType: 'onyomi', reading: 'ショク', sortOrder: 0 },
      { id: 2, readingType: 'onyomi', reading: 'ジキ', sortOrder: 1 },
      { id: 3, readingType: 'kunyomi', reading: 'たべる', sortOrder: 2 },
    ]);

    const { answerKey, kanjiHasOnyomi } = buildAnswerKey(db, '1', 'kanji', 'eat', []);

    expect(answerKey.acceptedReadings).toEqual(['ショク', 'ジキ']);
    expect(answerKey.alternateReadings).toEqual(['たべる']);
    expect(kanjiHasOnyomi).toBe(true);
  });

  it('drops untyped accepted_answers readings for kanji (no flat merge)', () => {
    mockGetAcceptedAnswers.mockReturnValue([
      { id: 1, answerType: 'reading', answerText: 'たべる', isPrimary: true },
      { id: 2, answerType: 'meaning', answerText: 'eat', isPrimary: true },
    ]);
    mockGetKanjiReadings.mockReturnValue([
      { id: 1, readingType: 'onyomi', reading: 'ショク', sortOrder: 0 },
    ]);

    const { answerKey } = buildAnswerKey(db, '1', 'kanji', 'eat', []);

    expect(answerKey.acceptedReadings).toEqual(['ショク']);
    expect(answerKey.acceptedMeanings).toContain('eat');
  });

  it('keeps user reading synonyms accepted alongside on\'yomi', () => {
    mockGetKanjiReadings.mockReturnValue([
      { id: 1, readingType: 'onyomi', reading: 'ショク', sortOrder: 0 },
    ]);

    const { answerKey } = buildAnswerKey(db, '1', 'kanji', 'eat', [
      { itemId: '1', answerType: 'reading', answerText: 'しき' },
    ]);

    expect(answerKey.acceptedReadings).toEqual(['ショク', 'しき']);
  });

  it('excludes a kun\'yomi from alternates when it collides with an accepted reading after kana folding', () => {
    mockGetKanjiReadings.mockReturnValue([
      { id: 1, readingType: 'onyomi', reading: 'ショク', sortOrder: 0 },
      { id: 2, readingType: 'kunyomi', reading: 'しょく', sortOrder: 1 },
    ]);

    const { answerKey } = buildAnswerKey(db, '1', 'kanji', 'eat', []);

    expect(answerKey.alternateReadings).toEqual([]);
  });

  it('reports kanjiHasOnyomi false when a kanji has only kun\'yomi rows', () => {
    mockGetKanjiReadings.mockReturnValue([
      { id: 1, readingType: 'kunyomi', reading: 'たべる', sortOrder: 0 },
    ]);

    const { answerKey, kanjiHasOnyomi } = buildAnswerKey(db, '1', 'kanji', 'eat', []);

    expect(kanjiHasOnyomi).toBe(false);
    expect(answerKey.acceptedReadings).toEqual([]);
    expect(answerKey.alternateReadings).toEqual(['たべる']);
  });

  it('leaves the vocabulary path unchanged: accepted_answers readings plus synonyms, no alternates', () => {
    mockGetAcceptedAnswers.mockReturnValue([
      { id: 1, answerType: 'reading', answerText: 'たべもの', isPrimary: true },
    ]);

    const { answerKey, kanjiHasOnyomi } = buildAnswerKey(db, '2', 'vocabulary', 'food', [
      { itemId: '2', answerType: 'reading', answerText: 'めし' },
    ]);

    expect(mockGetKanjiReadings).not.toHaveBeenCalled();
    expect(answerKey.acceptedReadings).toEqual(['たべもの', 'めし']);
    expect(answerKey.alternateReadings).toBeUndefined();
    expect(kanjiHasOnyomi).toBe(false);
  });
});
