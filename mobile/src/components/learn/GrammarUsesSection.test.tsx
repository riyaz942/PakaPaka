import { render, screen } from '@testing-library/react-native';

import { GrammarUsesSection } from '@/components/learn/GrammarUsesSection';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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

const USE = {
  label: 'L',
  structure: 'S',
  japanese: '学生です。',
  furigana: '学[がく]生[せい]です。',
  english: 'E',
};

describe('GrammarUsesSection', () => {
  it('links a word in a use sentence', () => {
    render(
      <GrammarUsesSection
        uses={[
          {
            ...USE,
            wordSpans: [{ vocabularyItemId: '5', startOffset: 0, endOffset: 2, inflection: null }],
          },
        ]}
      />,
    );
    expect(screen.getByTestId('grammar-use-0-linked')).toBeTruthy();
  });

  it('shows a use without word spans as plain text', () => {
    render(<GrammarUsesSection uses={[{ ...USE, wordSpans: [] }]} />);
    expect(screen.queryByTestId('grammar-use-0-linked')).toBeNull();
    expect(screen.getByTestId('grammar-use-0')).toBeTruthy();
  });
});
