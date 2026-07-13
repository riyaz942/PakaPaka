import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { LessonMarkdown } from '@/components/common/LessonMarkdown';

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
});
