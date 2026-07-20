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
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      const cleanup = callback();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [callback]);
  },
}));

jest.mock('@/data/hooks/useDatabase', () => {
  // Stable object: an unstable identity would re-fire db-keyed effects every render.
  const databases = {
    userDb: {
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      runSync: jest.fn(),
    },
    curriculumDb: {},
  };
  return { useDatabase: () => databases };
});

const baseItem: CurriculumItemDetail = {
  id: '20',
  slug: 'watashi',
  itemType: 'vocabulary',
  jlptLevel: 'N5',
  primaryForm: '私',
  furigana: null,
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
    furigana: null,
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
    expect(screen.getByTestId('cross-ref-grammar-50')).toBeTruthy();
    expect(screen.getByText('です')).toBeTruthy();
  });

  it('keeps component kanji browsable rather than collapsing them to a status line', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
        parents={[{ id: '2', itemType: 'kanji', primaryForm: '私' }]}
      />,
    );

    expect(screen.getByText('Kanji in this word')).toBeTruthy();
    expect(screen.getByTestId('cross-ref-components-2')).toBeTruthy();
    expect(screen.queryByText('Prerequisites met')).toBeNull();
  });

  it('puts curriculum accepted answers behind a disclosure, distinct from the user editor', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={[
          ...acceptedAnswers,
          { id: '2', answerType: 'meaning', answerText: 'myself', isPrimary: false },
        ]}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    // Collapsed by default, and never sharing a title with "Your accepted answers".
    expect(screen.queryByText('myself')).toBeNull();
    expect(screen.getByText('Accepted answers')).toBeTruthy();
    expect(screen.getByText('Your accepted answers')).toBeTruthy();

    fireEvent.press(screen.getByTestId('accepted-answers-disclosure-toggle'));
    expect(screen.getByText('myself')).toBeTruthy();
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

    fireEvent.press(screen.getByTestId('cross-ref-grammar-50'));

    // Browse is the canonical discovery surface for cross-references.
    expect(mockPush).toHaveBeenCalledWith('/browse/item/50');
  });
});
