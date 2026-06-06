import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getStudyStatus,
  setStudyStatus,
} from '@/data/user/itemStudyStatusRepository';
import {
  setSessionIntensity,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import BulkScreen from './bulk';

const mockReplace = jest.fn();
const mockAlert = jest.spyOn(Alert, 'alert');

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

function renderBulkScreen(
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
        <BulkScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

function confirmBulkMark() {
  const lastCall = mockAlert.mock.calls[mockAlert.mock.calls.length - 1];
  const buttons = lastCall?.[2] as { text: string; onPress?: () => void }[] | undefined;
  const confirmButton = buttons?.find((button) => button.text === 'Mark as known');
  act(() => {
    confirmButton?.onPress?.();
  });
}

describe('BulkScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockAlert.mockClear();
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
    setSessionIntensity(userDb, 'relaxed');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '日',
        meaning: 'sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day, sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 20,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'nihon',
        primary_form: '日本',
        meaning: 'Japan',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    return { userDb, curriculumDb };
  }

  it('renders preset cards with counts at step 4 of 4', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderBulkScreen(curriculumDb, userDb);

    expect(screen.getByText('Know a whole group already?')).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('bulk-preset-radical')).toBeTruthy();
      expect(screen.getByTestId('bulk-preset-kanji')).toBeTruthy();
      expect(screen.getByTestId('bulk-preset-vocabulary')).toBeTruthy();
      expect(screen.getByTestId('bulk-preset-everything')).toBeTruthy();
    });

    expect(screen.getByText('All N5 Radicals')).toBeTruthy();
    expect(screen.getByText('All N5 Kanji')).toBeTruthy();
    expect(screen.queryByTestId('bulk-preset-grammar')).toBeNull();
  });

  it('hides presets with zero items', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    __mockSetItems('curriculum.db.test', [
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day, sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    renderBulkScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-preset-kanji')).toBeTruthy();
    });

    expect(screen.queryByTestId('bulk-preset-radical')).toBeNull();
    expect(screen.queryByTestId('bulk-preset-vocabulary')).toBeNull();
    expect(screen.queryByTestId('bulk-preset-grammar')).toBeNull();
  });

  it('shows confirmation with count and persists known status on confirm', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderBulkScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-preset-kanji-mark-action')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('bulk-preset-kanji-mark-action'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Mark as known?',
      'Mark 1 kanji as known?',
      expect.any(Array),
    );

    confirmBulkMark();

    await waitFor(() => {
      expect(getStudyStatus(userDb, '10')).toBe('known');
      expect(screen.getByTestId('bulk-success-message')).toHaveTextContent(
        '1 kanji marked as known',
        { exact: false },
      );
    });
  });

  it('clears success message when another bulk action starts', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderBulkScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-preset-kanji-mark-action')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('bulk-preset-kanji-mark-action'));
    confirmBulkMark();

    await waitFor(() => {
      expect(screen.getByTestId('bulk-success-message')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('bulk-preset-radical-mark-action'));

    expect(screen.queryByTestId('bulk-success-message')).toBeNull();
  });

  it('overwrites in_progress items when bulk marking', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    setStudyStatus(userDb, '10', 'in_progress');
    renderBulkScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-preset-kanji-mark-action')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('bulk-preset-kanji-mark-action'));
    confirmBulkMark();

    await waitFor(() => {
      expect(getStudyStatus(userDb, '10')).toBe('known');
    });
  });

  it('navigates to complete placeholder on Continue', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderBulkScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockReplace).toHaveBeenCalledWith('/onboarding/complete');
  });
});
