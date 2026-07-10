import { evaluateReviewAnswer, gradeForResult } from './reviewAnswerEvaluator';
import type { ReviewItem } from '@/core/srs/srs.types';

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: '1',
    itemType: 'kanji',
    primaryForm: '一',
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
