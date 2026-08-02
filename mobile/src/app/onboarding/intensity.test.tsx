import { fireEvent, render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { getSessionIntensity, setOnboardingPath } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import IntensityScreen from './intensity';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function renderIntensityScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue: DatabaseContextValue = {
    curriculumDb: userDb,
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
        <IntensityScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('IntensityScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('enables Continue on mount with relaxed pre-selected', async () => {
    const db = await createUserDb();
    renderIntensityScreen(db);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton.props.accessibilityState?.disabled).toBe(false);

    const relaxedOption = screen.getByTestId('session-intensity-picker-relaxed');
    expect(relaxedOption.props.accessibilityState).toEqual({ selected: true, checked: true });
  });

  it('keeps Continue enabled after selecting intense', async () => {
    const db = await createUserDb();
    renderIntensityScreen(db);

    fireEvent.press(screen.getByTestId('session-intensity-picker-intense'));

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton.props.accessibilityState?.disabled).toBe(false);
    expect(screen.getByTestId('session-intensity-picker-intense').props.accessibilityState).toEqual({
      selected: true,
      checked: true,
    });
  });

  it('persists relaxed and routes the beginner path straight to complete', async () => {
    const db = await createUserDb();
    setOnboardingPath(db, 'beginner');
    renderIntensityScreen(db);

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getSessionIntensity(db)).toBe('relaxed');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('persists intense and routes the manual path to the placement check', async () => {
    const db = await createUserDb();
    setOnboardingPath(db, 'manual');
    renderIntensityScreen(db);

    fireEvent.press(screen.getByTestId('session-intensity-picker-intense'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getSessionIntensity(db)).toBe('intense');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/placement');
  });

  it('routes import path to complete on Continue', async () => {
    const db = await createUserDb();
    runMigrations(db, [migration003SrsStatesAndImportMetadata]);
    setOnboardingPath(db, 'import');
    renderIntensityScreen(db);

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getSessionIntensity(db)).toBe('relaxed');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('previews the daily lesson size for the selected pace', async () => {
    const db = await createUserDb();
    renderIntensityScreen(db);

    expect(screen.getByTestId('intensity-lesson-preview')).toBeTruthy();
  });
});
