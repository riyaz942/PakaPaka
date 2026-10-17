import { fireEvent, render, screen } from '@testing-library/react-native';

import { LinkedWord } from '@/components/common/LinkedWord';

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

describe('LinkedWord', () => {
  beforeEach(() => mockPush.mockReset());

  it('renders trailing punctuation next to the word, outside the pressable', () => {
    render(
      <LinkedWord
        text="起[お]きます"
        surface="起きます"
        vocabularyItemId="12"
        inflection="masu"
        textClassName="text-body-lg font-jp"
        testID="w"
        trailing="。"
      />,
    );
    const word = screen.getByTestId('w');
    expect(word.props.accessibilityRole).toBe('button');
    expect(screen.getByText('。')).toBeTruthy();
    fireEvent.press(screen.getByText('。'));
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.press(word);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('renders no trailing text when none is given', () => {
    render(
      <LinkedWord
        text="明日[あした]"
        surface="明日"
        vocabularyItemId="7"
        inflection={null}
        textClassName="text-body-lg font-jp"
        testID="w"
      />,
    );
    expect(screen.queryByText('。')).toBeNull();
  });
});
