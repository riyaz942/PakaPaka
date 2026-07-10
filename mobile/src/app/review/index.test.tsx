import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { ReviewItem } from '@/core/srs/srs.types';

import ReviewScreen from './index';

const mockGradeCurrentItem = jest.fn();
const mockRecordTypoForCurrentItem = jest.fn();
const mockInputFocus = jest.fn();
const mockFocusScreenReaderOn = jest.fn().mockResolvedValue(undefined);

let mockCurrentItem: ReviewItem | null = makeReviewItem();
let mockCurrentIndex = 0;

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: 'test-1',
    itemType: 'kanji',
    primaryForm: '食',
    meanings: ['eat', 'food'],
    promptType: 'reading',
    answerKey: {
      acceptedMeanings: ['eat', 'food'],
      acceptedReadings: ['たべる'],
    },
    relatedItems: [],
    reinforcementLink: null,
    srsState: {
      itemId: 'test-1',
      stability: 1,
      difficulty: 5,
      dueDate: new Date().toISOString(),
      fsrsState: 'new',
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      isBurned: false,
      srsStageLabel: 'apprentice',
      lastReviewedAt: null,
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

jest.mock('@/utils/accessibilityFocus', () => ({
  focusScreenReaderOn: (...args: unknown[]) => mockFocusScreenReaderOn(...args),
}));

jest.mock('@react-navigation/core', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
}));

jest.mock('@/providers/ReviewSessionProvider', () => ({
  useReviewSession: () => ({
    currentItem: mockCurrentItem,
    isLoading: false,
    isComplete: false,
    totalItems: 3,
    currentIndex: mockCurrentIndex,
    error: null,
    refetch: jest.fn(),
    gradeCurrentItem: mockGradeCurrentItem,
    recordTypoForCurrentItem: mockRecordTypoForCurrentItem,
    cognitiveLoadPercent: 10,
    cognitiveLoadComplete: false,
    snapshotSessionDuration: jest.fn(),
  }),
}));

jest.mock('@/components/review/WanaKanaInput', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  const { forwardRef, useImperativeHandle } = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  const { TextInput: RNTextInput } = require('react-native');

  return {
    WanaKanaInput: forwardRef(function MockWanaKanaInput(
      {
        mode,
        value,
        onChangeText,
        onSubmit,
        editable,
      }: {
        mode: 'kana' | 'english';
        value: string;
        onChangeText: (text: string) => void;
        onSubmit: () => void;
        editable?: boolean;
      },
      ref: React.Ref<{ focus: () => void }>,
    ) {
      useImperativeHandle(ref, () => ({ focus: mockInputFocus }));

      return (
        <RNTextInput
          testID="review-answer-input"
          accessibilityLabel={
            mode === 'kana' ? 'Answer input, type in romaji' : 'Answer input'
          }
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          editable={editable}
        />
      );
    }),
  };
});

describe('ReviewScreen accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentItem = makeReviewItem();
    mockCurrentIndex = 0;
    mockFocusScreenReaderOn.mockResolvedValue(undefined);

    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('announces converted kana on submit for reading prompts', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('たべる');
  });

  it('moves screen reader focus to the result region after a correct submit', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Correct, reading: たべる')).toBeTruthy();

    await waitFor(() => {
      expect(mockFocusScreenReaderOn).toHaveBeenCalled();
    });
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith(
      expect.stringContaining('Correct'),
    );
  });

  it('refocuses the answer input when advancing to the next item', async () => {
    const { rerender } = render(<ReviewScreen />);

    mockCurrentItem = makeReviewItem({ itemId: 'test-2' });
    mockCurrentIndex = 1;

    await act(async () => {
      rerender(<ReviewScreen />);
    });

    await waitFor(() => {
      expect(mockInputFocus).toHaveBeenCalled();
    });
  });

  it('shows Continue and does not use SR focus on incorrect result when screen reader is disabled', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Continue')).toBeTruthy();
    });

    expect(mockFocusScreenReaderOn).not.toHaveBeenCalled();
  });

  it('moves screen reader focus to the result region on incorrect submit', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFocusScreenReaderOn).toHaveBeenCalled();
    });
  });

  it('wraps the focal zone in a scroll container and keeps the input zone mounted', () => {
    render(<ReviewScreen />);

    expect(screen.getByTestId('review-focal-scroll')).toBeTruthy();
    expect(screen.getByLabelText('Answer input, type in romaji')).toBeTruthy();
  });

  it('exposes answer input by accessibilityLabel and Continue as a button role', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    expect(screen.getByLabelText('Answer input')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Answer input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByLabelText('Answer input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });
  });
});
