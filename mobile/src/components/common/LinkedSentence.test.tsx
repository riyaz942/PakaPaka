import { fireEvent, render, screen } from '@testing-library/react-native';

import { LinkedSentence } from '@/components/common/LinkedSentence';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: () => 'shown',
    setOverride: jest.fn(),
  }),
}));
jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

const SPANS = [
  { vocabularyItemId: '1', startOffset: 0, endOffset: 2, inflection: null },
  { vocabularyItemId: '2', startOffset: 2, endOffset: 5, inflection: 'ta' as const },
];

function renderSentence(locked: boolean, isLinked?: (id: string) => boolean) {
  render(
    <LinkedSentence
      japanese="もう食べた。"
      furigana="もう食[た]べた。"
      spans={SPANS}
      testIDPrefix="t"
      sentenceId="s1"
      isLinked={isLinked}
      grammarSpan={{ start: 4, end: 5, locked, itemId: '99' }}
    />,
  );
}

describe('LinkedSentence', () => {
  beforeEach(() => mockPush.mockReset());

  it('a locked grammar span is not a button and says it is locked', () => {
    renderSentence(true);
    const grammar = screen.getByTestId('t-grammar');
    expect(grammar.props.accessibilityLabel).toBe('た, grammar, answer first to open it');
    fireEvent.press(grammar);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('an unlocked grammar span opens the grammar point', () => {
    renderSentence(false);
    fireEvent.press(screen.getByTestId('t-grammar'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/99');
  });

  it('while the grammar is locked, a word cut by it opens without its inflection', () => {
    renderSentence(true);
    fireEvent.press(screen.getByTestId('t-word-2-1'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/2');
  });

  it('after answering, the same word opens with its inflection', () => {
    renderSentence(false);
    fireEvent.press(screen.getByTestId('t-word-2-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/browse/item/2',
      params: { surface: '食べ', inflection: 'ta' },
    });
  });

  it('a word that is not linked is plain text', () => {
    renderSentence(false, (id) => id !== '1');
    expect(screen.queryByTestId('t-word-1-0')).toBeNull();
    expect(screen.getByText('もう')).toBeTruthy();
  });
});
