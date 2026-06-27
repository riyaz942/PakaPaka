import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { KanjiDetail } from '@/components/learn/KanjiDetail';
import type { AcceptedAnswer, CurriculumItemDetail, KanjiReading } from '@/data/curriculum/itemRepository';

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
  id: '10',
  slug: 'day',
  itemType: 'kanji',
  jlptLevel: 'N5',
  primaryForm: '日',
  meaning: 'day',
  mnemonicText: 'The sun rises each day.',
  visualMnemonicUrl: null,
};

const kanjiReadings: KanjiReading[] = [
  { id: '1', readingType: 'onyomi', reading: 'ニチ', sortOrder: 1 },
  { id: '2', readingType: 'kunyomi', reading: 'ひ', sortOrder: 2 },
];

const acceptedAnswers: AcceptedAnswer[] = [
  { id: '1', answerType: 'meaning', answerText: 'day', isPrimary: true },
  { id: '2', answerType: 'meaning', answerText: 'sun', isPrimary: false },
];

describe('KanjiDetail', () => {
  it('renders glyph, meaning, labeled readings, synonyms, and mnemonic', () => {
    render(
      <KanjiDetail
        item={baseItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
      />,
    );

    expect(screen.getByTestId('kanji-detail')).toBeTruthy();
    expect(screen.getByText('日')).toBeTruthy();
    expect(screen.getByText('day')).toBeTruthy();
    expect(screen.getByText("On'yomi")).toBeTruthy();
    expect(screen.getByText('ニチ')).toBeTruthy();
    expect(screen.getByText("Kun'yomi")).toBeTruthy();
    expect(screen.getByText('ひ')).toBeTruthy();
    expect(screen.getByText('sun')).toBeTruthy();
    expect(screen.getByText('The sun rises each day.')).toBeTruthy();
  });
});
