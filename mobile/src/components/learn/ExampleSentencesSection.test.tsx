import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import type { ExampleSentence } from '@/data/curriculum/itemRepository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

let mockOverrides = new Map<string, 'shown' | 'hidden'>();
const mockSetOverride = jest.fn((itemId: string, mode: 'shown' | 'hidden') => {
  mockOverrides.set(itemId, mode);
});

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: (itemId: string) => mockOverrides.get(itemId) ?? 'shown',
    setOverride: mockSetOverride,
  }),
}));

const linkedSentence: ExampleSentence = {
  id: '1',
  japanese: '私は学生です。',
  furigana: '私[わたし]は学生[がくせい]です。',
  english: 'I am a student.',
  sortOrder: 0,
  vocabularyLinks: [
    { itemId: '10', primaryForm: '私' },
    { itemId: '11', primaryForm: '学生' },
  ],
  spans: [
    { vocabularyItemId: '10', startOffset: 0, endOffset: 1, inflection: null },
    { vocabularyItemId: '11', startOffset: 2, endOffset: 4, inflection: null },
  ],
};

const inertSentence: ExampleSentence = {
  id: '2',
  japanese: '今日はいい天気です。',
  furigana: null,
  english: 'The weather is nice today.',
  sortOrder: 1,
  vocabularyLinks: [],
  spans: [],
};

/**
 * 来ます is a taught inflection of 来る (14.1a): the span resolves to the base
 * item, and `来[き]ます` straddles an annotated and a plain segment.
 */
const conjugatedSentence: ExampleSentence = {
  id: '4',
  japanese: '猫がここへ来ます。',
  furigana: '猫[ねこ]がここへ来[き]ます。',
  english: 'The cat comes here.',
  sortOrder: 2,
  vocabularyLinks: [
    { itemId: '30', primaryForm: '猫' },
    { itemId: '537', primaryForm: '来る' },
  ],
  spans: [
    { vocabularyItemId: '30', startOffset: 0, endOffset: 1, inflection: null },
    { vocabularyItemId: '537', startOffset: 5, endOffset: 8, inflection: 'masu' },
  ],
};

describe('ExampleSentencesSection (Plan 11.6)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetOverride.mockClear();
    mockOverrides = new Map();
  });

  it('applies a linked word\'s per-word furigana override to its span', () => {
    mockOverrides = new Map([['11', 'hidden']]);

    render(
      <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="override-example" />,
    );

    // 学生 is hidden by its own override; 私 still follows the global mode.
    expect(screen.queryByText('がくせい')).toBeNull();
    expect(screen.getByText('わたし')).toBeTruthy();
  });

  it('renders linked words as pressable spans that navigate via useItemHref', () => {
    render(
      <ItemLinkProvider base="/lesson/item">
        <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="lesson-example" />
      </ItemLinkProvider>,
    );

    fireEvent.press(screen.getByTestId('lesson-example-word-11-2'));
    expect(mockPush).toHaveBeenCalledWith('/lesson/item/11');
  });

  it('long-press toggles the word\'s furigana instead of opening details', () => {
    render(
      <ItemLinkProvider base="/browse/item">
        <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="browse-example" />
      </ItemLinkProvider>,
    );

    // 私 is currently shown (global mode, no override) — long-press should
    // flip it to an explicit 'hidden' override rather than navigate.
    fireEvent(screen.getByTestId('browse-example-word-10-0'), 'longPress');
    expect(mockSetOverride).toHaveBeenCalledWith('10', 'hidden');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('long-press toggles an explicitly hidden word back to shown', () => {
    mockOverrides = new Map([['11', 'hidden']]);

    render(
      <ItemLinkProvider base="/browse/item">
        <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="browse-example" />
      </ItemLinkProvider>,
    );

    fireEvent(screen.getByTestId('browse-example-word-11-2'), 'longPress');
    expect(mockSetOverride).toHaveBeenCalledWith('11', 'shown');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('tap still opens details', () => {
    render(
      <ItemLinkProvider base="/browse/item">
        <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="browse-example" />
      </ItemLinkProvider>,
    );

    fireEvent.press(screen.getByTestId('browse-example-word-10-0'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/10');
    expect(mockSetOverride).not.toHaveBeenCalled();
  });

  it('exposes both a "Show word details" and a "Toggle furigana" accessibility action, routed correctly (NFR29)', () => {
    render(
      <ItemLinkProvider base="/browse/item">
        <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="browse-example" />
      </ItemLinkProvider>,
    );

    const span = screen.getByTestId('browse-example-word-10-0');
    expect(span.props.accessibilityActions).toEqual([
      { name: 'activate', label: 'Show word details' },
      { name: 'toggleFurigana', label: 'Toggle furigana' },
    ]);

    fireEvent(span, 'accessibilityAction', { nativeEvent: { actionName: 'toggleFurigana' } });
    expect(mockSetOverride).toHaveBeenCalledWith('10', 'hidden');
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent(span, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(mockPush).toHaveBeenCalledWith('/browse/item/10');
  });

  it('renders sentences without links exactly as plain furigana text', () => {
    render(
      <ExampleSentencesSection sentences={[inertSentence]} testIDPrefix="inert-example" />,
    );

    expect(screen.getByTestId('inert-example-2')).toBeTruthy();
    expect(screen.queryByTestId('inert-example-2-linked')).toBeNull();
    expect(screen.getByText('今日はいい天気です。')).toBeTruthy();
    expect(screen.getByText('The weather is nice today.')).toBeTruthy();
  });

  it('renders a linked sentence inert when the curriculum shipped no spans for it', () => {
    const unspanned: ExampleSentence = {
      id: '3',
      japanese: '私は学生です。',
      furigana: null,
      english: 'I am a student.',
      sortOrder: 0,
      vocabularyLinks: [{ itemId: '99', primaryForm: '見る' }],
      spans: [],
    };

    render(
      <ExampleSentencesSection sentences={[unspanned]} testIDPrefix="miss-example" />,
    );

    expect(screen.queryByTestId('miss-example-3-linked')).toBeNull();
    expect(screen.queryByTestId(/miss-example-word-/)).toBeNull();
  });
});

describe('ExampleSentencesSection (14.1 — conjugated forms link to the base word)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetOverride.mockClear();
    mockOverrides = new Map();
  });

  function renderConjugated() {
    return render(
      <ItemLinkProvider base="/browse/item">
        <ExampleSentencesSection
          sentences={[conjugatedSentence]}
          testIDPrefix="browse-example"
        />
      </ItemLinkProvider>,
    );
  }

  it('spans the whole inflected surface, not just its dictionary stem', () => {
    renderConjugated();

    const span = screen.getByTestId('browse-example-word-537-2');
    expect(span.props.accessibilityLabel).toBe('来ます, show word details');
  });

  it('gives the inflected span the same underlined link treatment as a dictionary span', () => {
    renderConjugated();

    // An inflected span is more text nodes than a one-glyph one, so compare
    // the set of styles applied rather than the node count.
    const classNamesFor = (testID: string) =>
      new Set(
        screen
          .getByTestId(testID)
          .findAllByType(Text)
          .map((node) => node.props.className)
          .filter((value): value is string => typeof value === 'string'),
      );

    expect(classNamesFor('browse-example-word-537-2')).toEqual(
      classNamesFor('browse-example-word-30-0'),
    );
    expect([...classNamesFor('browse-example-word-537-2')].join(' ')).toContain('underline');
  });

  it('tap opens the base word, telling it which surface sent the learner there', () => {
    renderConjugated();

    fireEvent.press(screen.getByTestId('browse-example-word-537-2'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/browse/item/537',
      params: { surface: '来ます', inflection: 'masu' },
    });
  });

  it('leaves a dictionary-form tap as a bare route push', () => {
    renderConjugated();

    fireEvent.press(screen.getByTestId('browse-example-word-30-0'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/30');
  });

  it('long-press still toggles furigana on an inflected span (14.2 intact)', () => {
    renderConjugated();

    fireEvent(screen.getByTestId('browse-example-word-537-2'), 'longPress');
    expect(mockSetOverride).toHaveBeenCalledWith('537', 'hidden');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
