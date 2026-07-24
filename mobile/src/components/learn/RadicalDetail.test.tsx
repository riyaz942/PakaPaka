import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { RadicalDetail } from '@/components/learn/RadicalDetail';
import type {
  CurriculumItemDetail,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

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
  mnemonicText: 'A person walking.',
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
  visualMnemonicUrl: 'https://assets.example.com/radicals/n5/person.png',
};

const lookAlikes: VisuallySimilarItem[] = [
  { id: '2', primaryForm: '入', meaning: 'enter', itemType: 'kanji' },
];

describe('RadicalDetail', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('captions the image with the description and drops the mnemonic framing', () => {
    render(
      <RadicalDetail
        item={{
          ...baseItem,
          description: 'Two legs mid-stride, leaning into a headwind: a person.',
        }}
      />,
    );

    expect(screen.getByTestId('radical-description')).toBeTruthy();
    expect(
      screen.getByText('Two legs mid-stride, leaning into a headwind: a person.'),
    ).toBeTruthy();
    expect(screen.queryByText('Mnemonic')).toBeNull();
    expect(screen.queryByText('A person walking.')).toBeNull();
  });

  it('falls back to the pre-Rev-1 mnemonic text until the radical is regenerated', () => {
    render(<RadicalDetail item={baseItem} />);

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
