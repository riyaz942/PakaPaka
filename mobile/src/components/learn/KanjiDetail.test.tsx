import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import {
  __mockPlayedBuffers,
  __mockResetAudioApi,
} from '../../../__mocks__/react-native-audio-api';
import {
  __mockExecutorchState,
  __mockResetExecutorch,
  __mockSetSynthesis,
} from '../../../__mocks__/react-native-executorch';
import {
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
} from '../../../__mocks__/react-native-executorch-expo-resource-fetcher';

import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { KanjiDetail } from '@/components/learn/KanjiDetail';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  ExampleSentence,
  KanjiReading,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';
import type { ComponentParent } from '@/data/hooks/useComponentParents';

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
  wordType: null,
  readingComposition: null,
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

const parents: ComponentParent[] = [
  { id: '1', primaryForm: '木', itemType: 'radical', meaning: 'tree', inBand: true, notYetLearned: false },
  { id: '2', primaryForm: '日', itemType: 'radical', meaning: 'sun', inBand: true, notYetLearned: false },
];

const lookAlikes: VisuallySimilarItem[] = [
  { id: '99', primaryForm: '目', meaning: 'eye', itemType: 'kanji' },
];

describe('KanjiDetail', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    __mockResetAudioApi();
    __mockResetExecutorch();
    __mockResetResourceFetcher();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    __mockSetSynthesis(new Float32Array([0.1, 0.2]));
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

  it('plays the kanji aloud through the on-device TTS pipeline', async () => {
    render(
      <KanjiDetail
        item={baseItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
      />,
    );

    fireEvent.press(screen.getByTestId('kanji-pronunciation-button'));

    await waitFor(() => expect(__mockExecutorchState().synthesizeCalls).toEqual(['日']));
    await waitFor(() => expect(__mockPlayedBuffers()).toHaveLength(1));
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
        vocabularyLinks: [],
        spans: [],
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
    wordType: null,
    readingComposition: null,
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

    const line = within(screen.getByTestId('kanji-composition-line'));
    for (const part of ['木', ' + ', '日', ' = ', '東']) {
      expect(line.getByText(part)).toBeTruthy();
    }
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

  it('omits a tautological composition line when the sole parent matches the kanji glyph', () => {
    const primaryKanji: CurriculumItemDetail = {
      ...revisedItem,
      primaryForm: '三',
      meaning: 'three',
    };
    const selfRadical: ComponentParent[] = [
      { id: 'r3', primaryForm: '三', itemType: 'radical', meaning: 'three', inBand: true, notYetLearned: false },
    ];

    render(
      <KanjiDetail
        item={primaryKanji}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
        parents={selfRadical}
      />,
    );

    expect(screen.queryByTestId('kanji-composition-line')).toBeNull();
    expect(screen.queryByText('三 = 三')).toBeNull();
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

  it('names the radical under each "built from" tile', () => {
    render(
      <KanjiDetail
        item={revisedItem}
        kanjiReadings={kanjiReadings}
        acceptedAnswers={acceptedAnswers}
        parents={parents}
      />,
    );

    expect(screen.getByText('Built from')).toBeTruthy();
    expect(screen.getByLabelText('木, tree')).toBeTruthy();
    expect(screen.getByText('tree')).toBeTruthy();
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
