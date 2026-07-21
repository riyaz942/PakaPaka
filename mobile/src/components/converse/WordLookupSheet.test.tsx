import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

const mockTranslate = jest.fn();
jest.mock('@/data/ai/translateOffCurriculum', () => ({
  translateOffCurriculumWord: (...args: unknown[]) => mockTranslate(...args),
}));

const REPLY = '私[わたし]は学生[がくせい]です。';

describe('WordLookupSheet', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockTranslate.mockReset();
    mockTranslate.mockResolvedValue({
      ok: true,
      value: { text: 'ラーメン', reading: 'らーめん', meaning: 'ramen noodles' },
    });
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
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('translates an off-curriculum word via BYOK — no link, no reviews (FR92)', async () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };

    render(<WordLookupSheet visible messageText={REPLY} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('word-candidate-私'));

    await waitFor(() => expect(screen.getByText('ramen noodles')).toBeTruthy());
    expect(screen.getByText('らーめん')).toBeTruthy();
    expect(screen.getByText(/will not be added to your reviews/i)).toBeTruthy();
    expect(screen.queryByTestId('word-open-details')).toBeNull();
    expect(mockTranslate).toHaveBeenCalled();
  });

  it('says so plainly when a reply has no kanji words to look up', () => {
    render(<WordLookupSheet visible messageText="こんにちは" onClose={jest.fn()} />);

    expect(screen.getByText('No kanji words to look up in this message.')).toBeTruthy();
  });
});
