import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { RadicalDetail } from '@/components/learn/RadicalDetail';
import type {
  CurriculumItemDetail,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// Radical art is bundled, so the real map only contains committed files. These
// tests exercise layout, not asset resolution: treat any ref as drawn.
jest.mock('@/utils/radicalImages', () => ({
  getRadicalImage: (ref?: string | null) => (ref ? 1 : undefined),
}));

jest.mock('@/data/hooks/useDatabase', () => {
  // Stable object: an unstable identity would re-fire db-keyed effects every render.
  const databases = {
    userDb: {
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      runSync: jest.fn(),
    },
    curriculumDb: {},
  };
  return { useDatabase: () => databases };
});

const baseItem: CurriculumItemDetail = {
  id: '1',
  slug: 'person',
  itemType: 'radical',
  jlptLevel: 'N5',
  primaryForm: '人',
  furigana: null,
  meaning: 'person',
  wordType: null,
  readingComposition: null,
  mnemonicText: 'A person walking.',
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
  visualMnemonicUrl: 'radicals/person.webp',
};

const lookAlikes: VisuallySimilarItem[] = [
  { id: '2', primaryForm: '入', meaning: 'enter', itemType: 'kanji' },
];

describe('RadicalDetail', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('captions the image with the mnemonic and drops the "Mnemonic" framing', () => {
    render(<RadicalDetail item={baseItem} />);

    expect(screen.getByTestId('radical-description')).toBeTruthy();
    expect(screen.getByText('A person walking.')).toBeTruthy();
    expect(screen.queryByText('Mnemonic')).toBeNull();
  });

  it('highlights the meaning the story lands on and never shows the markup', () => {
    render(
      <RadicalDetail
        item={{
          ...baseItem,
          mnemonicText: 'Two legs mid-stride: a <radical>person</radical>.',
        }}
      />,
    );

    // Scoped to the caption: "person" is also the meaning printed in the header.
    const caption = within(screen.getByTestId('radical-description'));
    expect(caption.getByText('person').props.className).toContain('text-content-radical');
    expect(caption.getByText('Two legs mid-stride: a ')).toBeTruthy();
    expect(screen.queryByText(/<radical>/)).toBeNull();
  });

  it('omits the description block when the radical has no nuance to add', () => {
    render(<RadicalDetail item={baseItem} />);

    expect(screen.queryByTestId('item-description')).toBeNull();
  });

  it('renders the description as its own block, not in place of the mnemonic', () => {
    render(
      <RadicalDetail
        item={{
          ...baseItem,
          description: 'Not to be confused with 入, whose left stroke starts higher.',
        }}
      />,
    );

    expect(screen.getByTestId('item-description')).toBeTruthy();
    expect(
      screen.getByText('Not to be confused with 入, whose left stroke starts higher.'),
    ).toBeTruthy();
    expect(screen.getByText('A person walking.')).toBeTruthy();
  });

  it('opens Compare from a look-alike chip', () => {
    render(<RadicalDetail item={baseItem} lookAlikes={lookAlikes} />);

    fireEvent.press(screen.getByTestId('look-alike-2'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/browse/compare',
      params: { left: '1', right: '2' },
    });
  });
});
