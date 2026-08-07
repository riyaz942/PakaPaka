import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: (itemId: string) => mockOverrides.get(itemId) ?? 'shown',
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
};

const inertSentence: ExampleSentence = {
  id: '2',
  japanese: '今日はいい天気です。',
  furigana: null,
  english: 'The weather is nice today.',
  sortOrder: 1,
  vocabularyLinks: [],
};

describe('ExampleSentencesSection (Plan 11.6)', () => {
  beforeEach(() => {
    mockPush.mockClear();
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

  it('long-presses the same span (NFR29 — never long-press only)', () => {
    render(
      <ItemLinkProvider base="/browse/item">
        <ExampleSentencesSection sentences={[linkedSentence]} testIDPrefix="browse-example" />
      </ItemLinkProvider>,
    );

    fireEvent(screen.getByTestId('browse-example-word-10-0'), 'onLongPress');
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

  it('skips links whose primary_form cannot be located', () => {
    const unmatched: ExampleSentence = {
      id: '3',
      japanese: '私は学生です。',
      furigana: null,
      english: 'I am a student.',
      sortOrder: 0,
      vocabularyLinks: [{ itemId: '99', primaryForm: '見る' }],
    };

    render(
      <ExampleSentencesSection sentences={[unmatched]} testIDPrefix="miss-example" />,
    );

    expect(screen.queryByTestId('miss-example-3-linked')).toBeNull();
    expect(screen.queryByTestId(/miss-example-word-/)).toBeNull();
  });
});
