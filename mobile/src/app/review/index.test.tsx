import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { ReviewItem } from '@/core/srs/srs.types';

import ReviewScreen from './index';

const mockGradeCurrentItem = jest.fn();
const mockRecordTypoForCurrentItem = jest.fn();
const mockAddSynonymForCurrentItem = jest.fn().mockReturnValue({ status: 'added' });
const mockInputFocus = jest.fn();
const mockFocusScreenReaderOn = jest.fn().mockResolvedValue(undefined);

let mockCurrentItem: ReviewItem | null = makeReviewItem();
let mockCurrentIndex = 0;
let mockCursor = 0;

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: 'test-1',
    itemType: 'kanji',
    primaryForm: '食',
    displayMeaning: 'eat, food',
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
    prefetchBuffer: [],
    isLoading: false,
    isComplete: false,
    totalItems: 3,
    currentIndex: mockCurrentIndex,
    cursor: mockCursor,
    error: null,
    refetch: jest.fn(),
    gradeCurrentItem: mockGradeCurrentItem,
    peekStageTransition: jest.fn().mockReturnValue(null),
    recordTypoForCurrentItem: mockRecordTypoForCurrentItem,
    addSynonymForCurrentItem: mockAddSynonymForCurrentItem,
    cognitiveLoadPercent: 10,
    cognitiveLoadComplete: false,
    snapshotSessionDuration: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useReviewRevealDetails', () => ({
  useReviewRevealDetails: () => () => null,
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
    mockCursor = 0;
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
    mockCursor = 1;

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

  it('nudges without grading or recording when a meaning prompt gets Japanese input', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), '食べる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByText("We're looking for the meaning in English.")).toBeTruthy();
    });

    // Non-terminal: no grade, no typo/weakness record, input still editable for a retry.
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();
    expect(mockRecordTypoForCurrentItem).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Continue')).toBeNull();
    expect(screen.getByTestId('review-answer-input').props.editable).toBe(true);
  });

  it('offers the rejected answer as a synonym on the incorrect reveal', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'meal');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByText('Accept "meal" as my answer')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Accept "meal" as my answer'));
    expect(mockAddSynonymForCurrentItem).toHaveBeenCalledWith('meal', { force: false });
    await waitFor(() => {
      expect(
        screen.getByText("Added — it will be accepted on this item's next review."),
      ).toBeTruthy();
    });
  });

  it('wraps the focal zone in a scroll container and keeps the input zone mounted', () => {
    render(<ReviewScreen />);

    expect(screen.getByTestId('review-focal-scroll')).toBeTruthy();
    expect(screen.getByLabelText('Answer input, type in romaji')).toBeTruthy();
  });

  it('renders MC options instead of the text input for apprentice grammar (Plan 08)', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      displayMeaning: 'topic marker',
      clozePrompt: '私＿＿＿学生です。',
      inputMode: 'mc',
      mcOptions: ['が', 'は', 'を', 'に'],
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
      },
    });
    render(<ReviewScreen />);

    expect(screen.queryByTestId('review-answer-input')).toBeNull();
    expect(screen.getByLabelText('が')).toBeTruthy();

    // Picking the correct option grades through the normal session path.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('は'));
    });
    expect(screen.getByLabelText('Correct, answer: は')).toBeTruthy();
  });

  it('grades a wrong MC pick incorrect — never typo or wrong_script', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      displayMeaning: 'topic marker',
      clozePrompt: '私＿＿＿学生です。',
      inputMode: 'mc',
      mcOptions: ['が', 'は', 'を', 'に'],
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
      },
    });
    render(<ReviewScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('が'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });
    expect(mockRecordTypoForCurrentItem).not.toHaveBeenCalled();
  });

  it('keeps type-in for guru grammar (no MC options built)', () => {
    mockCurrentItem = makeReviewItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      clozePrompt: '私＿＿＿学生です。',
      inputMode: 'type_in',
      mcOptions: null,
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
      },
      srsState: { ...makeReviewItem().srsState, srsStageLabel: 'guru' },
    });
    render(<ReviewScreen />);

    expect(screen.getByTestId('review-answer-input')).toBeTruthy();
    expect(screen.queryByLabelText('が')).toBeNull();
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
