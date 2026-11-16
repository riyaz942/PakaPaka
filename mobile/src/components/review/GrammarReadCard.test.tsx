import { fireEvent, render, screen } from '@testing-library/react-native';

import { GrammarReadCard } from './GrammarReadCard';

import type { GrammarSentenceCard, ReviewItem } from '@/core/srs/srs.types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: () => 'shown',
    setOverride: jest.fn(),
  }),
}));
jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

const SENTENCE: GrammarSentenceCard = {
  sentenceKey: '寒いから、コートを着ます。',
  japanese: '寒いから、コートを着ます。',
  furigana: '寒[さむ]いから、コートを着[き]ます。',
  english: "Because it's cold, I'll wear a coat.",
  spans: [
    { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
    { vocabularyItemId: '21', startOffset: 5, endOffset: 8, inflection: null },
  ],
  grammarSpan: { start: 2, end: 4 },
  register: 'polite',
  vocabulary: [
    { itemId: '20', primaryForm: '寒い', furigana: '寒[さむ]い' },
    { itemId: '21', primaryForm: 'コート', furigana: null },
  ],
  answers: ['寒[さむ]いから、コートを着[き]ます。'],
  otherGrammarAnswers: [],
  userAnswers: [],
  diagnosisKey: null,
};

function grammarItem(promptType: 'meaning' | 'production'): ReviewItem {
  return {
    itemId: '99', itemType: 'grammar', primaryForm: 'から', displayMeaning: 'because',
    meanings: ['because'], promptType, isTwoCardItem: true,
    grammarRead: SENTENCE, grammarBuild: SENTENCE,
    answerKey: { acceptedMeanings: ['because'], acceptedReadings: [] },
    relatedItems: [], reinforcementLink: null,
    srsState: {
      itemId: '99', stability: 1, difficulty: 5, dueDate: '2026-10-13T00:00:00.000Z',
      fsrsState: 'review', reps: 2, lapses: 0, learningSteps: 0, isBurned: false,
      srsStageLabel: 'apprentice', lastReviewedAt: null, updatedAt: '2026-10-13T00:00:00.000Z',
    },
  };
}

describe('GrammarReadCard', () => {
  beforeEach(() => mockPush.mockReset());

  it('asks for the highlighted grammar and keeps it locked before answering', () => {
    render(<GrammarReadCard item={grammarItem('meaning')} answered={false} />);
    expect(screen.getByText('What does the highlighted grammar mean?')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-read-grammar'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText(SENTENCE.english)).toBeNull();
  });

  it('links every word before answering', () => {
    render(<GrammarReadCard item={grammarItem('meaning')} answered={false} />);
    fireEvent.press(screen.getByTestId('grammar-read-word-20-0'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/20');
  });

  it('after answering shows the English and unlocks the grammar', () => {
    render(<GrammarReadCard item={grammarItem('meaning')} answered />);
    expect(screen.getByText(SENTENCE.english)).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-read-grammar'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/99');
  });
});
