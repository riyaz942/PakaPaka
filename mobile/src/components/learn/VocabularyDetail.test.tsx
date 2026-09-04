import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

import { VocabularyDetail } from '@/components/learn/VocabularyDetail';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';
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

/** Rows the curriculum `example_sentence_spans` join returns for this word. */
let mockConjugatedSpanRows: Record<string, unknown>[] = [];

jest.mock('@/data/hooks/useDatabase', () => {
  // Stable object: an unstable identity would re-fire db-keyed effects every render.
  const databases = {
    userDb: {
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      runSync: jest.fn(),
    },
    curriculumDb: {
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => mockConjugatedSpanRows),
      runSync: jest.fn(),
    },
  };
  return { useDatabase: () => databases };
});

let mockIsKnownWord = false;
let mockFuriganaModeForItem: 'auto' | 'shown' | 'hidden' = 'auto';

jest.mock('@/data/hooks/useIsKnownWord', () => ({
  useIsKnownWord: () => mockIsKnownWord,
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'auto',
    setMode: jest.fn(),
    knownKanji: new Set<string>(),
    refreshKnownKanji: jest.fn(),
    overrides: new Map<string, 'shown' | 'hidden'>(),
    modeForItem: () => mockFuriganaModeForItem,
    setOverride: jest.fn(),
    clearOverride: jest.fn(),
    clearAllOverrides: jest.fn(),
  }),
}));

/** In-memory stand-in for the `card_seen` table (Epic 7). */
const mockSeenGuidanceCards = new Set<string>();

jest.mock('@/data/user/cardSeenRepository', () => ({
  isCardSeen: (_userDb: unknown, cardId: string) => mockSeenGuidanceCards.has(cardId),
  markCardSeen: (_userDb: unknown, cardId: string) => {
    mockSeenGuidanceCards.add(cardId);
  },
}));

const baseItem: CurriculumItemDetail = {
  id: '20',
  slug: 'watashi',
  itemType: 'vocabulary',
  jlptLevel: 'N5',
  primaryForm: '私',
  furigana: null,
  meaning: 'I, me',
  wordType: null,
  readingComposition: null,
  mnemonicText: 'Think of private self.',
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
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
    vocabularyLinks: [],
    spans: [],
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
    mockIsKnownWord = false;
    mockFuriganaModeForItem = 'auto';
    mockSeenGuidanceCards.clear();
    mockConjugatedSpanRows = [];
    __mockResetAudioApi();
    __mockResetExecutorch();
    __mockResetResourceFetcher();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    __mockSetSynthesis(new Float32Array([0.1, 0.2]));
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
    // The hero and the always-visible reading section both show 私 — the word
    // has no furigana, so the reading section falls back to the primary form.
    expect(screen.getAllByText('私').length).toBeGreaterThan(0);
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

  it('plays the word aloud through the on-device TTS pipeline', async () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    fireEvent.press(screen.getByTestId('vocabulary-pronunciation-button'));

    await waitFor(() => expect(__mockExecutorchState().synthesizeCalls).toEqual(['私']));
    await waitFor(() => expect(__mockPlayedBuffers()).toHaveLength(1));
  });
});

describe('VocabularyDetail — always-visible reading (parity with kanji details)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockIsKnownWord = false;
    mockFuriganaModeForItem = 'auto';
    mockSeenGuidanceCards.clear();
    mockConjugatedSpanRows = [];
    __mockResetAudioApi();
    __mockResetExecutorch();
    __mockResetResourceFetcher();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    __mockSetSynthesis(new Float32Array([0.1, 0.2]));
  });

  const kuru: CurriculumItemDetail = {
    ...baseItem,
    id: '537',
    slug: 'kuru-v',
    primaryForm: '来る',
    furigana: '来[く]る',
    meaning: 'to come',
  };

  it('shows the kana reading extracted from furigana', () => {
    render(
      <VocabularyDetail
        item={kuru}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-reading')).toBeTruthy();
    expect(screen.getByText('くる')).toBeTruthy();
  });

  it('stays visible once the word is mastered, unlike the hero furigana', () => {
    mockIsKnownWord = true;

    render(
      <VocabularyDetail
        item={kuru}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-reading')).toBeTruthy();
    expect(screen.getByText('くる')).toBeTruthy();
  });

  it('stays visible when the furigana mode is hidden', () => {
    mockFuriganaModeForItem = 'hidden';

    render(
      <VocabularyDetail
        item={kuru}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-reading')).toBeTruthy();
    expect(screen.getByText('くる')).toBeTruthy();
  });

  it('falls back to the primary form when the word has no furigana', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-reading')).toBeTruthy();
    expect(screen.getAllByText('私').length).toBeGreaterThan(0);
  });
});

describe('VocabularyDetail word type', () => {
  it('names the part of speech alongside the reading', () => {
    render(
      <VocabularyDetail
        item={{ ...baseItem, wordType: 'い adjective' }}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-word-type')).toBeTruthy();
    expect(screen.getByText('い adjective')).toBeTruthy();
  });

  it('renders no row at all for a word with no single part of speech', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.queryByTestId('vocabulary-word-type')).toBeNull();
  });
});

describe('VocabularyDetail reading composition', () => {
  it('says how the reading is built', () => {
    render(
      <VocabularyDetail
        item={{
          ...baseItem,
          readingComposition:
            "Jukugo — 人（じん）＋口（こう）, each kanji read with its on'yomi.",
        }}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByTestId('vocabulary-reading-composition')).toBeTruthy();
    expect(
      screen.getByText("Jukugo — 人（じん）＋口（こう）, each kanji read with its on'yomi."),
    ).toBeTruthy();
  });

  it('renders no row at all when the word has none', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.queryByTestId('vocabulary-reading-composition')).toBeNull();
  });
});

describe('VocabularyDetail Rev 1 content', () => {
  const revisedItem: CurriculumItemDetail = {
    ...baseItem,
    mnemonicText: 'Stale one-line mnemonic.',
    meaningMnemonic: 'The private grain stalk you keep for yourself: me.',
    readingMnemonic: 'You already know わたし from 私 — the reading comes straight across.',
    description: 'Neutral-polite. Men often use 僕 in casual speech instead.',
  };

  it('renders split mnemonics and the description instead of the legacy blob', () => {
    render(
      <VocabularyDetail
        item={revisedItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByText('Meaning mnemonic')).toBeTruthy();
    expect(screen.getByText('The private grain stalk you keep for yourself: me.')).toBeTruthy();
    expect(screen.getByText('Reading mnemonic')).toBeTruthy();
    expect(screen.getByText('About this word')).toBeTruthy();
    expect(
      screen.getByText('Neutral-polite. Men often use 僕 in casual speech instead.'),
    ).toBeTruthy();
    expect(screen.queryByText('Stale one-line mnemonic.')).toBeNull();
  });

  it('falls back to the single mnemonic while an item has no split fields', () => {
    render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );

    expect(screen.getByText('Mnemonic')).toBeTruthy();
    expect(screen.getByText('Think of private self.')).toBeTruthy();
    expect(screen.queryByText('Meaning mnemonic')).toBeNull();
  });
});

describe('VocabularyDetail — furigana auto-hide guidance (Epic 7)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockIsKnownWord = false;
    mockFuriganaModeForItem = 'auto';
    mockSeenGuidanceCards.clear();
    mockConjugatedSpanRows = [];
  });

  function renderDetail() {
    return render(
      <VocabularyDetail
        item={baseItem}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
      />,
    );
  }

  it('explains where the reading went once the word is known', () => {
    mockIsKnownWord = true;

    renderDetail();

    expect(screen.getByTestId('guidance-card-notice-furigana-auto-hide')).toBeTruthy();
    expect(screen.getByText('Where the readings went')).toBeTruthy();
    expect(mockSeenGuidanceCards.has('furigana-auto-hide')).toBe(true);
  });

  it('says nothing when the word carries an explicit override', () => {
    mockIsKnownWord = true;
    mockFuriganaModeForItem = 'shown';

    renderDetail();

    expect(screen.queryByTestId('guidance-card-notice-furigana-auto-hide')).toBeNull();
    expect(mockSeenGuidanceCards.has('furigana-auto-hide')).toBe(false);
  });

  it('says nothing for a word that is not known yet', () => {
    renderDetail();

    expect(screen.queryByTestId('guidance-card-notice-furigana-auto-hide')).toBeNull();
    expect(mockSeenGuidanceCards.has('furigana-auto-hide')).toBe(false);
  });
});

describe('VocabularyDetail — conjugated forms (14.1)', () => {
  const kuru: CurriculumItemDetail = {
    ...baseItem,
    id: '537',
    slug: 'kuru-v',
    primaryForm: '来る',
    furigana: '来[く]る',
    meaning: 'to come',
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockIsKnownWord = false;
    mockFuriganaModeForItem = 'shown';
    mockSeenGuidanceCards.clear();
    mockConjugatedSpanRows = [];
  });

  function renderKuru(props: { surface?: string | null; inflection?: 'masu' | null } = {}) {
    return render(
      <VocabularyDetail
        item={kuru}
        acceptedAnswers={acceptedAnswers}
        exampleSentences={exampleSentences}
        grammarVocabLinks={grammarVocabLinks}
        {...props}
      />,
    );
  }

  it('notes the conjugation the learner arrived from, naming its category', () => {
    renderKuru({ surface: '来ます', inflection: 'masu' });

    expect(screen.getByTestId('conjugated-form-note')).toBeTruthy();
    expect(screen.getByText('来ます is the polite / ます-form of 来る')).toBeTruthy();
  });

  it('falls back to a plain note when the category is unknown', () => {
    renderKuru({ surface: '来ちゃった', inflection: null });

    expect(screen.getByText('来ちゃった is a conjugated form of 来る')).toBeTruthy();
  });

  it('says nothing when the learner arrived at the dictionary form', () => {
    renderKuru({ surface: '来る', inflection: null });

    expect(screen.queryByTestId('conjugated-form-note')).toBeNull();
  });

  it('says nothing when the learner arrived without a surface at all', () => {
    renderKuru();

    expect(screen.queryByTestId('conjugated-form-note')).toBeNull();
  });

  it('lists the taught forms the curriculum actually shows the word in', () => {
    mockConjugatedSpanRows = [
      { inflection: 'masu', start_offset: 7, end_offset: 10, japanese: '二十日に彼女が来ます。' },
      // A second ます occurrence must not add a second row.
      { inflection: 'masu', start_offset: 5, end_offset: 9, japanese: '学生が百人来ました。' },
      { inflection: 'te', start_offset: 0, end_offset: 2, japanese: '来て、座ってください。' },
    ];

    renderKuru();

    expect(screen.getByTestId('conjugated-forms-section')).toBeTruthy();
    expect(screen.getByText('来ます')).toBeTruthy();
    expect(screen.getByText('polite / ます-form')).toBeTruthy();
    expect(screen.getByTestId('conjugated-form-te')).toBeTruthy();
    expect(screen.getByText('て-form')).toBeTruthy();
    // ない / た never occur, so they are never invented.
    expect(screen.queryByTestId('conjugated-form-nai')).toBeNull();
    expect(screen.queryByTestId('conjugated-form-ta')).toBeNull();
  });

  it('renders nothing extra for a word with no conjugated usage', () => {
    renderKuru();

    expect(screen.queryByTestId('conjugated-forms-section')).toBeNull();
    expect(screen.queryByText('Conjugated forms')).toBeNull();
  });
});
