import { renderHook } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React, { type ReactNode } from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import {
  __resetKanjiReadingPrimerSessionForTests,
  useKanjiReadingPrimer,
} from '@/data/hooks/useKanjiReadingPrimer';
import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getSeenKanjiReadingPrimer,
  setOnboardingPath,
  setSeenKanjiReadingPrimer,
  type OnboardingPath,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

async function createUserDb() {
  const userDb = await openDatabaseAsync('user.db');
  const result = runMigrations(userDb, [migration001Initial]);
  expect(result.ok).toBe(true);
  return userDb;
}

function wrapperFor(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue = {
    curriculumDb: userDb,
    userDb,
    isReady: true,
    error: null,
  } as unknown as DatabaseContextValue;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    );
  };
}

function renderPrimer(
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  input: { itemId: string | null; isDualReadingKanji: boolean },
) {
  return renderHook(() => useKanjiReadingPrimer(input), { wrapper: wrapperFor(userDb) });
}

describe('useKanjiReadingPrimer gating', () => {
  beforeEach(() => {
    __mockResetSqlite();
    __resetKanjiReadingPrimerSessionForTests();
  });

  it('shows unprompted for a beginner on their first dual-reading kanji', async () => {
    const userDb = await createUserDb();
    setOnboardingPath(userDb, 'beginner');

    const { result } = renderPrimer(userDb, { itemId: '2', isDualReadingKanji: true });

    expect(result.current).toBe(true);
    // Marked seen the moment it is shown, so quitting mid-lesson still counts.
    expect(getSeenKanjiReadingPrimer(userDb)).toBe(true);
  });

  it.each<OnboardingPath>(['manual', 'import'])(
    'never shows unprompted on the %s path',
    async (path) => {
      const userDb = await createUserDb();
      setOnboardingPath(userDb, path);

      const { result } = renderPrimer(userDb, { itemId: '2', isDualReadingKanji: true });

      expect(result.current).toBe(false);
      expect(getSeenKanjiReadingPrimer(userDb)).toBe(false);
    },
  );

  it('does not repeat once seen', async () => {
    const userDb = await createUserDb();
    setOnboardingPath(userDb, 'beginner');
    setSeenKanjiReadingPrimer(userDb);

    const { result } = renderPrimer(userDb, { itemId: '2', isDualReadingKanji: true });

    expect(result.current).toBe(false);
  });

  it('does not show on a kanji with only one reading type', async () => {
    const userDb = await createUserDb();
    setOnboardingPath(userDb, 'beginner');

    const { result } = renderPrimer(userDb, { itemId: '2', isDualReadingKanji: false });

    expect(result.current).toBe(false);
    expect(getSeenKanjiReadingPrimer(userDb)).toBe(false);
  });

  it('does not show before an item has resolved', async () => {
    const userDb = await createUserDb();
    setOnboardingPath(userDb, 'beginner');

    const { result } = renderPrimer(userDb, { itemId: null, isDualReadingKanji: true });

    expect(result.current).toBe(false);
    expect(getSeenKanjiReadingPrimer(userDb)).toBe(false);
  });

  it('stays visible for the rest of the item after the flag is written', async () => {
    const userDb = await createUserDb();
    setOnboardingPath(userDb, 'beginner');

    const { result, rerender } = renderPrimer(userDb, {
      itemId: '2',
      isDualReadingKanji: true,
    });
    expect(result.current).toBe(true);

    rerender({});

    expect(result.current).toBe(true);
  });

  it('stays visible across remount after the flag is written (section pager)', async () => {
    const userDb = await createUserDb();
    setOnboardingPath(userDb, 'beginner');

    const first = renderPrimer(userDb, { itemId: '2', isDualReadingKanji: true });
    expect(first.result.current).toBe(true);
    expect(getSeenKanjiReadingPrimer(userDb)).toBe(true);
    first.unmount();

    const second = renderPrimer(userDb, { itemId: '2', isDualReadingKanji: true });
    expect(second.result.current).toBe(true);
  });
});
