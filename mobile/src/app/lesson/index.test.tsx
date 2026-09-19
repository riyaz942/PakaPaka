import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { migration009Streak } from '@/data/migrations/009_streak';
import { migration014StreakCelebration } from '@/data/migrations/014_streak_celebration';
import { migration015GoalRingState } from '@/data/migrations/015_goal_ring_state';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { getDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { getDueSrsStates } from '@/data/user/srsStateRepository';
import { getStreak } from '@/data/user/streakRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import LessonScreen from './index';

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => true,
  },
  // LessonHero -> useIsKnownWord subscribes via useFocusEffect; without it the
  // mocked module leaves the hook undefined and the whole screen fails to render.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

function item(
  id: number,
  itemType: string,
  form: string,
  sortOrder: number,
  level = 'N5',
) {
  return {
    id,
    item_type: itemType,
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: form,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

function renderLessonScreen(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
) {
  const contextValue: DatabaseContextValue = {
    curriculumDb,
    userDb,
    isReady: true,
    error: null,
  };

  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <DatabaseContext.Provider value={contextValue}>
        <LessonScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

/**
 * The section on screen, read off the stepper — one accessibility node, so the
 * assertion is exactly what a screen reader announces.
 */
function expectSection(label: string) {
  expect(screen.getByTestId('lesson-section-stepper').props.accessibilityLabel).toBe(label);
}

describe('LessonScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  async function createDatabases() {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');

    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration002ItemStudyStatus,
      migration003SrsStatesAndImportMetadata,
      migration008CognitiveLoadHistory,
      migration009Streak,
      migration014StreakCelebration,
      migration015GoalRingState,
    ]);
    expect(migrationResult.ok).toBe(true);

    setStartingJlptLevel(userDb, 'N5');
    __mockSetItems('curriculum.db.test', [
      item(1, 'radical', '一', 1),
      item(2, 'radical', '口', 2),
      item(3, 'kanji', '日', 1),
    ]);

    return { userDb, curriculumDb };
  }

  /** Walks the three sections of the current item, landing on section 3. */
  function walkToLastSection() {
    fireEvent.press(screen.getByTestId('lesson-next'));
    fireEvent.press(screen.getByTestId('lesson-next'));
  }

  /** Section 1 → 2 → 3 → next item. */
  function advanceItem() {
    walkToLastSection();
    fireEvent.press(screen.getByTestId('lesson-next'));
  }

  /**
   * Drags the card past the commit threshold and releases. Gesture callbacks
   * land outside React's event path, so the state update needs its own act().
   */
  function swipe(direction: 'next' | 'back') {
    const sign = direction === 'next' ? -1 : 1;
    act(() => {
      fireGestureHandler(getByGestureTestId('lesson-card-pan'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: sign * 60 },
        { state: State.ACTIVE, translationX: sign * 140 },
        { state: State.END, translationX: sign * 140, velocityX: sign * 900 },
      ]);
    });
  }

  /** Drags short of the threshold and releases — the card should snap back. */
  function swipeAndCancel(direction: 'next' | 'back') {
    const sign = direction === 'next' ? -1 : 1;
    act(() => {
      fireGestureHandler(getByGestureTestId('lesson-card-pan'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: sign * 30 },
        { state: State.END, translationX: sign * 30, velocityX: sign * 40 },
      ]);
    });
  }

  it('walks the auto-built lesson and commits items on finish', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-session-header')).toBeTruthy();
    });
    expect(screen.getByText('1/3')).toBeTruthy();

    // Sections pace the item; the progress bar still counts items only.
    walkToLastSection();
    expect(screen.getByText('1/3')).toBeTruthy();
    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(screen.getByText('2/3')).toBeTruthy();
    advanceItem();
    expect(screen.getByText('3/3')).toBeTruthy();

    walkToLastSection();

    // Nothing committed until the lesson is finished.
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(0);

    fireEvent.press(screen.getByTestId('lesson-next'));

    const statuses = listStudyStatusesForItems(userDb, ['1', '2', '3']);
    expect(statuses.get('1')).toBe('in_progress');
    expect(statuses.get('2')).toBe('in_progress');
    expect(statuses.get('3')).toBe('in_progress');

    // Seeded SRS states are due immediately, powering the quiz handoff.
    expect(getDueSrsStates(userDb)).toHaveLength(3);

    // Finishing a lesson earns the daily streak credit.
    expect(getStreak(userDb).currentStreak).toBe(1);

    // Lessons contribute to the daily goal ring: each learned item counts as
    // one, regardless of type — three items here, one batched write.
    expect(getDailyLoad(userDb, todayKey())?.load).toBe(3);

    expect(mockReplace).toHaveBeenCalledWith('/lesson/complete?count=3');
  });

  it('advances and rewinds sections before items, committing nothing', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-session-header')).toBeTruthy();
    });

    // Back is disabled on the first section of the first item.
    expect(
      screen.getByTestId('lesson-back').props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByTestId('lesson-back'));
    expect(screen.getByText('1/3')).toBeTruthy();

    // Continue walks sections, then hands over to the item control.
    expectSection('Section 1 of 3: Intro');
    fireEvent.press(screen.getByTestId('lesson-next'));
    expectSection('Section 2 of 3: Mnemonic');
    fireEvent.press(screen.getByTestId('lesson-next'));
    expectSection('Section 3 of 3: Examples');
    expect(screen.getByText('1/3')).toBeTruthy();

    // Back rewinds within the item before leaving it.
    fireEvent.press(screen.getByTestId('lesson-back'));
    expectSection('Section 2 of 3: Mnemonic');
    expect(screen.getByText('1/3')).toBeTruthy();

    // From section 2: one Continue to section 3, one more to the next item.
    fireEvent.press(screen.getByTestId('lesson-next'));
    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(screen.getByText('2/3')).toBeTruthy();

    // Back is the inverse of Continue: stepping out of an item backwards lands
    // on the previous item's *last* section, not its introduction.
    fireEvent.press(screen.getByTestId('lesson-back'));
    expect(screen.getByText('1/3')).toBeTruthy();
    expectSection('Section 3 of 3: Examples');

    // Walking around commits nothing.
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(0);

    // Forwards again to the end still commits the full batch.
    fireEvent.press(screen.getByTestId('lesson-next'));
    advanceItem();
    advanceItem();
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(3);
  });

  it('swipes through sections and items exactly like the buttons', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-session-header')).toBeTruthy();
    });

    // Swiping left walks the sections before handing over to the item control.
    swipe('next');
    expectSection('Section 2 of 3: Mnemonic');
    swipe('next');
    expectSection('Section 3 of 3: Examples');
    expect(screen.getByText('1/3')).toBeTruthy();

    swipe('next');
    expect(screen.getByText('2/3')).toBeTruthy();

    // Swiping right rewinds onto the previous item's last section — swiping back
    // resumes where the item ended, not at its introduction.
    swipe('back');
    expect(screen.getByText('1/3')).toBeTruthy();
    expectSection('Section 3 of 3: Examples');

    // Swipe and buttons share one path, so they interleave freely.
    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(screen.getByText('2/3')).toBeTruthy();
    swipe('back');
    expect(screen.getByText('1/3')).toBeTruthy();
    expectSection('Section 3 of 3: Examples');

    // Nothing is committed while walking around.
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(0);
  });

  it('leaves the card where it was when a drag is released short', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-session-header')).toBeTruthy();
    });

    // A half-hearted drag in either direction commits nothing — the card
    // returns home and the section is untouched.
    swipeAndCancel('next');
    expectSection('Section 1 of 3: Intro');

    swipe('next');
    swipeAndCancel('back');
    expectSection('Section 2 of 3: Mnemonic');
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('ignores a back-swipe on the very first card and finishes on the last', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-session-header')).toBeTruthy();
    });

    // A back-swipe is inert where the Back button is.
    swipe('back');
    expect(screen.getByText('1/3')).toBeTruthy();
    expectSection('Section 1 of 3: Intro');

    // Nine swipes left = three sections × three items, ending in the commit.
    for (let step = 0; step < 9; step += 1) {
      swipe('next');
    }

    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(3);
    expect(mockReplace).toHaveBeenCalledWith('/lesson/complete?count=3');
  });

  it('closes without committing anything', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-session-header-exit')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('lesson-session-header-exit'));

    expect(mockBack).toHaveBeenCalled();
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(0);
  });
});
