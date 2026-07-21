import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

let mockTranslateOptIn = true;
jest.mock('@/data/user/preferencesRepository', () => ({
  getWordTranslateOptIn: () => mockTranslateOptIn,
}));

const REPLY = '私[わたし]は学生[がくせい]です。';
const SESSION = { provider: 'openai' as const, model: 'gpt-4o-mini' };

describe('WordLookupSheet', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockTranslate.mockReset();
    mockTranslateOptIn = true;
    mockTranslate.mockResolvedValue({
      ok: true,
      value: { text: 'ラーメン', reading: 'らーめん', meaning: 'ramen noodles' },
    });
  });

  it('offers the annotated words in the reply as lookup candidates', () => {
    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );

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

    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('word-candidate-学生'));

    expect(screen.getByText('student')).toBeTruthy();
    expect(screen.getByText(/not studied it yet/i)).toBeTruthy();

    fireEvent.press(screen.getByTestId('word-open-details'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/42');
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('translates an off-curriculum word via BYOK — no link, no reviews (FR92)', async () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };

    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('word-candidate-私'));

    await waitFor(() => expect(screen.getByText('ramen noodles')).toBeTruthy());
    expect(screen.getByText('らーめん')).toBeTruthy();
    expect(screen.getByText(/will not be added to your reviews/i)).toBeTruthy();
    expect(screen.queryByTestId('word-open-details')).toBeNull();
    expect(mockTranslate).toHaveBeenCalled();
  });

  it('spends no provider call while the translate opt-in is off', () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };
    mockTranslateOptIn = false;

    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('word-candidate-私'));

    expect(mockTranslate).not.toHaveBeenCalled();
    expect(screen.getByText('ラーメン')).toBeTruthy();
    expect(screen.getByText(/Turn on .Translate unknown words./i)).toBeTruthy();
    expect(screen.getByText(/will not be added to your reviews/i)).toBeTruthy();
  });

  it('shows a readable reason when the provider call fails', async () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };
    mockTranslate.mockResolvedValue({
      ok: false,
      error: { code: 'ai_network_error', message: 'boom', userMessage: 'Could not reach it.' },
    });

    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('word-candidate-私'));

    await waitFor(() => expect(screen.getByText('Could not reach it.')).toBeTruthy());
  });

  it('never renders a blank error when the failure carries no user message', async () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };
    mockTranslate.mockResolvedValue({
      ok: false,
      // The developer string must not be what the learner reads, and an empty
      // `userMessage` must not slip past `??` into an empty error slot.
      error: { code: 'ai_translate_parse', message: 'Provider reply was not JSON', userMessage: '' },
    });

    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('word-candidate-私'));

    await waitFor(() => expect(screen.getByText('That word could not be looked up.')).toBeTruthy());
    expect(screen.queryByText('Provider reply was not JSON')).toBeNull();
  });

  it('bills one call however many times an impatient learner taps', async () => {
    mockLookup = { kind: 'off_curriculum', text: '私' };
    mockTranslate.mockImplementation(() => new Promise(() => {}));

    render(
      <WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('word-candidate-私'));
    await waitFor(() => expect(screen.getByText('Asking your provider…')).toBeTruthy());

    fireEvent.press(screen.getByTestId('word-candidate-私'));
    fireEvent.press(screen.getByTestId('word-candidate-学生'));

    expect(mockTranslate).toHaveBeenCalledTimes(1);
  });

  it('discards a gloss that arrives after the sheet was closed', async () => {
    mockLookup = { kind: 'off_curriculum', text: 'ラーメン' };
    let resolveLate: (value: unknown) => void = () => {};
    mockTranslate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
    );

    const onClose = jest.fn();
    render(<WordLookupSheet visible messageText={REPLY} session={SESSION} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('word-candidate-私'));
    await waitFor(() => expect(screen.getByText('Asking your provider…')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();

    // The sheet is only hidden, not unmounted, so a late resolve would
    // otherwise repopulate it for whatever message is opened next.
    await act(async () => {
      resolveLate({
        ok: true,
        value: { text: 'ラーメン', reading: 'らーめん', meaning: 'ramen noodles' },
      });
    });

    expect(screen.queryByText('ramen noodles')).toBeNull();
  });

  it('says so plainly when a reply has no kanji words to look up', () => {
    render(
      <WordLookupSheet visible messageText="こんにちは" session={SESSION} onClose={jest.fn()} />,
    );

    expect(screen.getByText('No kanji words to look up in this message.')).toBeTruthy();
  });
});
