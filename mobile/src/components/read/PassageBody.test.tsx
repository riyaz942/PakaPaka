import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { PassageBody } from '@/components/read/PassageBody';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

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

const body = '猫がここへ来ます。';
const bodyFurigana = '猫[ねこ]がここへ来[き]ます。';
const wordSpans: PassageWordSpan[] = [
  { vocabularyItemId: 'neko-n', startOffset: 0, endOffset: 1, inflection: null },
];

/** 来ます, a taught inflection whose span resolves to the base word 来る (14.1a). */
const inflectedSpans: PassageWordSpan[] = [
  ...wordSpans,
  { vocabularyItemId: 'kuru-v', startOffset: 5, endOffset: 8, inflection: 'masu' },
];

describe('PassageBody (14.2 — tap = details, long-press = furigana toggle)', () => {
  beforeEach(() => {
    mockSetOverride.mockClear();
    mockOverrides = new Map();
  });

  it('tap still opens word details', () => {
    const onWordPress = jest.fn();

    render(
      <PassageBody
        body={body}
        bodyFurigana={bodyFurigana}
        wordSpans={wordSpans}
        onWordPress={onWordPress}
      />,
    );

    fireEvent.press(screen.getByTestId('passage-word-neko-n-0'));
    expect(onWordPress).toHaveBeenCalledWith('neko-n', '猫', null);
    expect(mockSetOverride).not.toHaveBeenCalled();
  });

  it('long-press toggles furigana instead of opening details (explicit override case)', () => {
    const onWordPress = jest.fn();
    mockOverrides = new Map([['neko-n', 'hidden']]);

    render(
      <PassageBody
        body={body}
        bodyFurigana={bodyFurigana}
        wordSpans={wordSpans}
        onWordPress={onWordPress}
      />,
    );

    fireEvent(screen.getByTestId('passage-word-neko-n-0'), 'longPress');
    expect(mockSetOverride).toHaveBeenCalledWith('neko-n', 'shown');
    expect(onWordPress).not.toHaveBeenCalled();
  });

  it('long-press toggles furigana when the effective mode resolves via the global default (auto-like case)', () => {
    const onWordPress = jest.fn();
    // No explicit override: modeForItem falls back to the mocked global
    // 'shown' mode, so the reading is currently visible and the toggle
    // should write an explicit 'hidden' override.
    render(
      <PassageBody
        body={body}
        bodyFurigana={bodyFurigana}
        wordSpans={wordSpans}
        onWordPress={onWordPress}
      />,
    );

    fireEvent(screen.getByTestId('passage-word-neko-n-0'), 'longPress');
    expect(mockSetOverride).toHaveBeenCalledWith('neko-n', 'hidden');
    expect(onWordPress).not.toHaveBeenCalled();
  });

  it('exposes both a "Show word details" and a "Toggle furigana" accessibility action, routed correctly (NFR29)', () => {
    const onWordPress = jest.fn();

    render(
      <PassageBody
        body={body}
        bodyFurigana={bodyFurigana}
        wordSpans={wordSpans}
        onWordPress={onWordPress}
      />,
    );

    const span = screen.getByTestId('passage-word-neko-n-0');
    expect(span.props.accessibilityActions).toEqual([
      { name: 'activate', label: 'Show word details' },
      { name: 'toggleFurigana', label: 'Toggle furigana' },
    ]);

    fireEvent(span, 'accessibilityAction', { nativeEvent: { actionName: 'toggleFurigana' } });
    expect(mockSetOverride).toHaveBeenCalledWith('neko-n', 'hidden');
    expect(onWordPress).not.toHaveBeenCalled();

    fireEvent(span, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onWordPress).toHaveBeenCalledWith('neko-n', '猫', null);
  });
});

describe('PassageBody (14.1 — conjugated forms link to the base word)', () => {
  beforeEach(() => {
    mockSetOverride.mockClear();
    mockOverrides = new Map();
  });

  function renderInflected(onWordPress = jest.fn()) {
    render(
      <PassageBody
        body={body}
        bodyFurigana={bodyFurigana}
        wordSpans={inflectedSpans}
        onWordPress={onWordPress}
      />,
    );
    return onWordPress;
  }

  it('reports the base word, the surface pressed, and which taught form it was', () => {
    const onWordPress = renderInflected();

    fireEvent.press(screen.getByTestId('passage-word-kuru-v-2'));
    expect(onWordPress).toHaveBeenCalledWith('kuru-v', '来ます', 'masu');
  });

  it('gives the inflected span the same underlined link treatment as a dictionary span', () => {
    renderInflected();

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

    expect(classNamesFor('passage-word-kuru-v-2')).toEqual(
      classNamesFor('passage-word-neko-n-0'),
    );
    expect([...classNamesFor('passage-word-kuru-v-2')].join(' ')).toContain('underline');
  });

  it('long-press still toggles furigana on an inflected span (14.2 intact)', () => {
    const onWordPress = renderInflected();

    fireEvent(screen.getByTestId('passage-word-kuru-v-2'), 'longPress');
    expect(mockSetOverride).toHaveBeenCalledWith('kuru-v', 'hidden');
    expect(onWordPress).not.toHaveBeenCalled();
  });
});
