import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { ReviewItem } from '@/core/srs/srs.types';

import ReviewScreen from './index';

const mockGradeCurrentItem = jest.fn();
const mockDetectAnswerCollision = jest.fn();
const mockRecordTypoForCurrentItem = jest.fn();
const mockAddSynonymForCurrentItem = jest.fn().mockReturnValue({ status: 'added' });
const mockInputFocus = jest.fn();
const mockFocusScreenReaderOn = jest.fn().mockResolvedValue(undefined);

let mockCurrentItem: ReviewItem | null = makeReviewItem();
let mockCurrentIndex = 0;
let mockCursor = 0;
let mockAutoAdvanceEnabled = false;

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

/** Set by the focus-effect mock when a cleanup is registered — used to simulate blur. */
let simulateReviewBlur: (() => void) | null = null;

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      const cleanup = cb();
      simulateReviewBlur = typeof cleanup === 'function' ? cleanup : null;
      return () => {
        if (typeof cleanup === 'function') cleanup();
        simulateReviewBlur = null;
      };
    }, [cb]);
  },
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

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    setMode: jest.fn(),
    modeForItem: () => 'shown',
  }),
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: false }),
}));

jest.mock('@/data/hooks/useReviewAutoAdvance', () => ({
  useReviewAutoAdvance: () => ({
    autoAdvanceEnabled: mockAutoAdvanceEnabled,
    setAutoAdvanceEnabled: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useAnswerCollision', () => ({
  useAnswerCollision:
    () =>
    (...args: unknown[]) =>
      mockDetectAnswerCollision(...args),
}));

// Stable handle: an unstable identity would re-fire every [userDb] effect.
const mockDatabaseHandles = { curriculumDb: {}, userDb: {}, isReady: true, error: null };

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => mockDatabaseHandles,
}));

/**
 * In-memory stand-in for the `card_seen` table. Real repository semantics, no
 * SQLite: seen-state is asserted through this set, never by spying on writes.
 */
const mockSeenGuidanceCards = new Set<string>();

jest.mock('@/data/user/cardSeenRepository', () => ({
  isCardSeen: (_userDb: unknown, cardId: string) => mockSeenGuidanceCards.has(cardId),
  markCardSeen: (_userDb: unknown, cardId: string) => {
    mockSeenGuidanceCards.add(cardId);
  },
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
        state,
        testID,
      }: {
        mode: 'kana' | 'english';
        value: string;
        onChangeText: (text: string) => void;
        onSubmit: () => void;
        editable?: boolean;
        state?: string;
        testID?: string;
      },
      ref: React.Ref<{ focus: () => void }>,
    ) {
      useImperativeHandle(ref, () => ({ focus: mockInputFocus }));

      return (
        <RNTextInput
          testID={testID ?? 'review-answer-input'}
          accessibilityLabel={
            mode === 'kana' ? 'Answer input, type in romaji' : 'Answer input'
          }
          // Surfaced so the screen's state wiring is assertable — the real
          // component turns this into border/fill chrome.
          accessibilityHint={state}
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
    mockSeenGuidanceCards.clear();
    mockCurrentItem = makeReviewItem();
    mockCurrentIndex = 0;
    mockCursor = 0;
    mockAutoAdvanceEnabled = false;
    mockDetectAnswerCollision.mockReturnValue(null);
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

  it('nudges without grading or recording when the on\'yomi card gets a kun\'yomi (Story 1.1)', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({
      isTwoCardItem: true,
      answerKey: {
        acceptedMeanings: ['eat', 'food'],
        acceptedReadings: ['ショク'],
        alternateReadings: ['たべる'],
      },
    });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByText("We're looking for the on'yomi reading.")).toBeTruthy();
    });

    // Non-terminal like wrong_script: no grade, no typo record, re-prompt.
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();
    expect(mockRecordTypoForCurrentItem).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Continue')).toBeNull();
    expect(screen.getByTestId('review-answer-input').props.editable).toBe(true);
  });

  it('dresses the answer field in the verdict for every feedback state', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    render(<ReviewScreen />);

    const field = () => screen.getByTestId('review-answer-input');
    expect(field().props.accessibilityHint).toBe('idle');

    // Typo — non-terminal, so the field re-prompts wearing the near-miss chrome.
    fireEvent.changeText(field(), 'たべう');
    await act(async () => {
      fireEvent(field(), 'submitEditing');
    });
    expect(field().props.accessibilityHint).toBe('near-miss');

    // Correct — the field keeps its verdict while Return advances.
    fireEvent.changeText(field(), 'たべる');
    await act(async () => {
      fireEvent(field(), 'submitEditing');
    });
    expect(field().props.accessibilityHint).toBe('correct');
  });

  it('marks a wrong-script answer with the info chrome, not the danger chrome', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), '食べる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(screen.getByTestId('review-answer-input').props.accessibilityHint).toBe(
      'wrong-script',
    );
  });

  it('keeps the rejected answer on screen in danger chrome after a wrong answer', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    const rejected = screen.getByTestId('review-rejected-answer');
    expect(rejected.props.value).toBe('wrong');
    expect(rejected.props.accessibilityHint).toBe('incorrect');
    expect(rejected.props.editable).toBe(false);
  });

  it('shows no rejected-answer field when the learner never submitted one', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    render(<ReviewScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Don't know"));
    });

    expect(screen.queryByTestId('review-rejected-answer')).toBeNull();
    expect(screen.getByLabelText('Continue')).toBeTruthy();
  });

  it('offers Submit as the touch path, disabled until something is typed', async () => {
    render(<ReviewScreen />);

    expect(screen.getByTestId('review-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    expect(screen.getByTestId('review-submit').props.accessibilityState.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-submit'));
    });

    expect(screen.getByTestId('review-answer-input').props.accessibilityHint).toBe('correct');
  });

  it('shows the "Reading — on\'yomi" label on the kanji reading card', () => {
    mockCurrentItem = makeReviewItem({ isTwoCardItem: true });
    render(<ReviewScreen />);
    expect(screen.getByText("Reading — on'yomi")).toBeTruthy();
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

  it('shows the collision line on the incorrect reveal when the answer belongs to another item (FR86)', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    mockDetectAnswerCollision.mockReturnValue({ itemId: 'other-9', primaryForm: '飲' });

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'drink');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByText('Your answer belongs to a different item: 飲.')).toBeTruthy();
    });
    expect(mockDetectAnswerCollision).toHaveBeenCalledWith(mockCurrentItem, 'drink');
    expect(screen.getByLabelText('Compare with 飲')).toBeTruthy();
  });

  it('shows no collision line for a plain miss', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);

    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });
    expect(screen.queryByText(/different item/)).toBeNull();
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

describe('ReviewScreen — Return-to-advance pacing (Story 1.2, FR84)', () => {
  function makeMcGrammarItem(): ReviewItem {
    return makeReviewItem({
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
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSeenGuidanceCards.clear();
    mockCurrentItem = makeReviewItem();
    mockCurrentIndex = 0;
    mockCursor = 0;
    mockAutoAdvanceEnabled = false;
    mockDetectAnswerCollision.mockReturnValue(null);
    mockFocusScreenReaderOn.mockResolvedValue(undefined);

    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('waits indefinitely after a correct answer by default (no 800ms auto-advance)', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(screen.getByLabelText('Correct, reading: たべる')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();
  });

  it('advances on the second Return without re-evaluating the (empty) input', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    // The input stays editable so the return key can still fire.
    expect(screen.getByTestId('review-answer-input').props.editable).toBe(true);

    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('a third Return is a no-op (grade applied once)', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
  });

  it('auto-advances after 800ms when Lightning Mode is enabled', async () => {
    mockAutoAdvanceEnabled = true;
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('Return during the Lightning window advances immediately and cancels the timer', async () => {
    mockAutoAdvanceEnabled = true;
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);

    // The cancelled timer must not grade a second time.
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
  });

  it('flushes the pending grade on unmount under the indefinite wait (FR84)', async () => {
    const { unmount } = render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    unmount();
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('flushes the pending grade on End Session under the indefinite wait (FR84)', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('End session'));
    // Header ✕ and the sheet's destructive action share the same a11y name —
    // pick the sheet button (last match once the sheet is open).
    const endButtons = screen.getAllByRole('button', { name: 'End session' });
    fireEvent.press(endButtons[endButtons.length - 1]!);

    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('shows a visible Continue on typed correct and advances through it', async () => {
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeTruthy();
    // Input stays mounted so second Return still works alongside Continue.
    expect(screen.getByTestId('review-answer-input').props.editable).toBe(true);
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    fireEvent.press(continueButton);
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('cancels Lightning Mode when the review screen blurs (nested details)', async () => {
    mockAutoAdvanceEnabled = true;
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    await act(async () => {
      simulateReviewBlur?.();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('still reaches the incorrect reveal when collision detection throws', async () => {
    mockDetectAnswerCollision.mockImplementation(() => {
      throw new Error('collision lookup failed');
    });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();
  });

  it('shows a visible Continue on MC-correct and advances through it', async () => {
    mockCurrentItem = makeMcGrammarItem();
    render(<ReviewScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('は'));
    });

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeTruthy();
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    fireEvent.press(continueButton);
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('keeps the Continue control on MC-correct even with Lightning Mode on (MC has no Return)', async () => {
    mockAutoAdvanceEnabled = true;
    mockCurrentItem = makeMcGrammarItem();
    render(<ReviewScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('は'));
    });

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    fireEvent.press(continueButton);
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewScreen — hints never affect grading (Plan 10.2)', () => {
  function makeHintedGrammarItem(): ReviewItem {
    return makeReviewItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      displayMeaning: 'topic marker',
      clozePrompt: '私＿＿＿学生です。',
      clozeAnswer: 'は',
      clozeNudge: "Marks the topic — what's being talked about.",
      clozeEnglish: 'I am a student.',
      inputMode: 'type_in',
      mcOptions: null,
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
      },
      srsState: { ...makeReviewItem().srsState, srsStageLabel: 'guru' },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentIndex = 0;
    mockCursor = 0;
    mockAutoAdvanceEnabled = false;
    mockDetectAnswerCollision.mockReturnValue(null);
    mockCurrentItem = makeHintedGrammarItem();

    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('revealing both hint rungs then answering correctly still grades Good (3)', async () => {
    const { unmount } = render(<ReviewScreen />);

    fireEvent.press(screen.getByLabelText('Hint'));
    expect(screen.getByText("Marks the topic — what's being talked about.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hint (1/2)'));
    expect(screen.getByText('I am a student.')).toBeTruthy();

    // Opening hints alone must never grade or record weakness.
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();
    expect(mockRecordTypoForCurrentItem).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'は');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
    expect(screen.getByLabelText('Correct, answer: は')).toBeTruthy();

    // Unmount flushes the pending auto-advance grade, same as the timer would.
    unmount();
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
    expect(mockRecordTypoForCurrentItem).not.toHaveBeenCalled();
  });

  it('revealing hints before a wrong answer still grades Again (1), not softer', async () => {
    render(<ReviewScreen />);

    fireEvent.press(screen.getByLabelText('Hint'));
    fireEvent.press(screen.getByLabelText('Hint (1/2)'));

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'を');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });
    // The grade lands on Continue, exactly as without hints — nothing earlier.
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockGradeCurrentItem).toHaveBeenCalledTimes(1);
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(1);
  });
});

describe('ReviewScreen — contextual guidance cards (Epic 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeenGuidanceCards.clear();
    mockCurrentItem = makeReviewItem();
    mockCurrentIndex = 0;
    mockCursor = 0;
    mockAutoAdvanceEnabled = false;
    mockDetectAnswerCollision.mockReturnValue(null);
    mockFocusScreenReaderOn.mockResolvedValue(undefined);

    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function submitWrongAnswer() {
    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'wrong');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });
  }

  it('explains the first miss inline, then clears it on Continue', async () => {
    render(<ReviewScreen />);

    expect(screen.queryByTestId('guidance-card-notice-first-miss')).toBeNull();

    await submitWrongAnswer();
    expect(screen.getByTestId('guidance-card-notice-first-miss')).toBeTruthy();
    expect(screen.getByText('Getting it wrong is the point')).toBeTruthy();
    // Seen is written the moment it is visible, not on dismiss.
    expect(mockSeenGuidanceCards.has('first-miss')).toBe(true);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    });
    mockCursor = 1;
    await act(async () => {
      screen.rerender(<ReviewScreen />);
    });

    expect(screen.queryByTestId('guidance-card-notice-first-miss')).toBeNull();
  });

  it('does not re-show the miss card on a second wrong answer in the same session', async () => {
    render(<ReviewScreen />);

    await submitWrongAnswer();
    expect(screen.getByTestId('guidance-card-notice-first-miss')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    });
    mockCurrentItem = makeReviewItem({ itemId: 'test-2' });
    mockCursor = 1;
    await act(async () => {
      screen.rerender(<ReviewScreen />);
    });

    await submitWrongAnswer();
    expect(screen.queryByTestId('guidance-card-notice-first-miss')).toBeNull();
  });

  it('leaves the miss card alone for a non-terminal wrong-script answer', async () => {
    mockCurrentItem = makeReviewItem({ promptType: 'meaning' });
    render(<ReviewScreen />);

    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'たべる');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(screen.queryByTestId('guidance-card-notice-first-miss')).toBeNull();
    expect(mockSeenGuidanceCards.has('first-miss')).toBe(false);
  });

  it('explains a repeat sighting and names the item', async () => {
    mockCurrentItem = makeReviewItem({
      primaryForm: '水',
      srsState: { ...makeReviewItem().srsState, reps: 2 },
    });

    render(<ReviewScreen />);

    expect(screen.getByTestId('guidance-card-notice-spaced-repetition')).toBeTruthy();
    expect(screen.getByText('Why items come back')).toBeTruthy();
    expect(screen.getByText(/You have met 水 before/)).toBeTruthy();
  });

  it('says nothing about repeats on an item’s first review', async () => {
    mockCurrentItem = makeReviewItem({ srsState: { ...makeReviewItem().srsState, reps: 0 } });

    render(<ReviewScreen />);

    expect(screen.queryByTestId('guidance-card-notice-spaced-repetition')).toBeNull();
    expect(mockSeenGuidanceCards.has('spaced-repetition')).toBe(false);
  });

  it('dismisses the repeat notice in one tap and keeps it gone', async () => {
    mockCurrentItem = makeReviewItem({
      srsState: { ...makeReviewItem().srsState, reps: 3 },
    });

    render(<ReviewScreen />);
    expect(screen.getByTestId('guidance-card-notice-spaced-repetition')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('guidance-card-notice-dismiss'));
    });
    expect(screen.queryByTestId('guidance-card-notice-spaced-repetition')).toBeNull();

    mockCursor = 1;
    await act(async () => {
      screen.rerender(<ReviewScreen />);
    });
    expect(screen.queryByTestId('guidance-card-notice-spaced-repetition')).toBeNull();
  });

  it('shows only the miss card when a repeat item is answered incorrectly', async () => {
    mockCurrentItem = makeReviewItem({
      srsState: { ...makeReviewItem().srsState, reps: 2 },
    });

    render(<ReviewScreen />);
    // The repeat sighting fires during the prompt…
    expect(screen.getByTestId('guidance-card-notice-spaced-repetition')).toBeTruthy();

    await submitWrongAnswer();

    // …and the incorrect reveal belongs to first-miss alone.
    expect(screen.getByTestId('guidance-card-notice-first-miss')).toBeTruthy();
    expect(screen.queryByTestId('guidance-card-notice-spaced-repetition')).toBeNull();
  });

  it('hides the repeat notice when the session advances to another repeat item', async () => {
    mockCurrentItem = makeReviewItem({
      srsState: { ...makeReviewItem().srsState, reps: 2 },
    });

    render(<ReviewScreen />);
    expect(screen.getByTestId('guidance-card-notice-spaced-repetition')).toBeTruthy();

    // Consecutive repeat items keep the trigger true, so the notice must be
    // cleared by the advance itself, not by an `active` edge.
    mockCurrentItem = makeReviewItem({
      itemId: 'test-2',
      primaryForm: '水',
      srsState: { ...makeReviewItem().srsState, itemId: 'test-2', reps: 5 },
    });
    mockCursor = 1;
    await act(async () => {
      screen.rerender(<ReviewScreen />);
    });

    expect(screen.queryByTestId('guidance-card-notice-spaced-repetition')).toBeNull();
  });
});
