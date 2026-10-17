import { fireEvent, render, screen } from '@testing-library/react-native';

import { GrammarBuildCard } from './GrammarBuildCard';

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
    { itemId: '20', primaryForm: '寒い', furigana: '寒[さむ]い', started: true },
    { itemId: '21', primaryForm: 'コート', furigana: null, started: false },
  ],
  answers: ['寒[さむ]いから、コートを着[き]ます。'],
  otherGrammarAnswers: [],
  userAnswers: [],
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

describe('GrammarBuildCard', () => {
  beforeEach(() => mockPush.mockReset());

  it('shows the English, the polite tag and the word list, but not the sentence', () => {
    render(<GrammarBuildCard item={grammarItem('production')} answered={false} />);
    expect(screen.getByText(SENTENCE.english)).toBeTruthy();
    expect(screen.getByText('polite')).toBeTruthy();
    expect(screen.getByTestId('grammar-build-vocab-20')).toBeTruthy();
    expect(screen.queryByTestId('grammar-build-answer-' + SENTENCE.sentenceKey + '-linked')).toBeNull();
  });

  it('before answering, every word is a link, started or not', () => {
    render(<GrammarBuildCard item={grammarItem('production')} answered={false} />);
    fireEvent.press(screen.getByTestId('grammar-build-vocab-20'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/20');
    fireEvent.press(screen.getByTestId('grammar-build-vocab-21'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/21');
  });

  it('after answering, every word links and the correct sentence is shown', () => {
    render(<GrammarBuildCard item={grammarItem('production')} answered />);
    fireEvent.press(screen.getByTestId('grammar-build-vocab-20'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/20');
    expect(screen.getByTestId(`grammar-build-answer-${SENTENCE.sentenceKey}-linked`)).toBeTruthy();
  });
});
