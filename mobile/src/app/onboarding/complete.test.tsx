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
const mockPush = jest.fn();

let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: () => mockSearchParams,
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
    mockPush.mockClear();
    mockSearchParams = {};
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration001Initial]);
    expect(migrationResult.ok).toBe(true);
    setStartingJlptLevel(userDb, 'N4');
    setSessionIntensity(userDb, 'relaxed');
    return userDb;
  }

  it('renders the ready screen at step 4 of 4 with a first-lesson CTA', async () => {
    const userDb = await createUserDb();
    renderCompleteScreen(userDb);

    expect(screen.getByText("You're ready")).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start your first lesson' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explore on my own' })).toBeTruthy();
  });

  it('completes onboarding and launches the first lesson', async () => {
    const userDb = await createUserDb();
    renderCompleteScreen(userDb);

    expect(isOnboardingCompleted(userDb)).toBe(false);

    fireEvent.press(screen.getByRole('button', { name: 'Start your first lesson' }));

    expect(isOnboardingCompleted(userDb)).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    expect(mockPush).toHaveBeenCalledWith('/lesson');
  });

  it('completes onboarding and goes to tabs when exploring instead', async () => {
    const userDb = await createUserDb();
    renderCompleteScreen(userDb);

    fireEvent.press(screen.getByRole('button', { name: 'Explore on my own' }));

    expect(isOnboardingCompleted(userDb)).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  describe('after a backup restore (Story 9.2, AC8)', () => {
    it('does not offer a "first lesson" to a learner who already has history', async () => {
      mockSearchParams = { restored: '1' };
      const userDb = await createUserDb();
      renderCompleteScreen(userDb);

      expect(screen.queryByRole('button', { name: 'Start your first lesson' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Continue learning' })).toBeTruthy();
    });

    it('lands on the tab shell without forcing a lesson', async () => {
      mockSearchParams = { restored: '1' };
      const userDb = await createUserDb();
      renderCompleteScreen(userDb);

      fireEvent.press(screen.getByRole('button', { name: 'Continue learning' }));

      expect(isOnboardingCompleted(userDb)).toBe(true);
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('keeps the first-lesson CTA for the normal path', async () => {
      const userDb = await createUserDb();
      renderCompleteScreen(userDb);

      expect(screen.getByRole('button', { name: 'Start your first lesson' })).toBeTruthy();
    });
  });
});
