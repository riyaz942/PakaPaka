import { act, renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { useShadowMode } from '@/data/hooks/useShadowMode';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  setShadowModeEnabled,
  setShadowModeEnabledAt,
  setShadowModePromptDismissed,
  setShadowModePromptSnoozedUntil,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

// Mutable outer variable (name must start with "mock" for babel-plugin-jest-hoist to
// allow referencing it from the hoisted jest.mock factory below). The accessor is read
// lazily at render time — well after this variable is initialized — so each test can
// flip the build flag without a module reset (which would otherwise create a second,
// incompatible React module instance and break useContext).
let mockShadowModeFeatureEnabled = false;

jest.mock('@/config/constants', () => {
  const actual = jest.requireActual('@/config/constants');
  const mocked = { ...actual };
  // Defined via Object.defineProperty (rather than an object-literal getter mixed
  // with spread) so the live closure over mockShadowModeFeatureEnabled survives
  // Babel's object-spread transform intact.
  Object.defineProperty(mocked, 'SHADOW_MODE_FEATURE_ENABLED', {
    get() {
      return mockShadowModeFeatureEnabled;
    },
    enumerable: true,
    configurable: true,
  });
  return mocked;
});

const MS_PER_DAY = 86_400_000;

async function createUserDb(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('user.db');
  const result = runMigrations(db, [
    migration001Initial,
    migration003SrsStatesAndImportMetadata,
  ]);
  expect(result.ok).toBe(true);
  return db;
}

function insertImportRow(db: SQLiteDatabase): void {
  db.runSync(
    `INSERT INTO import_metadata (source, imported_at, mapped_count, unmatched_count) VALUES (?, ?, ?, ?)`,
    'wanikani',
    new Date().toISOString(),
    10,
    0,
  );
}

async function createWrapper(userDb: SQLiteDatabase) {
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

describe('useShadowMode — feature flag off (default, dormant path)', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockShadowModeFeatureEnabled = false;
  });

  it('returns all-off defaults even when preferences and import data would otherwise enable it', async () => {
    const db = await createUserDb();
    insertImportRow(db);
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 30 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    expect(result.current.isFeatureEnabled).toBe(false);
    expect(result.current.canEnable).toBe(false);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.enabledAt).toBeNull();
    expect(result.current.daysActive).toBe(0);
    expect(result.current.shouldShowSwitchPrompt).toBe(false);
  });
});

describe('useShadowMode — feature flag on', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockShadowModeFeatureEnabled = true;
  });

  it('canEnable is false when the learner has not imported progress', async () => {
    const db = await createUserDb();
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.isFeatureEnabled).toBe(true);
    });
    expect(result.current.canEnable).toBe(false);
  });

  it('canEnable is true once the learner has imported progress', async () => {
    const db = await createUserDb();
    insertImportRow(db);
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.canEnable).toBe(true);
    });
  });

  it('shouldShowSwitchPrompt is false at 13 days active', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 13 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });
    expect(result.current.daysActive).toBe(13);
    expect(result.current.shouldShowSwitchPrompt).toBe(false);
  });

  it('shouldShowSwitchPrompt is true at 14 days active', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 14 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.daysActive).toBe(14);
    });
    expect(result.current.shouldShowSwitchPrompt).toBe(true);
  });

  it('shouldShowSwitchPrompt is false once permanently dismissed', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 20 * MS_PER_DAY).toISOString());
    setShadowModePromptDismissed(db, true);
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.daysActive).toBe(20);
    });
    expect(result.current.shouldShowSwitchPrompt).toBe(false);
  });

  it('shouldShowSwitchPrompt is false while snoozed in the future', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 20 * MS_PER_DAY).toISOString());
    setShadowModePromptSnoozedUntil(db, new Date(Date.now() + 3 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.daysActive).toBe(20);
    });
    expect(result.current.shouldShowSwitchPrompt).toBe(false);
  });

  it('shouldShowSwitchPrompt is true once a snooze has expired', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 20 * MS_PER_DAY).toISOString());
    setShadowModePromptSnoozedUntil(db, new Date(Date.now() - 1 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.daysActive).toBe(20);
    });
    expect(result.current.shouldShowSwitchPrompt).toBe(true);
  });

  it('enable() persists shadow_mode_enabled and stamps enabled_at once', async () => {
    const db = await createUserDb();
    insertImportRow(db);
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.canEnable).toBe(true);
    });
    expect(result.current.isEnabled).toBe(false);

    act(() => {
      result.current.enable();
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });
    expect(result.current.enabledAt).not.toBeNull();
  });

  it('disable() (commit) turns shadow mode off without clearing enabled_at', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 20 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    act(() => {
      result.current.disable();
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
    });
    expect(result.current.enabledAt).not.toBeNull();
  });

  it('snoozePrompt() hides the prompt and dismissPrompt() hides it permanently', async () => {
    const db = await createUserDb();
    setShadowModeEnabled(db, true);
    setShadowModeEnabledAt(db, new Date(Date.now() - 20 * MS_PER_DAY).toISOString());
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useShadowMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.shouldShowSwitchPrompt).toBe(true);
    });

    act(() => {
      result.current.snoozePrompt();
    });

    await waitFor(() => {
      expect(result.current.shouldShowSwitchPrompt).toBe(false);
    });

    act(() => {
      result.current.dismissPrompt();
    });

    await waitFor(() => {
      expect(result.current.shouldShowSwitchPrompt).toBe(false);
    });
  });
});
