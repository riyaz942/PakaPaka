import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  PREFERENCE_KEYS,
  setOnboardingPath,
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

let mockIsWeb = false;
jest.mock('@/platform/capabilities', () => ({
  ...jest.requireActual('@/platform/capabilities'),
  isWeb: () => mockIsWeb,
}));

describe('useOnboardingRedirect', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockIsWeb = false;
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

  it('redirects to start on native when starting level is absent', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/start');
    });
  });

  it('redirects to welcome on web when starting level is absent', async () => {
    mockIsWeb = true;
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

  it('redirects the manual path to placement when level and intensity are set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    setSessionIntensity(db, 'relaxed');
    setOnboardingPath(db, 'manual');

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/placement');
    });
  });

  it('redirects the beginner path to complete when level and intensity are set', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N5');
    setSessionIntensity(db, 'relaxed');
    setOnboardingPath(db, 'beginner');

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/complete');
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

  it('does not redirect away from placement on the manual path', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N4');
    setSessionIntensity(db, 'intense');
    setOnboardingPath(db, 'manual');
    mockSegments = ['onboarding', 'placement'];

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

  it('does not redirect away from import-summary when starting level is absent', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    mockSegments = ['onboarding', 'import-summary'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away from import-summary when intensity is missing', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N3');
    mockSegments = ['onboarding', 'import-summary'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away from import when level is set but intensity is missing', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N3');
    setOnboardingPath(db, 'import');
    mockSegments = ['onboarding', 'import'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect away from welcome when import branch is pending', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N3');
    setOnboardingPath(db, 'import');
    mockSegments = ['onboarding', 'welcome'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('redirects import path users to complete instead of calibrate', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setStartingJlptLevel(db, 'N3');
    setSessionIntensity(db, 'relaxed');
    setOnboardingPath(db, 'import');
    mockSegments = ['(tabs)'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/complete');
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
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
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
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('checks again after a sync writes onboarding completed, on the same screen', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    mockSegments = ['onboarding', 'welcome'];

    const wrapper = await createWrapper(db);
    const { rerender } = renderHook(
      ({ appliedVersion }: { appliedVersion: number }) => useOnboardingRedirect(appliedVersion),
      { wrapper, initialProps: { appliedVersion: 0 } },
    );
    expect(mockReplace).not.toHaveBeenCalled();

    // The sync applies the account's progress; the screen does not change.
    setPreference(db, PREFERENCE_KEYS.onboardingCompleted, 'true');
    rerender({ appliedVersion: 1 });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('holds every redirect while hold is true', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(0, true), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('opens the dashboard when the hold ends and onboarding is completed', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    mockSegments = ['(tabs)', 'settings'];

    const wrapper = await createWrapper(db);
    const { rerender } = renderHook(
      ({ hold }: { hold: boolean }) => useOnboardingRedirect(0, hold),
      { wrapper, initialProps: { hold: true } },
    );
    expect(mockReplace).not.toHaveBeenCalled();

    // The first sync applied the account's progress while the hold was on.
    setPreference(db, PREFERENCE_KEYS.onboardingCompleted, 'true');
    rerender({ hold: false });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('stays on start while onboarding is not completed', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    mockSegments = ['start'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('opens the dashboard from start when onboarding is completed', async () => {
    const db = await openDatabaseAsync('user.db');
    runMigrations(db, [migration001Initial]);
    setPreference(db, PREFERENCE_KEYS.onboardingCompleted, 'true');
    mockSegments = ['start'];

    const wrapper = await createWrapper(db);
    renderHook(() => useOnboardingRedirect(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
