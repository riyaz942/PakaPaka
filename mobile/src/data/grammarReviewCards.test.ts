import type { SQLiteDatabase } from 'expo-sqlite';

import { buildGrammarCards } from '@/data/grammarReviewCards';

const mockPool = jest.fn();
const mockForms = jest.fn();
const mockHistory = jest.fn();
const mockAnswers = jest.fn();
const mockStatuses = jest.fn();

jest.mock('@/data/curriculum/grammarPoolRepository', () => ({
  getGrammarSentencePool: (...args: unknown[]) => mockPool(...args),
  getItemFormsByIds: (...args: unknown[]) => mockForms(...args),
}));
jest.mock('@/data/user/grammarAnswerRepository', () => ({
  getGrammarSentenceHistory: (...args: unknown[]) => mockHistory(...args),
  listGrammarAnswers: (...args: unknown[]) => mockAnswers(...args),
}));
jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: (...args: unknown[]) => mockStatuses(...args),
}));

function poolSentence(japanese: string) {
  return {
    id: japanese, japanese, furigana: `${japanese}[f]`, english: `${japanese}-en`, sortOrder: 0,
    vocabularyLinks: [],
    // Out of order on purpose: the card lists words in sentence order.
    spans: [
      { vocabularyItemId: '21', startOffset: 5, endOffset: 8, inflection: null },
      { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
      { vocabularyItemId: '20', startOffset: 9, endOffset: 11, inflection: null },
    ],
    grammarStart: 2, grammarEnd: 4, register: 'polite' as const,
    validAnswers: [`${japanese}-valid`], otherGrammarAnswers: [`${japanese}-other`],
  };
}

const db = {} as SQLiteDatabase;

describe('buildGrammarCards', () => {
  beforeEach(() => {
    mockPool.mockReturnValue(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(poolSentence));
    mockForms.mockReturnValue(
      new Map([
        ['20', { primaryForm: '寒い', furigana: '寒[さむ]い' }],
        ['21', { primaryForm: 'コート', furigana: null }],
      ]),
    );
    mockHistory.mockReturnValue(['A', 'B']);
    mockAnswers.mockReturnValue(new Map([['C', ['saved']]]));
    mockStatuses.mockReturnValue(new Map([['20', 'in_progress']]));
  });

  it('picks two new sentences and fills each card', () => {
    const { grammarRead, grammarBuild } = buildGrammarCards(db, db, '50', () => 0);

    expect(grammarRead.sentenceKey).toBe('C');
    expect(grammarBuild.sentenceKey).toBe('D');
    expect(grammarRead).toMatchObject({
      japanese: 'C',
      english: 'C-en',
      grammarSpan: { start: 2, end: 4 },
      register: 'polite',
      answers: ['C[f]', 'C-valid'],
      otherGrammarAnswers: ['C-other'],
      userAnswers: ['saved'],
    });
    expect(grammarBuild.userAnswers).toEqual([]);
  });

  it('lists each word once, in sentence order, with its started flag', () => {
    const { grammarRead } = buildGrammarCards(db, db, '50', () => 0);

    expect(grammarRead.vocabulary).toEqual([
      { itemId: '20', primaryForm: '寒い', furigana: '寒[さむ]い', started: true },
      { itemId: '21', primaryForm: 'コート', furigana: null, started: false },
    ]);
  });
});
