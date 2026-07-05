import { fireEvent, render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getOnboardingPath,
  getStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import WelcomeScreen from './welcome';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

function renderWelcomeScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
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
        <WelcomeScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('WelcomeScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('navigates to import when the existing knowledge card is pressed', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-import'));

    expect(mockPush).toHaveBeenCalledWith('/onboarding/import');
    expect(getOnboardingPath(db)).toBe('import');
  });

  it('shows the existing knowledge framing on the import card', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    expect(screen.getByText('I have existing knowledge')).toBeTruthy();
  });

  it('persists N5 and routes beginner path to intensity', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-beginner'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getStartingJlptLevel(db)).toBe('N5');
    expect(getOnboardingPath(db)).toBe('beginner');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/intensity');
  });

  it('persists selected JLPT level and routes intermediate path to intensity', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-intermediate'));
    fireEvent.press(screen.getByTestId('jlpt-level-N3'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getStartingJlptLevel(db)).toBe('N3');
    expect(getOnboardingPath(db)).toBe('manual');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/intensity');
  });
});
