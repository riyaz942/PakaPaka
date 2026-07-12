import { evaluateReviewAnswer, gradeForResult } from './reviewAnswerEvaluator';
import type { ReviewItem } from '@/core/srs/srs.types';

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: '1',
    itemType: 'kanji',
    primaryForm: '一',
    displayMeaning: 'one',
    meanings: ['one'],
    promptType: 'reading',
    answerKey: {
      acceptedMeanings: ['one'],
      acceptedReadings: ['いち'],
    },
    relatedItems: [],
    reinforcementLink: null,
    srsState: {
      itemId: '1',
      stability: 1,
      difficulty: 5,
      dueDate: new Date().toISOString(),
      fsrsState: 'new',
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      isBurned: false,
      srsStageLabel: 'apprentice',
      lastReviewedAt: null,
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('evaluateReviewAnswer', () => {
  it('uses reading evaluator for reading prompts', () => {
    expect(evaluateReviewAnswer(makeItem(), 'いち').result).toBe('correct');
  });

  it('uses meaning evaluator for meaning prompts', () => {
    const item = makeItem({ promptType: 'meaning' });
    expect(evaluateReviewAnswer(item, 'one').result).toBe('correct');
  });

  it('falls back to meaning when reading answers are missing', () => {
    const item = makeItem({
      itemType: 'vocabulary',
      promptType: 'reading',
      answerKey: { acceptedMeanings: ['I'], acceptedReadings: [] },
    });
    expect(evaluateReviewAnswer(item, 'I').result).toBe('correct');
  });

  it('falls back to meaning when the only reading equals the surface form (kana-only vocab)', () => {
    const item = makeItem({
      itemType: 'vocabulary',
      primaryForm: 'これ',
      displayMeaning: 'this one',
      promptType: 'reading',
      answerKey: { acceptedMeanings: ['this one'], acceptedReadings: ['これ'] },
    });
    expect(evaluateReviewAnswer(item, 'this one').result).toBe('correct');
  });

  it('returns wrong_script for kana at a meaning prompt', () => {
    const item = makeItem({ promptType: 'meaning' });
    expect(evaluateReviewAnswer(item, 'いち').result).toBe('wrong_script');
  });

  it('returns wrong_script for kanji at a meaning prompt', () => {
    const item = makeItem({ promptType: 'meaning' });
    expect(evaluateReviewAnswer(item, '一').result).toBe('wrong_script');
  });

  it('returns wrong_script when a reading prompt gets an accepted meaning in Latin', () => {
    expect(evaluateReviewAnswer(makeItem(), 'one').result).toBe('wrong_script');
  });

  it('grades a wrong romaji reading as incorrect, not wrong_script', () => {
    // "ni" is a genuine reading miss for 一 — legitimate romaji input.
    expect(evaluateReviewAnswer(makeItem(), 'ni').result).toBe('incorrect');
  });

  it('uses grammar evaluator for production prompts', () => {
    const item = makeItem({
      itemType: 'grammar',
      promptType: 'production',
      answerKey: {
        acceptedMeanings: [],
        acceptedReadings: [],
        grammar: {
          structure: 'Noun + です',
          conjugationRules: { polite: true },
          acceptedForms: ['です', 'だ'],
        },
      },
    });
    expect(evaluateReviewAnswer(item, 'です').result).toBe('correct');
  });

  it('grades grammar cloze input against the chunk, never the full sentence (Plan 07 invariant)', () => {
    const item = makeItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      clozePrompt: '私＿＿＿学生です。',
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: {
          structure: 'Noun + は + comment',
          conjugationRules: {},
          acceptedForms: ['は'],
        },
      },
    });
    // The chunk alone is correct…
    expect(evaluateReviewAnswer(item, 'は').result).toBe('correct');
    // …the full sentence (with or without the blank filled) is not.
    expect(evaluateReviewAnswer(item, '私は学生です。').result).toBe('incorrect');
  });
});

describe('gradeForResult', () => {
  it('maps correct to Good (3)', () => {
    expect(gradeForResult('correct')).toBe(3);
  });

  it('maps incorrect to Again (1)', () => {
    expect(gradeForResult('incorrect')).toBe(1);
  });

  it('returns null for typo (no advance)', () => {
    expect(gradeForResult('typo')).toBeNull();
  });

  it('maps hinted correct to Hard (2)', () => {
    expect(gradeForResult('correct', { hintsUsed: 1 })).toBe(2);
  });

  it('maps unhinted correct to Good (3)', () => {
    expect(gradeForResult('correct', { hintsUsed: 0 })).toBe(3);
    expect(gradeForResult('correct')).toBe(3);
  });
});
