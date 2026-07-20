import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { CompareView } from '@/components/common/CompareView';
import type { CurriculumItemDetail, CurriculumParentItem } from '@/data/curriculum/itemRepository';

function makeItem(overrides: Partial<CurriculumItemDetail> = {}): CurriculumItemDetail {
  return {
    id: 'left-1',
    slug: 'eat',
    itemType: 'kanji',
    jlptLevel: 'N5',
    primaryForm: '食',
    furigana: null,
    meaning: 'eat, food',
    mnemonicText: null,
    visualMnemonicUrl: null,
    ...overrides,
  };
}

const details: Record<string, ReturnType<typeof makeDetail>> = {};
const parents: Record<string, CurriculumParentItem[]> = {};

function makeDetail(
  item: CurriculumItemDetail | null,
  loading = false,
  extras: Partial<ReturnType<typeof makeDetailBase>> = {},
) {
  return {
    ...makeDetailBase(item, loading),
    ...extras,
  };
}

function makeDetailBase(item: CurriculumItemDetail | null, loading = false) {
  return {
    item,
    kanjiReadings: null as
      | null
      | { id: string; readingType: 'onyomi' | 'kunyomi'; reading: string; sortOrder: number }[],
    acceptedAnswers: [] as {
      id: string;
      answerType: 'meaning' | 'reading' | 'production';
      answerText: string;
      isPrimary: boolean;
    }[],
    grammarRule: null,
    exampleSentences: [],
    grammarVocabLinks: [],
    relatedGrammar: [],
    loading,
    notFound: item === null && !loading,
  };
}

jest.mock('@/data/hooks/useItemDetail', () => ({
  useItemDetail: (itemId: string | null) =>
    details[itemId ?? ''] ?? {
      item: null,
      kanjiReadings: null,
      acceptedAnswers: [],
      grammarRule: null,
      exampleSentences: [],
      grammarVocabLinks: [],
      relatedGrammar: [],
      loading: false,
      notFound: true,
    },
}));

jest.mock('@/data/hooks/useComponentParents', () => ({
  useComponentParents: (itemId: string | null) => parents[itemId ?? ''] ?? [],
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    setMode: jest.fn(),
    knownKanji: new Set(),
    refreshKnownKanji: jest.fn(),
    overrides: new Map(),
    modeForItem: () => 'shown',
    setOverride: jest.fn(),
    clearOverride: jest.fn(),
    clearAllOverrides: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useIsKnownWord', () => ({
  useIsKnownWord: () => false,
}));

describe('CompareView', () => {
  beforeEach(() => {
    for (const key of Object.keys(details)) delete details[key];
    for (const key of Object.keys(parents)) delete parents[key];

    details['left-1'] = makeDetail(makeItem());
    details['right-1'] = makeDetail(
      makeItem({ id: 'right-1', slug: 'drink', primaryForm: '飲', meaning: 'drink' }),
    );
  });

  it('renders both items side by side', () => {
    render(<CompareView leftId="left-1" rightId="right-1" />);

    expect(screen.getByTestId('compare-glyph-left')).toBeTruthy();
    expect(screen.getByTestId('compare-glyph-right')).toBeTruthy();
    expect(screen.getByText('食')).toBeTruthy();
    expect(screen.getByText('飲')).toBeTruthy();
  });

  it('keeps the glyphs outside the scrolling column content', () => {
    // FR80 "sticky glyphs": the glyph row must not live inside the ScrollView,
    // or it scrolls away from the attributes it labels.
    render(<CompareView leftId="left-1" rightId="right-1" />);

    const scroll = screen.getByTestId('compare-scroll');
    expect(screen.getByTestId('compare-glyph-row')).toBeTruthy();
    expect(
      scroll.findAll((node) => node.props?.testID === 'compare-glyph-row'),
    ).toHaveLength(0);
  });

  it('columnizes short attributes for both items', () => {
    details['left-1'] = makeDetail(makeItem(), false, {
      kanjiReadings: [
        { id: 'r1', readingType: 'onyomi', reading: 'ショク', sortOrder: 1 },
      ],
    });
    details['right-1'] = makeDetail(
      makeItem({ id: 'right-1', slug: 'drink', primaryForm: '飲', meaning: 'drink' }),
      false,
      {
        kanjiReadings: [
          { id: 'r2', readingType: 'onyomi', reading: 'イン', sortOrder: 1 },
        ],
      },
    );
    render(<CompareView leftId="left-1" rightId="right-1" />);

    expect(screen.getByText('eat, food')).toBeTruthy();
    expect(screen.getByText('drink')).toBeTruthy();
    expect(screen.getByText('Reading')).toBeTruthy();
    expect(screen.getByText('ショク')).toBeTruthy();
    expect(screen.getByText('イン')).toBeTruthy();
    expect(screen.getAllByText('N5')).toHaveLength(2);
  });

  it('stacks prose rather than columnizing it', () => {
    details['left-1'] = makeDetail(makeItem({ mnemonicText: 'A mouth eating rice.' }));
    details['right-1'] = makeDetail(
      makeItem({ id: 'right-1', primaryForm: '飲', meaning: 'drink', mnemonicText: 'Sipping.' }),
    );
    render(<CompareView leftId="left-1" rightId="right-1" />);

    expect(screen.getByTestId('compare-prose-left')).toBeTruthy();
    expect(screen.getByTestId('compare-prose-right')).toBeTruthy();
    expect(screen.getByText('A mouth eating rice.')).toBeTruthy();
    expect(screen.getByText('Sipping.')).toBeTruthy();
  });

  it('dims component chips the two items share', () => {
    parents['left-1'] = [
      { id: 'rad-1', primaryForm: '⻞', itemType: 'radical' },
      { id: 'rad-2', primaryForm: '人', itemType: 'radical' },
    ];
    parents['right-1'] = [
      { id: 'rad-1', primaryForm: '⻞', itemType: 'radical' },
      { id: 'rad-3', primaryForm: '欠', itemType: 'radical' },
    ];
    render(<CompareView leftId="left-1" rightId="right-1" />);

    expect(screen.getByTestId('compare-chip-left-rad-1').props.accessibilityLabel).toContain(
      'shared',
    );
    expect(screen.getByTestId('compare-chip-right-rad-1').props.accessibilityLabel).toContain(
      'shared',
    );
    expect(screen.getByTestId('compare-chip-left-rad-2').props.accessibilityLabel).not.toContain(
      'shared',
    );
  });

  it('does not dim anything when the items share no components', () => {
    parents['left-1'] = [{ id: 'rad-2', primaryForm: '人', itemType: 'radical' }];
    parents['right-1'] = [{ id: 'rad-3', primaryForm: '欠', itemType: 'radical' }];
    render(<CompareView leftId="left-1" rightId="right-1" />);

    expect(screen.getByTestId('compare-chip-left-rad-2').props.accessibilityLabel).not.toContain(
      'shared',
    );
    expect(screen.getByTestId('compare-chip-right-rad-3').props.accessibilityLabel).not.toContain(
      'shared',
    );
  });

  it('reports a missing item instead of rendering half a comparison', () => {
    render(<CompareView leftId="left-1" rightId="nope" />);

    expect(screen.getByTestId('compare-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('compare-glyph-row')).toBeNull();
  });

  it('reports missing params rather than crashing', () => {
    render(<CompareView leftId={undefined} rightId={undefined} />);

    expect(screen.getByTestId('compare-unavailable')).toBeTruthy();
  });
});
