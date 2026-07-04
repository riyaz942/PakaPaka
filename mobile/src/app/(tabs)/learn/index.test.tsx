import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { bulkSetStudyStatusKnown } from '@/data/user/itemStudyStatusRepository';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import LearnScreen from './index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  useFocusEffect: () => {},
}));

function renderLearnScreen(
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
        <LearnScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

const N5_ITEMS = [
  {
    id: 1,
    item_type: 'kanji',
    jlpt_level: 'N5',
    slug: 'day',
    primary_form: '日',
    meaning: 'day',
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: 1,
  },
  {
    id: 2,
    item_type: 'kanji',
    jlpt_level: 'N5',
    slug: 'book',
    primary_form: '本',
    meaning: 'book',
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: 2,
  },
  {
    id: 3,
    item_type: 'vocabulary',
    jlpt_level: 'N5',
    slug: 'watashi',
    primary_form: '私',
    meaning: 'I, me',
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: 1,
  },
  {
    id: 4,
    item_type: 'grammar',
    jlpt_level: 'N5',
    slug: 'desu',
    primary_form: 'です',
    meaning: 'to be (polite)',
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: 1,
  },
  {
    id: 5,
    item_type: 'radical',
    jlpt_level: 'N5',
    slug: 'one',
    primary_form: '一',
    meaning: 'one',
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: 1,
  },
  {
    id: 6,
    item_type: 'radical',
    jlpt_level: 'N5',
    slug: 'mouth',
    primary_form: '口',
    meaning: 'mouth',
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: 2,
  },
];

describe('LearnScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockPush.mockClear();
  });

  async function createDatabases() {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');

    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration002ItemStudyStatus,
    ]);
    expect(migrationResult.ok).toBe(true);

    setStartingJlptLevel(userDb, 'N5');
    __mockSetItems('curriculum.db.test', N5_ITEMS);

    return { userDb, curriculumDb };
  }

  it("renders an auto-built Today's lesson hero", async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-todays-lesson')).toBeTruthy();
    });

    // Relaxed default = 5 items from the 6 available.
    expect(screen.getByText('5 new items, picked for you')).toBeTruthy();
  });

  it('starts the lesson session with a single tap', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-todays-lesson')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('learn-todays-lesson'));

    expect(mockPush).toHaveBeenCalledWith('/lesson');
  });

  it('shows the caught-up state when everything is known', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    bulkSetStudyStatusKnown(
      userDb,
      N5_ITEMS.map((item) => String(item.id)),
    );

    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-lesson-empty')).toBeTruthy();
    });
  });

  it('navigates to the browse list when a level is chosen', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-browse-level')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('jlpt-level-N4'));

    expect(mockPush).toHaveBeenCalledWith('/learn/N4');
  });
});
