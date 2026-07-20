import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockResetSqlite,
  __mockSetPassagePracticeResults,
  __mockSetPassageQuestions,
  __mockSetReadingPassages,
} from '../../../../../__mocks__/expo-sqlite';

import { migration004PassagePracticeResults } from '@/data/migrations/004_passage_practice_results';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { DatabaseContext } from '@/providers/DatabaseContext';

import BrowsePassageRoute from './[id]';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

function renderPassageScreen(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
) {
  const contextValue = {
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
        <BrowsePassageRoute />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('BrowsePassageRoute', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockBack.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ id: '1' });
  });

  async function createDatabases() {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    const migrationResult = runMigrations(userDb, [migration004PassagePracticeResults]);
    expect(migrationResult.ok).toBe(true);

    __mockSetReadingPassages('curriculum.db.test', [
      {
        id: 1,
        jlpt_level: 'N5',
        title: '自己紹介',
        body: '私は学生です。',
        sort_order: 1,
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
    ]);

    return { curriculumDb, userDb };
  }

  it('renders passage title, body, and question prompt', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('passage-reader')).toBeTruthy();
      expect(screen.getByText('自己紹介')).toBeTruthy();
      expect(screen.getByText('私は学生です。')).toBeTruthy();
      expect(screen.getByText('この人は何ですか？')).toBeTruthy();
    });
  });

  it('shows correct feedback after submitting a correct answer', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('passage-question-input-1')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('passage-question-input-1'), '学生');
    fireEvent.press(screen.getByTestId('passage-question-submit-1'));

    await waitFor(() => {
      expect(screen.getByTestId('passage-question-feedback-1')).toBeTruthy();
      expect(screen.getByText('Correct')).toBeTruthy();
      expect(screen.getByText('Accepted answer: 学生 / がくせい')).toBeTruthy();
    });
  });

  it('shows incorrect feedback after submitting a wrong answer', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('passage-question-input-1')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('passage-question-input-1'), '先生');
    fireEvent.press(screen.getByTestId('passage-question-submit-1'));

    await waitFor(() => {
      expect(screen.getByText('Incorrect')).toBeTruthy();
      expect(screen.getByText('Accepted answer: 学生 / がくせい')).toBeTruthy();
    });
  });

  it('restores persisted answer state on remount', async () => {
    const { curriculumDb, userDb } = await createDatabases();

    __mockSetPassagePracticeResults('user.db', [
      {
        passage_id: 1,
        question_id: 1,
        is_correct: 0,
        user_answer: '先生',
        answered_at: '2026-06-25T10:00:00.000Z',
      },
    ]);

    const firstRender = renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Incorrect')).toBeTruthy();
      expect(screen.getByDisplayValue('先生')).toBeTruthy();
    });

    firstRender.unmount();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Incorrect')).toBeTruthy();
      expect(screen.getByDisplayValue('先生')).toBeTruthy();
    });
  });

  it('navigates back when Back is pressed', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('read-passage-back')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('read-passage-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows not found state for unknown id', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mockUseLocalSearchParams.mockReturnValue({ id: '999' });
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Passage not found.')).toBeTruthy();
    });
  });
});
