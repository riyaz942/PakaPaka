import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { PassageWordDetailSheet } from '@/components/read/PassageWordDetailSheet';
import type { CurriculumItemDetail } from '@/data/curriculum/itemRepository';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    modeForItem: () => 'shown',
    knownKanji: new Set<string>(),
  }),
}));

jest.mock('@/data/hooks/useIsKnownWord', () => ({
  useIsKnownWord: () => false,
}));

const kuru: CurriculumItemDetail = {
  id: '537',
  slug: 'kuru-v',
  itemType: 'vocabulary',
  jlptLevel: 'N5',
  primaryForm: '来る',
  furigana: '来[く]る',
  meaning: 'to come',
  mnemonicText: null,
  meaningMnemonic: null,
  readingMnemonic: null,
  description: null,
  visualMnemonicUrl: null,
};

describe('PassageWordDetailSheet (14.1 — conjugated-form note)', () => {
  it('names the conjugation and its category when the tap came from an inflected span', () => {
    render(
      <PassageWordDetailSheet
        item={kuru}
        surface="来ます"
        inflection="masu"
        visible
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByTestId('passage-word-detail-conjugated-note')).toBeTruthy();
    expect(screen.getByText('来ます is the polite / ます-form of 来る')).toBeTruthy();
  });

  it('says nothing when the surface is the dictionary form the sheet already heroes', () => {
    render(
      <PassageWordDetailSheet
        item={kuru}
        surface="来る"
        inflection={null}
        visible
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('passage-word-detail-conjugated-note')).toBeNull();
  });

  it('says nothing when no word resolved', () => {
    render(
      <PassageWordDetailSheet
        item={null}
        surface="来ます"
        inflection="masu"
        visible
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('passage-word-detail-conjugated-note')).toBeNull();
    expect(screen.getByTestId('passage-word-detail-missing')).toBeTruthy();
  });
});
