import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  PREFERENCE_KEYS,
  setPreference,
  setSessionIntensity,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { useOnboardingRedirect } from '@/hooks/useOnboardingRedirect';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

const mockReplace = jest.fn();
let mockSegments: string[] = ['(tabs)'];
let mockNavigationKey: string | undefined = 'root-key';

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useSegments: () => mockSegments,
  useRootNavigationState: () => (mockNavigationKey ? { key: mockNavigationKey } : undefined),
}));

describe('useOnboardingRedirect', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockSegments = ['(tabs)'];
    mockNavigationKey = 'root-key';
  });

  async function createWrapper(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
    const contextValue: DatabaseContextValue = {
      curriculumDb: userDb,
      userDb,
      isReady: true,
      error: null,
    };

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
      );
    };
  }

  it('redirects to welcome when starting level is absent', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
    });
  });

  it('redirects to intensity when starting level is set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/intensity');
    });
  });

  it('redirects to calibrate when level and intensity are set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    setSessionIntensity(db, 'relaxed');

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/calibrate');
    });
  });

  it('does not redirect away from intensity when intensity is missing', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    mockSegments = ['onboarding', 'intensity'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away from calibrate when level and intensity are set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    setSessionIntensity(db, 'intense');
    mockSegments = ['onboarding', 'calibrate'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away from bulk when level and intensity are set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    setSessionIntensity(db, 'relaxed');
    mockSegments = ['onboarding', 'bulk'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away from complete when level and intensity are set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    setSessionIntensity(db, 'relaxed');
    mockSegments = ['onboarding', 'complete'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away when already inside onboarding without a level', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    mockSegments = ['onboarding', 'import'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect when onboarding is completed and user is on tabs', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N3');
    setPreference(db, PREFERENCE_KEYS.onboardingCompleted, 'true');
    mockSegments = ['(tabs)'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('redirects to tabs when onboarding is completed on complete screen', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setPreference(db, PREFERENCE_KEYS.onboardingCompleted, 'true');
    mockSegments = ['onboarding', 'complete'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('redirects to tabs when onboarding is completed on welcome screen', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setPreference(db, PREFERENCE_KEYS.onboardingCompleted, 'true');
    mockSegments = ['onboarding', 'welcome'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });
});
