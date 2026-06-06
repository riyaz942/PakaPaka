import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockResetSqlite,
  __mockSetItemRelationships,
  __mockSetItems,
} from '../../../__mocks__/expo-sqlite';

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

import CalibrateScreen from './calibrate';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

function renderCalibrateScreen(
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
        <CalibrateScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('CalibrateScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockReplace.mockClear();
  });

  async function createDatabases(
    items: Parameters<typeof __mockSetItems>[1] = [
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
        id: 11,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'book',
        primary_form: '本',
        meaning: 'book',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ],
  ) {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');

    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration002ItemStudyStatus,
    ]);
    expect(migrationResult.ok).toBe(true);

    setStartingJlptLevel(userDb, 'N5');
    setSessionIntensity(userDb, 'relaxed');

    __mockSetItems('curriculum.db.test', items);

    return { userDb, curriculumDb };
  }

  it('renders calibration list from curriculum db with step 3 of 4', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderCalibrateScreen(curriculumDb, userDb);

    expect(screen.getByText('What do you already know?')).toBeTruthy();
    expect(screen.getByText('Mark items at your level so reviews focus on what\'s new.')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 4')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('日')).toBeTruthy();
      expect(screen.getByText('本')).toBeTruthy();
    });
  });

  it('persists status when tapping a status option', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderCalibrateScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('calibration-item-10-status-known')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('calibration-item-10-status-known'));

    await waitFor(() => {
      expect(getStudyStatus(userDb, '10')).toBe('known');
    });
  });

  it('deletes persisted row when Not started is selected', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    setStudyStatus(userDb, '10', 'known');
    renderCalibrateScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('calibration-item-10-status-not_started')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('calibration-item-10-status-not_started'));

    await waitFor(() => {
      expect(getStudyStatus(userDb, '10')).toBeNull();
    });
  });

  it('shows empty state when no items exist for level and type', async () => {
    const { userDb, curriculumDb } = await createDatabases([]);
    renderCalibrateScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('No Kanji at N5 yet.')).toBeTruthy();
    });
  });

  it('loads a different list when the type filter changes', async () => {
    const { userDb, curriculumDb } = await createDatabases([
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
    ]);

    renderCalibrateScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('calibration-item-10')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('calibration-type-picker-radical'));

    await waitFor(() => {
      expect(screen.getByText('sun')).toBeTruthy();
      expect(screen.queryByTestId('calibration-item-10')).toBeNull();
    });
  });

  it('shows dependency hints for kanji rows', async () => {
    const { userDb, curriculumDb } = await createDatabases([
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
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        child_item_id: 10,
        parent_item_id: 1,
        relationship_type: 'requires',
      },
    ]);

    renderCalibrateScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Requires: 日')).toBeTruthy();
    });
  });

  it('navigates to bulk placeholder on Continue', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderCalibrateScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockReplace).toHaveBeenCalledWith('/onboarding/bulk');
  });
});
