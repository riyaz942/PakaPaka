import { fireEvent, render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  isOnboardingCompleted,
  setSessionIntensity,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import CompleteScreen from './complete';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

function renderCompleteScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
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
        <CompleteScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('CompleteScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockReplace.mockClear();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration001Initial]);
    expect(migrationResult.ok).toBe(true);
    setStartingJlptLevel(userDb, 'N4');
    setSessionIntensity(userDb, 'relaxed');
    return userDb;
  }

  it('renders final copy at step 4 of 4', async () => {
    const userDb = await createUserDb();
    renderCompleteScreen(userDb);

    expect(screen.getByText("You're all set")).toBeTruthy();
    expect(
      screen.getByText(
        'Your level and study preferences are saved locally. No account needed.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Head to Home to explore the app. Your first review session ships in a later update.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
    expect(screen.getByTestId('complete-success-banner')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeTruthy();
  });

  it('persists onboarding completion and navigates to main tabs on Go to Home', async () => {
    const userDb = await createUserDb();
    renderCompleteScreen(userDb);

    expect(isOnboardingCompleted(userDb)).toBe(false);

    fireEvent.press(screen.getByRole('button', { name: 'Go to Home' }));

    expect(isOnboardingCompleted(userDb)).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
