import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { isJlptLevel } from '@/data/curriculum/curriculum.types';
import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getStartingJlptLevel,
  isOnboardingCompleted,
  PREFERENCE_KEYS,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';

describe('preferencesRepository JLPT onboarding preferences', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('round-trips starting_jlpt_level', async () => {
    const db = await createUserDb();

    expect(getStartingJlptLevel(db)).toBeNull();

    setStartingJlptLevel(db, 'N3');
    expect(getStartingJlptLevel(db)).toBe('N3');
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.startingJlptLevel,
      )?.value,
    ).toBe('N3');
  });

  it('rejects invalid JLPT levels via isJlptLevel and setStartingJlptLevel', async () => {
    const db = await createUserDb();

    expect(isJlptLevel('N5')).toBe(true);
    expect(isJlptLevel('n5')).toBe(false);
    expect(isJlptLevel('N0')).toBe(false);
    expect(isJlptLevel('')).toBe(false);

    expect(() => setStartingJlptLevel(db, 'N6' as 'N5')).toThrow('Invalid JLPT level');
  });

  it('reads onboarding_completed as false when unset', async () => {
    const db = await createUserDb();
    expect(isOnboardingCompleted(db)).toBe(false);
  });
});
