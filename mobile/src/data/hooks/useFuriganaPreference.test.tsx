import { act, renderHook } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getFuriganaOverride,
  setFuriganaOverride,
} from '@/data/user/furiganaOverrideRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

// The known-character set is a cross-DB (`curriculum.items`) query the shared
// expo-sqlite mock can't run; it has its own unit tests in masteryRepository.test.ts.
jest.mock('@/data/user/masteryRepository', () => ({
  getKnownVocabularyCharacters: jest.fn(() => new Set(['学'])),
  isVocabularyItemKnown: jest.fn(() => false),
}));

function createWrapper(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue: DatabaseContextValue = {
    curriculumDb: userDb,
    userDb,
    isReady: true,
    error: null,
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
  };
}

async function setup() {
  const userDb = await openDatabaseAsync('user.db');
  runMigrations(userDb, migrations);
  return { userDb, wrapper: createWrapper(userDb) };
}

describe('useFuriganaPreference', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('defaults to the global mode when a word has no override', async () => {
    const { wrapper } = await setup();
    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    expect(result.current.mode).toBe('auto');
    expect(result.current.modeForItem('vocab-1')).toBe('auto');
  });

  it('sources known characters from mastered vocabulary', async () => {
    const { wrapper } = await setup();
    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    expect(result.current.knownKanji).toEqual(new Set(['学']));
  });

  it('lets a stored override win over the global mode', async () => {
    const { userDb, wrapper } = await setup();
    setFuriganaOverride(userDb, 'vocab-1', 'shown');

    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    act(() => {
      result.current.setMode('hidden');
    });

    expect(result.current.modeForItem('vocab-1')).toBe('shown');
    expect(result.current.modeForItem('vocab-2')).toBe('hidden');
  });

  it('persists an override and reflects it without a remount', async () => {
    const { userDb, wrapper } = await setup();
    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    act(() => {
      result.current.setOverride('vocab-1', 'hidden');
    });

    expect(getFuriganaOverride(userDb, 'vocab-1')).toBe('hidden');
    expect(result.current.modeForItem('vocab-1')).toBe('hidden');
  });

  it('clears one override back to the global mode', async () => {
    const { userDb, wrapper } = await setup();
    setFuriganaOverride(userDb, 'vocab-1', 'shown');
    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    act(() => {
      result.current.clearOverride('vocab-1');
    });

    expect(getFuriganaOverride(userDb, 'vocab-1')).toBeNull();
    expect(result.current.modeForItem('vocab-1')).toBe('auto');
  });

  it('resets every override at once', async () => {
    const { userDb, wrapper } = await setup();
    setFuriganaOverride(userDb, 'vocab-1', 'shown');
    setFuriganaOverride(userDb, 'vocab-2', 'hidden');
    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    act(() => {
      result.current.clearAllOverrides();
    });

    expect(result.current.overrides.size).toBe(0);
    expect(getFuriganaOverride(userDb, 'vocab-1')).toBeNull();
    expect(getFuriganaOverride(userDb, 'vocab-2')).toBeNull();
  });

  it('treats a missing item id as the global mode', async () => {
    const { wrapper } = await setup();
    const { result } = renderHook(() => useFuriganaPreference(), { wrapper });

    expect(result.current.modeForItem(undefined)).toBe('auto');
  });
});
