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

describe('wrong_reading_type — kanji on\'yomi card (Story 1.1, FR82)', () => {
  // 食: on'yomi しょく/じき accepted; kun'yomi たべる carried as alternate.
  const kanjiReadingCard = () =>
    makeItem({
      primaryForm: '食',
      displayMeaning: 'eat',
      meanings: ['eat'],
      isTwoCardItem: true,
      answerKey: {
        acceptedMeanings: ['eat'],
        acceptedReadings: ['ショク', 'ジキ'],
        alternateReadings: ['たべる'],
      },
    });

  it('accepts a true on\'yomi (katakana key, hiragana input)', () => {
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'しょく').result).toBe('correct');
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'じき').result).toBe('correct');
  });

  it('returns wrong_reading_type for an exact kun\'yomi, in kana or romaji', () => {
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'たべる').result).toBe('wrong_reading_type');
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'taberu').result).toBe('wrong_reading_type');
  });

  it('never accepts a kun\'yomi as correct on the on\'yomi card (BUG3 fixed)', () => {
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'たべる').result).not.toBe('correct');
  });

  it('grades an unknown reading incorrect, not wrong_reading_type', () => {
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'かん').result).toBe('incorrect');
  });

  it('still routes a near-miss on\'yomi through the typo path', () => {
    // しよく vs しょく — one edit apart on a 3-kana reading.
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'しよく').result).toBe('typo');
  });

  it('grades a near-miss kun\'yomi incorrect — only an exact alternate nudges', () => {
    expect(evaluateReviewAnswer(kanjiReadingCard(), 'たべ').result).toBe('incorrect');
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

  it('returns null for wrong_reading_type (non-terminal, no FSRS grade)', () => {
    expect(gradeForResult('wrong_reading_type')).toBeNull();
  });

  it('never penalizes hint usage — correct is Good regardless of hints (Plan 10)', () => {
    // The signature no longer accepts hint counts at all: revealing hints
    // must not be able to change the FSRS grade.
    expect(gradeForResult('correct')).toBe(3);
    expect(gradeForResult.length).toBe(1);
  });
});
