import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { KanjiDetail } from '@/components/learn/KanjiDetail';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  ExampleSentence,
  KanjiReading,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

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
  id: '10',
  slug: 'day',
  itemType: 'kanji',
  jlptLevel: 'N5',
  primaryForm: '日',
  furigana: null,
  meaning: 'day',
  mnemonicText: 'The sun rises each day.',
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
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

const parents: CurriculumParentItem[] = [
  { id: '1', primaryForm: '木', itemType: 'radical' },
  { id: '2', primaryForm: '日', itemType: 'radical' },
];

const lookAlikes: VisuallySimilarItem[] = [
  { id: '99', primaryForm: '目', meaning: 'eye', itemType: 'kanji' },
];

describe('KanjiDetail', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

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
    expect(screen.getByText('The sun rises each day.')).toBeTruthy();
  });

  it('opens the reading primer from the readings heading, on any path', () => {
    render(
      <KanjiDetail
        item={baseItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
      />,
    );

    fireEvent.press(screen.getByTestId("section-heading-info-on'yomi"));

    expect(screen.getByText("On'yomi and kun'yomi")).toBeTruthy();
  });

  it('hides curriculum accepted answers behind a disclosure', () => {
    render(
      <KanjiDetail
        item={baseItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
      />,
    );

    expect(screen.queryByText('sun')).toBeNull();

    fireEvent.press(screen.getByTestId('accepted-answers-disclosure-toggle'));

    expect(screen.getByText('sun')).toBeTruthy();
  });

  it('renders example sentences when provided', () => {
    const exampleSentences: ExampleSentence[] = [
      {
        id: '1',
        japanese: '毎日、本を読みます。',
        furigana: null,
        english: 'I read a book every day.',
        sortOrder: 1,
      },
    ];

    render(
      <KanjiDetail
        item={baseItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
      />,
    );

    expect(screen.getByText('Examples')).toBeTruthy();
    expect(screen.getByText('毎日、本を読みます。')).toBeTruthy();
    expect(screen.getByText('I read a book every day.')).toBeTruthy();
  });
});

describe('KanjiDetail Rev 1 content', () => {
  const revisedItem: CurriculumItemDetail = {
    ...baseItem,
    primaryForm: '東',
    meaning: 'east',
    mnemonicText: 'Stale one-line mnemonic.',
    meaningMnemonic: 'The sun climbs the tree until it hangs over the east.',
    readingMnemonic: 'とう — a tow truck dragging the sun east.',
    description: 'The everyday word for east. Do not confuse it with 車.',
  };

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('renders split mnemonics, the description, and the composition line', () => {
    render(
      <KanjiDetail
        item={revisedItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
        parents={parents}
      />,
    );

    expect(screen.getByText('木 + 日 = 東')).toBeTruthy();
    expect(screen.getByText('Meaning mnemonic')).toBeTruthy();
    expect(
      screen.getByText('The sun climbs the tree until it hangs over the east.'),
    ).toBeTruthy();
    expect(screen.getByText('Reading mnemonic')).toBeTruthy();
    expect(screen.getByText('とう — a tow truck dragging the sun east.')).toBeTruthy();
    expect(screen.getByText('About this kanji')).toBeTruthy();
    expect(
      screen.getByText('The everyday word for east. Do not confuse it with 車.'),
    ).toBeTruthy();
  });

  it('drops the legacy single mnemonic once split mnemonics exist', () => {
    render(
      <KanjiDetail
        item={revisedItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
        parents={parents}
      />,
    );

    expect(screen.queryByText('Stale one-line mnemonic.')).toBeNull();
    expect(screen.queryByText('Mnemonic')).toBeNull();
  });

  it('opens Compare from a look-alike chip, on the surface it is mounted on', () => {
    render(
      <ItemLinkProvider base="/review/item">
        <KanjiDetail
          item={revisedItem}
          kanjiReadings={kanjiReadings}
          acceptedAnswers={acceptedAnswers}
          lookAlikes={lookAlikes}
        />
      </ItemLinkProvider>,
    );

    expect(screen.getByText('Easily confused with')).toBeTruthy();
    fireEvent.press(screen.getByTestId('look-alike-99'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/review/compare',
      params: { left: '10', right: '99' },
    });
  });

  it('sends Browse look-alike chips to the Browse compare route', () => {
    render(
      <KanjiDetail
        item={revisedItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
        lookAlikes={lookAlikes}
      />,
    );

    fireEvent.press(screen.getByTestId('look-alike-99'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/browse/compare',
      params: { left: '10', right: '99' },
    });
  });
});
