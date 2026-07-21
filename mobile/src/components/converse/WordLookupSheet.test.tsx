import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { WordLookupSheet } from '@/components/converse/WordLookupSheet';
import type { FlaggedWordLookup } from '@/data/ai/wordLookupRepository';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {} }),
}));

let mockLookup: FlaggedWordLookup = { kind: 'off_curriculum', text: '' };
jest.mock('@/data/ai/wordLookupRepository', () => ({
  lookupFlaggedWord: () => mockLookup,
}));

const REPLY = '私[わたし]は学生[がくせい]です。';

describe('WordLookupSheet', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('offers the annotated words in the reply as lookup candidates', () => {
    render(<WordLookupSheet visible messageText={REPLY} onClose={jest.fn()} />);

    expect(screen.getByTestId('word-candidate-私')).toBeTruthy();
    expect(screen.getByTestId('word-candidate-学生')).toBeTruthy();
  });

  it('deep-links a curriculum word to its details page (FR93)', () => {
    mockLookup = {
      kind: 'curriculum',
      itemId: '42',
      primaryForm: '学生',
      meaning: 'student',
      studied: false,
    };

    render(<WordLookupSheet visible messageText={REPLY} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('word-candidate-学生'));

    expect(screen.getByText('student')).toBeTruthy();
    expect(screen.getByText(/not studied it yet/i)).toBeTruthy();

    fireEvent.press(screen.getByTestId('word-open-details'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/42');
  });

  it('shows an off-curriculum word for reference only — no link, no reviews (FR92)', () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };

    render(<WordLookupSheet visible messageText={REPLY} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('word-candidate-私'));

    expect(screen.getByText('ラーメン')).toBeTruthy();
    expect(screen.getByText(/will not be added to your reviews/i)).toBeTruthy();
    // No deep link is offered, so there is no path to an SRS row.
    expect(screen.queryByTestId('word-open-details')).toBeNull();
  });

  it('says so plainly when a reply has no kanji words to look up', () => {
    render(<WordLookupSheet visible messageText="こんにちは" onClose={jest.fn()} />);

    expect(screen.getByText('No kanji words to look up in this message.')).toBeTruthy();
  });
});
