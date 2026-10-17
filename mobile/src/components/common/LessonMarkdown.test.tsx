import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { LessonMarkdown } from '@/components/common/LessonMarkdown';

const mockPush = jest.fn();
const mockSetOverride = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'auto',
    knownKanji: new Set<string>(),
    modeForItem: () => 'auto',
    setOverride: (...args: unknown[]) => mockSetOverride(...args),
  }),
}));
jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

const LESSON = [
  '# かどうか',
  '',
  "You're setting up a **surprise party** and don't know if he's coming.",
  '',
  '```jp',
  '彼[かれ]が来[く]るかどうか、わかりません。',
  '```',
  '',
  '> かどうか cannot be used with question words.',
  '',
  '- first rule',
  '- second rule',
].join('\n');

describe('LessonMarkdown', () => {
  it('renders headings, prose with inline styles, callouts, and lists', () => {
    render(<LessonMarkdown markdown={LESSON} mode="shown" />);

    expect(screen.getByTestId('lesson-markdown')).toBeTruthy();
    expect(screen.getByText('かどうか')).toBeTruthy();
    expect(screen.getByText('surprise party')).toBeTruthy();
    expect(screen.getByText('かどうか cannot be used with question words.')).toBeTruthy();
    expect(screen.getByText('first rule')).toBeTruthy();
    expect(screen.getByText('second rule')).toBeTruthy();
  });

  it('renders jp fences with furigana readings when mode is shown', () => {
    render(<LessonMarkdown markdown={LESSON} mode="shown" />);

    expect(screen.getByText('かれ')).toBeTruthy();
    expect(screen.getByText('彼')).toBeTruthy();
  });

  it('hides readings in hidden mode until the run is tapped', () => {
    render(
      <LessonMarkdown markdown={'The verb 食[た]べる is an ichidan verb.'} mode="hidden" />,
    );

    expect(screen.queryByText('た')).toBeNull();
    fireEvent.press(screen.getByText('食'));
    expect(screen.getByText('た')).toBeTruthy();
  });

  it('renders inline furigana runs inside mixed English prose', () => {
    render(
      <LessonMarkdown markdown={'The word 学生[がくせい] means student.'} mode="shown" />,
    );

    expect(screen.getByText('学生')).toBeTruthy();
    expect(screen.getByText('がくせい')).toBeTruthy();
    expect(screen.getByText('The ')).toBeTruthy();
    expect(screen.getByText('student.')).toBeTruthy();
  });

  describe('linked words', () => {
    beforeEach(() => {
      mockPush.mockReset();
      mockSetOverride.mockReset();
    });

    it('opens the word when a lesson word is tapped', () => {
      render(<LessonMarkdown markdown={'Say {{7||明日[あした]}} now.'} mode="auto" />);
      fireEvent.press(screen.getByTestId('lesson-word-7-1'));
      expect(mockPush).toHaveBeenCalledWith('/browse/item/7');
    });

    it('passes surface and inflection for a conjugated word in a jp block', () => {
      render(<LessonMarkdown markdown={'```jp\n{{12|masu|起[お]きます}}。\n```'} mode="auto" />);
      fireEvent.press(screen.getByTestId('lesson-word-12-0'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/browse/item/12',
        params: { surface: '起きます', inflection: 'masu' },
      });
    });

    it('long-press hides a visible reading for that word', () => {
      render(<LessonMarkdown markdown={'Say {{7||明日[あした]}} now.'} mode="auto" />);
      // Auto mode and the word not yet known: the reading is showing.
      expect(screen.getByText('あした')).toBeTruthy();
      fireEvent(screen.getByTestId('lesson-word-7-1'), 'longPress');
      expect(mockSetOverride).toHaveBeenCalledWith('7', 'hidden');
    });

    it('keeps each linked word reachable by screen readers', () => {
      render(<LessonMarkdown markdown={'Say {{7||明日[あした]}} now.'} mode="auto" />);
      expect(screen.getByTestId('lesson-word-7-1').props.accessibilityRole).toBe('button');
      expect(screen.queryByLabelText('Say 明日 now.')).toBeNull();
    });

    it('keeps the line label when a line has furigana but no links', () => {
      render(<LessonMarkdown markdown={'Say 明日[あした] now.'} mode="auto" />);
      expect(screen.getByLabelText('Say 明日 now.')).toBeTruthy();
    });
  });
});
