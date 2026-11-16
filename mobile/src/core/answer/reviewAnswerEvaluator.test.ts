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

  it('nudges (wrong_script) when a reading answer holds English letters that are not romaji', () => {
    expect(evaluateReviewAnswer(makeItem(), 'hello').result).toBe('wrong_script');
  });

  it('nudges when a reading answer holds symbols or digits', () => {
    expect(evaluateReviewAnswer(makeItem(), 'いち!').result).toBe('wrong_script');
    expect(evaluateReviewAnswer(makeItem(), '1').result).toBe('wrong_script');
  });

  it('still accepts valid romaji and kana readings', () => {
    expect(evaluateReviewAnswer(makeItem(), 'ichi').result).toBe('correct');
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

  it('prefers wrong_reading_type over typo when an exact kun\'yomi is within on\'yomi edit distance', () => {
    // じょう is one edit from しょう — evaluateReading would return typo, but
    // an exact alternate must nudge (AC2) instead of recording a typo/weakness.
    const item = makeItem({
      primaryForm: '正',
      displayMeaning: 'correct',
      meanings: ['correct'],
      isTwoCardItem: true,
      answerKey: {
        acceptedMeanings: ['correct'],
        acceptedReadings: ['しょう'],
        alternateReadings: ['じょう'],
      },
    });
    expect(evaluateReviewAnswer(item, 'じょう').result).toBe('wrong_reading_type');
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

describe('grammar Build card', () => {
  const build = {
    sentenceKey: 'k', japanese: '寒いから、コートを着ます。', furigana: '寒[さむ]いから、コートを着[き]ます。',
    english: 'e', spans: [], grammarSpan: { start: 2, end: 4 }, register: 'polite' as const, vocabulary: [],
    answers: ['寒[さむ]いから、コートを着[き]ます。'],
    otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'],
    userAnswers: [],
    diagnosisKey: null,
  };
  const item = {
    itemId: '99', itemType: 'grammar' as const, primaryForm: 'から', displayMeaning: 'because',
    meanings: ['because'], promptType: 'production' as const, grammarBuild: build,
    answerKey: { acceptedMeanings: ['because'], acceptedReadings: [] },
    relatedItems: [], reinforcementLink: null,
    srsState: { itemId: '99', stability: 1, difficulty: 5, dueDate: '', fsrsState: 'review' as const, reps: 1, lapses: 0, learningSteps: 0, isBurned: false, srsStageLabel: 'apprentice' as const, lastReviewedAt: null, updatedAt: '' },
  };

  it('grades the sentence', () => {
    expect(evaluateReviewAnswer(item, 'さむいからこーとをきます').result).toBe('correct');
  });

  it('nudges a same-family grammar answer without grading', () => {
    expect(evaluateReviewAnswer(item, '寒いので、コートを着ます').result).toBe('other_grammar');
    expect(gradeForResult('other_grammar')).toBeNull();
  });

  it('a wrong sentence reveals the plain sentence', () => {
    expect(evaluateReviewAnswer(item, '暑いから')).toEqual({
      result: 'incorrect',
      displayAnswer: '寒いから、コートを着ます。',
    });
  });
});

describe('grammar Build card: close nudge', () => {
  const unit = (surface: string, reading: string, role: 'word' | 'particle' = 'word') => ({
    surface, reading, role, itemId: null, inGrammar: false,
  });
  // 今年は学校で日本語を勉強します
  const units = [
    unit('今年', 'ことし'), unit('は', 'は', 'particle'), unit('学校', 'がっこう'),
    unit('で', 'で', 'particle'), unit('日本語', 'にほんご'), unit('を', 'を', 'particle'),
    { ...unit('勉強します', 'べんきょうします'), itemId: 'study', inGrammar: true },
  ];
  const build = {
    sentenceKey: 'k', japanese: '今年は学校で日本語を勉強します。', furigana: '今年[ことし]は学校[がっこう]で日本語[にほんご]を勉強[べんきょう]します。',
    english: 'e', spans: [], grammarSpan: { start: 0, end: 0 }, register: 'polite' as const, vocabulary: [],
    answers: ['今年[ことし]は学校[がっこう]で日本語[にほんご]を勉強[べんきょう]します。'],
    otherGrammarAnswers: [],
    userAnswers: [],
    diagnosisKey: {
      answers: [units],
      words: {
        study: { itemId: 'study', primaryForm: '勉強する', furigana: '勉強[べんきょう]する', conjugationClass: 'suru' as const, transitivity: null, partner: null, homophones: [] },
      },
    },
  };
  const item = {
    itemId: '98', itemType: 'grammar' as const, primaryForm: '〜', displayMeaning: 'study',
    meanings: ['study'], promptType: 'production' as const, grammarBuild: build,
    answerKey: { acceptedMeanings: ['study'], acceptedReadings: [] },
    relatedItems: [], reinforcementLink: null,
    srsState: { itemId: '98', stability: 1, difficulty: 5, dueDate: '', fsrsState: 'review' as const, reps: 1, lapses: 0, learningSteps: 0, isBurned: false, srsStageLabel: 'apprentice' as const, lastReviewedAt: null, updatedAt: '' },
  };

  it('nudges an answer with one small slip, without grading', () => {
    expect(evaluateReviewAnswer(item, '今年は学校で日本語をを勉強します')).toEqual({
      result: 'close',
      nudge: '~ Close! Check your particles.',
    });
    expect(gradeForResult('close')).toBeNull();
  });

  it('nudges a Japanese typo in a word, without grading', () => {
    expect(evaluateReviewAnswer(item, 'ことしはがっこおでにほんごをべんきょうします')).toEqual({
      result: 'close',
      nudge: '~ Close! Check your spelling.',
    });
  });

  it('grades an answer with a bigger mistake incorrect', () => {
    expect(evaluateReviewAnswer(item, '今年は学校で勉強します').result).toBe('incorrect');
  });
});
