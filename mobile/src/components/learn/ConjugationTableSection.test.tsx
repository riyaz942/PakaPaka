import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { ConjugationTableSection } from '@/components/learn/ConjugationTableSection';
import type { CurriculumItemDetail } from '@/data/curriculum/itemRepository';

let mockConjugationClass: string | null = null;
let mockSamePatternRows: Record<string, unknown>[] = [];

jest.mock('@/data/hooks/useDatabase', () => {
  // Stable object: an unstable identity would re-run memoised reads every render.
  const databases = {
    curriculumDb: {
      getFirstSync: jest.fn((sql: string) =>
        /SELECT conjugation_class/i.test(sql)
          ? { conjugation_class: mockConjugationClass }
          : { jlpt_level: 'N5' },
      ),
      getAllSync: jest.fn(() => mockSamePatternRows),
    },
  };
  return { useDatabase: () => databases };
});

jest.mock('@/data/hooks/useIsKnownWord', () => ({ useIsKnownWord: () => false }));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({ modeForItem: () => 'hidden' }),
}));

const item = (overrides: Partial<CurriculumItemDetail>): CurriculumItemDetail => ({
  id: '1',
  slug: 'shiru',
  itemType: 'vocabulary',
  jlptLevel: 'N5',
  primaryForm: '知る',
  furigana: '知[し]る',
  meaning: 'to know',
  wordType: 'godan verb, transitive verb',
  readingComposition: null,
  mnemonicText: null,
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
  visualMnemonicUrl: null,
  ...overrides,
});

describe('ConjugationTableSection', () => {
  beforeEach(() => {
    mockConjugationClass = null;
    mockSamePatternRows = [];
  });

  it('shows the 8 forms, the word group and the look-alike note for 知る', () => {
    mockConjugationClass = 'godan';
    mockSamePatternRows = [{ id: 2, primary_form: '帰る', furigana: '帰[かえ]る' }];
    render(<ConjugationTableSection item={item({})} />);

    expect(screen.getByTestId('conjugation-table')).toBeTruthy();
    expect(screen.getByTestId('conjugation-cell-plainPastNegative')).toHaveTextContent(
      '知らなかった',
    );
    expect(screen.getByTestId('conjugation-cell-politePastNegative')).toHaveTextContent(
      '知りませんでした',
    );
    expect(screen.getByTestId('conjugation-word-group')).toHaveTextContent('Godan verb');
    expect(screen.getByTestId('conjugation-look-alike')).toHaveTextContent(/る → ら for ない/);
    expect(screen.getByText('Same pattern as 帰る')).toBeTruthy();
  });

  it('shows no look-alike note for an ordinary verb', () => {
    mockConjugationClass = 'godan';
    render(
      <ConjugationTableSection
        item={item({ primaryForm: '飲む', furigana: '飲[の]む', slug: 'nomu-v' })}
      />,
    );

    expect(screen.getByTestId('conjugation-word-group')).toHaveTextContent('Godan verb');
    expect(screen.queryByTestId('conjugation-look-alike')).toBeNull();
  });

  it('renders nothing for a word with no conjugation class', () => {
    render(<ConjugationTableSection item={item({ primaryForm: '私', furigana: null })} />);

    expect(screen.queryByTestId('conjugation-table')).toBeNull();
  });

  it('renders nothing when the class does not fit the word', () => {
    mockConjugationClass = 'ichidan';
    render(<ConjugationTableSection item={item({ primaryForm: '食べ', furigana: null })} />);

    expect(screen.queryByTestId('conjugation-table')).toBeNull();
  });
});
