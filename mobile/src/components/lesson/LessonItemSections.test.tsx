import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import {
  LessonIntroSection,
  LessonMnemonicSectionView,
  type LessonSectionProps,
} from '@/components/lesson/LessonItemSections';
import type { CurriculumItemDetail, GrammarRule } from '@/data/curriculum/itemRepository';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

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

const item: CurriculumItemDetail = {
  id: '50',
  slug: 'wa-topic',
  itemType: 'grammar',
  jlptLevel: 'N5',
  primaryForm: 'は',
  furigana: null,
  meaning: 'topic marker',
  wordType: null,
  readingComposition: null,
  mnemonicText: null,
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
  visualMnemonicUrl: null,
};

const grammarRule: GrammarRule = {
  structure: 'Noun + は + comment',
  conjugationRules: { particle: 'topic' },
  acceptedForms: ['は'],
  family: 'particles',
  explanationMarkdown: [
    'You name your topic, stick は after it, then comment.',
    '',
    '## How it works',
    '',
    'The structure is Noun + は + comment.',
    '',
    '## Contrast',
    '',
    'Very soon you will meet が.',
  ].join('\n'),
  cautionNotes: ['は is pronounced wa, not ha.'],
  uses: [],
};

const props: LessonSectionProps = {
  item,
  kanjiReadings: [],
  grammarRule,
  exampleSentences: [],
  grammarVocabLinks: [],
  relatedGrammar: [],
  parents: [],
  showReadingPrimer: false,
};

function renderIntro() {
  render(
    <ItemLinkProvider base="/lesson/item">
      <LessonIntroSection {...props} />
    </ItemLinkProvider>,
  );
}

describe('LessonIntroSection — grammar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the essay opening and the structure, not the reference blocks', () => {
    renderIntro();

    expect(screen.getByText(/You name your topic/)).toBeTruthy();
    expect(screen.getByText('Noun + は + comment')).toBeTruthy();

    // The rules move to section 2; the sections after them to the detail screen.
    expect(screen.queryByText('How it works')).toBeNull();
    expect(screen.queryByText(/The structure is Noun/)).toBeNull();
    expect(screen.queryByText('Contrast')).toBeNull();
    expect(screen.queryByText('Accepted forms')).toBeNull();
    expect(screen.queryByText('Conjugation rules')).toBeNull();
    expect(screen.queryByText('は is pronounced wa, not ha.')).toBeNull();
  });

  it('lists each use in place of the single structure line', () => {
    render(
      <ItemLinkProvider base="/lesson/item">
        <LessonIntroSection
          {...props}
          grammarRule={{
            ...grammarRule,
            uses: [
              {
                label: 'Nostalgic habit',
                structure: 'Verb-た + ものだ',
                japanese: 'よく遊んだものだ。',
                furigana: null,
                english: 'I used to play a lot.',
              },
              {
                label: 'Emotional reason',
                structure: 'Plain form + もの',
                japanese: 'だって、忙しかったもの。',
                furigana: null,
                english: 'Well, I was busy, okay?',
              },
            ],
          }}
        />
      </ItemLinkProvider>,
    );

    expect(screen.getByText('2 uses')).toBeTruthy();
    expect(screen.getByText('1. Nostalgic habit')).toBeTruthy();
    expect(screen.getByText('Verb-た + ものだ')).toBeTruthy();
    expect(screen.getByText('2. Emotional reason')).toBeTruthy();
    expect(screen.getByText('Well, I was busy, okay?')).toBeTruthy();
    expect(screen.queryByText('Noun + は + comment')).toBeNull();
  });

  it('opens the detail screen inside the lesson stack', () => {
    renderIntro();

    fireEvent.press(screen.getByTestId('grammar-full-lesson-link'));

    expect(router.push).toHaveBeenCalledWith('/lesson/item/50');
  });
});

describe('LessonMnemonicSectionView — grammar', () => {
  it('teaches the rules section, and stops before the next heading', () => {
    render(<LessonMnemonicSectionView {...props} />);

    expect(screen.getByTestId('grammar-how-it-works')).toBeTruthy();
    expect(screen.getByText('How it works')).toBeTruthy();
    expect(screen.getByText(/The structure is Noun/)).toBeTruthy();

    expect(screen.queryByText('Contrast')).toBeNull();
    expect(screen.queryByText(/Very soon you will meet/)).toBeNull();
    // The hook stays on section 1, and the mnemonic empty state is gone:
    // grammar carries no curriculum mnemonic by design.
    expect(screen.queryByText(/You name your topic/)).toBeNull();
    expect(screen.queryByTestId('lesson-mnemonic-empty')).toBeNull();
  });

  it('renders only the personal mnemonic editor when the essay has no sections', () => {
    render(
      <LessonMnemonicSectionView
        {...props}
        grammarRule={{ ...grammarRule, explanationMarkdown: 'A short lesson with no headings.' }}
      />,
    );

    expect(screen.queryByTestId('grammar-how-it-works')).toBeNull();
    expect(screen.getByTestId('lesson-section-mnemonic')).toBeTruthy();
  });
});
