import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { VocabularyDetail } from '@/components/learn/VocabularyDetail';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  ExampleSentence,
  GrammarVocabLink,
} from '@/data/curriculum/itemRepository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({
    userDb: {
      getFirstSync: jest.fn(() => null),
      runSync: jest.fn(),
    },
    curriculumDb: {},
  }),
}));

const baseItem: CurriculumItemDetail = {
  id: '20',
  slug: 'watashi',
  itemType: 'vocabulary',
  jlptLevel: 'N5',
  primaryForm: '私',
  meaning: 'I, me',
  mnemonicText: 'Think of private self.',
  visualMnemonicUrl: null,
};

const acceptedAnswers: AcceptedAnswer[] = [
  { id: '1', answerType: 'meaning', answerText: 'I, me', isPrimary: true },
];

const exampleSentences: ExampleSentence[] = [
  {
    id: '1',
    japanese: '私は学生です。',
    english: 'I am a student.',
    sortOrder: 1,
  },
];

const grammarVocabLinks: GrammarVocabLink[] = [
  {
    grammarItemId: '50',
    vocabularyItemId: '20',
    vocabularyPrimaryForm: 'です',
    vocabularyMeaning: 'to be (polite)',
  },
];

describe('VocabularyDetail', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders meaning, examples, mnemonic, and grammar links', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-detail')).toBeTruthy();
    expect(screen.getByText('私')).toBeTruthy();
    expect(screen.getByText('I, me')).toBeTruthy();
    expect(screen.getByText('私は学生です。')).toBeTruthy();
    expect(screen.getByText('I am a student.')).toBeTruthy();
    expect(screen.getByText('Think of private self.')).toBeTruthy();
    expect(screen.getByTestId('grammar-link-50')).toBeTruthy();
    expect(screen.getByText('です')).toBeTruthy();
  });

  it('navigates to grammar detail when a grammar link is pressed', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    fireEvent.press(screen.getByTestId('grammar-link-50'));

    expect(mockPush).toHaveBeenCalledWith('/learn/item/50');
  });
});
