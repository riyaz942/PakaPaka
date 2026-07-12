import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { GrammarDetail } from '@/components/learn/GrammarDetail';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  ExampleSentence,
  GrammarRule,
} from '@/data/curriculum/itemRepository';

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({
    userDb: {
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      runSync: jest.fn(),
    },
    curriculumDb: {},
  }),
}));

const baseItem: CurriculumItemDetail = {
  id: '50',
  slug: 'desu',
  itemType: 'grammar',
  jlptLevel: 'N5',
  primaryForm: 'です',
  furigana: null,
  meaning: 'to be (polite)',
  mnemonicText: 'Desu sounds like "deserve" politeness.',
  visualMnemonicUrl: null,
};

const grammarRule: GrammarRule = {
  structure: 'Noun + です',
  conjugationRules: { polite: true },
  acceptedForms: ['です', 'だ'],
  family: 'copula',
};

const exampleSentences: ExampleSentence[] = [
  { id: '1', japanese: 'これは本です。', furigana: null, english: 'This is a book.', sortOrder: 1 },
  { id: '2', japanese: '私は学生です。', furigana: null, english: 'I am a student.', sortOrder: 2 },
  { id: '3', japanese: '彼は先生です。', furigana: null, english: 'He is a teacher.', sortOrder: 3 },
  { id: '4', japanese: 'それは犬です。', furigana: null, english: 'That is a dog.', sortOrder: 4 },
  { id: '5', japanese: '今日は月曜日です。', furigana: null, english: 'Today is Monday.', sortOrder: 5 },
];

const acceptedAnswers: AcceptedAnswer[] = [
  { id: '1', answerType: 'meaning', answerText: 'to be (polite)', isPrimary: true },
];

describe('GrammarDetail', () => {
  it('renders pattern, structure, forms, conjugation rules, sentences, and mnemonic', () => {
    render(
      <GrammarDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        grammarRule={grammarRule}
        exampleSentences={exampleSentences}
      />,
    );

    expect(screen.getByTestId('grammar-detail')).toBeTruthy();
    expect(screen.getByText('です')).toBeTruthy();
    expect(screen.getByText('to be (polite)')).toBeTruthy();
    expect(screen.getByText('Noun + です')).toBeTruthy();
    expect(screen.getByText('• です')).toBeTruthy();
    expect(screen.getByText('• だ')).toBeTruthy();
    expect(screen.getByText('polite: yes')).toBeTruthy();
    expect(screen.getByText('これは本です。')).toBeTruthy();
    expect(screen.getByText('今日は月曜日です。')).toBeTruthy();
    expect(screen.getByText('Desu sounds like "deserve" politeness.')).toBeTruthy();
  });
});
