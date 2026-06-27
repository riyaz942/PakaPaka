import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockResetSqlite,
  __mockSetPassageQuestions,
  __mockSetReadingPassages,
} from '../../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import ReadScreen from './index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function renderReadScreen(
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
        <ReadScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('ReadScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockPush.mockClear();
  });

  async function createDatabases(startingLevel: 'N5' | 'N3' = 'N5') {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');

    const migrationResult = runMigrations(userDb, [migration001Initial]);
    expect(migrationResult.ok).toBe(true);

    setStartingJlptLevel(userDb, startingLevel);

    __mockSetReadingPassages('curriculum.db.test', [
      {
        id: 1,
        jlpt_level: 'N5',
        title: '自己紹介',
        body: '私は学生です。',
        sort_order: 1,
      },
      {
        id: 2,
        jlpt_level: 'N5',
        title: '買い物',
        body: '店で水を買います。',
        sort_order: 2,
      },
    ]);

    __mockSetPassageQuestions('curriculum.db.test', [
      {
        id: 1,
        passage_id: 1,
        prompt: 'この人は何ですか？',
        accepted_answers: '["学生","がくせい"]',
        sort_order: 1,
      },
      {
        id: 2,
        passage_id: 2,
        prompt: '何を買いますか？',
        accepted_answers: '["水","みず"]',
        sort_order: 1,
      },
    ]);

    return { userDb, curriculumDb };
  }

  it('renders N5 passages for the default level', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderReadScreen(curriculumDb, userDb);

    expect(screen.getByText('Read')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('自己紹介')).toBeTruthy();
      expect(screen.getByText('買い物')).toBeTruthy();
      expect(screen.getAllByText('1 question')).toHaveLength(2);
    });
  });

  it('defaults to starting JLPT level from preferences', async () => {
    const { userDb, curriculumDb } = await createDatabases('N3');
    renderReadScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('jlpt-level-N3').props.accessibilityState).toEqual({
        selected: true,
        checked: true,
      });
    });
  });

  it('shows empty state when a level has no passages', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderReadScreen(curriculumDb, userDb);

    fireEvent.press(screen.getByTestId('jlpt-level-N4'));

    await waitFor(() => {
      expect(screen.getByText('No reading passages at N4 yet.')).toBeTruthy();
    });
  });

  it('navigates to the passage reader when a row is pressed', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderReadScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('read-passage-row-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('read-passage-row-1'));

    expect(mockPush).toHaveBeenCalledWith('/read/1');
  });
});
