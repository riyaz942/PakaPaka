import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import PlacementScreen from './placement';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function kanji(id: number, form: string, sortOrder: number, level = 'N4') {
  return {
    id,
    item_type: 'kanji',
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: form,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

function radical(id: number, form: string, sortOrder: number, level = 'N5') {
  return {
    id,
    item_type: 'radical',
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: form,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

function renderPlacementScreen(
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
        <PlacementScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('PlacementScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockReplace.mockClear();
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

    setStartingJlptLevel(userDb, 'N4');
    __mockSetItems('curriculum.db.test', [
      kanji(11, '会', 1),
      kanji(12, '同', 2),
      kanji(13, '事', 3),
      kanji(14, '自', 4),
      radical(1, '一', 1),
      radical(2, '口', 2),
    ]);

    return { userDb, curriculumDb };
  }

  it('walks the self-check and applies the placement on confirm', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    // 4 N4 kanji sampled → answer know, know, not yet, not yet.
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Sounds right' }));

    // Ratio 0.5 → first two kanji known; both N5 radicals marked known as prerequisites.
    const statuses = listStudyStatusesForItems(userDb, ['11', '12', '13', '14', '1', '2']);
    expect(statuses.get('11')).toBe('known');
    expect(statuses.get('12')).toBe('known');
    expect(statuses.get('13')).toBeUndefined();
    expect(statuses.get('14')).toBeUndefined();
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');

    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('skip check still unlocks lower levels without marking level items', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('onboarding-primary-action'));

    const statuses = listStudyStatusesForItems(userDb, ['11', '12', '1', '2']);
    expect(statuses.get('11')).toBeUndefined();
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');

    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });
});
