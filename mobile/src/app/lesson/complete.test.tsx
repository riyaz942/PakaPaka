import { render, screen } from '@testing-library/react-native';
import React from 'react';

import LessonCompleteScreen from './complete';

let mockParams: { count?: string; itemIds?: string } = {};

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('LessonCompleteScreen', () => {
  it('offers the quiz when the lesson started reviewable items', () => {
    mockParams = { count: '2', itemIds: encodeURIComponent('1,2') };
    render(<LessonCompleteScreen />);

    expect(screen.getByTestId('lesson-complete-quiz')).toBeTruthy();
    expect(screen.getByText("They're in your review queue now.")).toBeTruthy();
  });

  it('complete screen hides quiz when no reviewable items', () => {
    mockParams = { count: '1', itemIds: '' };
    render(<LessonCompleteScreen />);

    expect(screen.queryByTestId('lesson-complete-quiz')).toBeNull();
    expect(screen.queryByText(/Quiz me now tests only/)).toBeNull();
    expect(screen.queryByText("They're in your review queue now.")).toBeNull();
    expect(screen.getByText('Nothing to review from this lesson.')).toBeTruthy();
    expect(screen.getByTestId('lesson-complete-done')).toBeTruthy();
  });
});
