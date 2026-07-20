import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
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

  it('walks the auto-built lesson and commits items on finish', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-progress-label')).toBeTruthy();
    });
    expect(screen.getByText('1/3')).toBeTruthy();

    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(screen.getByText('3/3')).toBeTruthy();

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

    // BUG2: lessons contribute to the daily goal ring. Two radicals (1 each)
    // and one kanji (3) at apprentice/correct → 5 load units, one batched write.
    expect(getDailyLoad(userDb, todayKey())?.load).toBe(5);

    expect(mockReplace).toHaveBeenCalledWith('/lesson/complete?count=3');
  });

  it('navigates backwards and forwards without committing anything', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-progress-label')).toBeTruthy();
    });

    // Back is disabled on the first item.
    expect(
      screen.getByTestId('lesson-back').props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByTestId('lesson-back'));
    expect(screen.getByText('1/3')).toBeTruthy();

    fireEvent.press(screen.getByTestId('lesson-next'));
    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(screen.getByText('3/3')).toBeTruthy();

    fireEvent.press(screen.getByTestId('lesson-back'));
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(
      screen.getByTestId('lesson-back').props.accessibilityState.disabled,
    ).toBe(false);
    fireEvent.press(screen.getByTestId('lesson-back'));
    expect(screen.getByText('1/3')).toBeTruthy();

    // Walking backwards commits nothing.
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(0);

    // Forwards again to the end still commits the full batch.
    fireEvent.press(screen.getByTestId('lesson-next'));
    fireEvent.press(screen.getByTestId('lesson-next'));
    fireEvent.press(screen.getByTestId('lesson-next'));
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(3);
  });

  it('closes without committing anything', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLessonScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('lesson-close')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('lesson-close'));

    expect(mockBack).toHaveBeenCalled();
    expect(listStudyStatusesForItems(userDb, ['1', '2', '3']).size).toBe(0);
  });
});
