import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { isJlptLevel } from '@/data/curriculum/curriculum.types';
import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  clearOnboardingCompleted,
  getOnboardingPath,
  getSessionIntensity,
  getStartingJlptLevel,
  isOnboardingCompleted,
  PREFERENCE_KEYS,
  setOnboardingCompleted,
  setOnboardingPath,
  setSessionIntensity,
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

  it('round-trips onboarding_completed via set and clear', async () => {
    const db = await createUserDb();

    expect(isOnboardingCompleted(db)).toBe(false);

    setOnboardingCompleted(db);
    expect(isOnboardingCompleted(db)).toBe(true);
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.onboardingCompleted,
      )?.value,
    ).toBe('true');

    clearOnboardingCompleted(db);
    expect(isOnboardingCompleted(db)).toBe(false);
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.onboardingCompleted,
      ),
    ).toBeNull();
  });

  it('round-trips session_intensity', async () => {
    const db = await createUserDb();

    expect(getSessionIntensity(db)).toBeNull();

    setSessionIntensity(db, 'intense');
    expect(getSessionIntensity(db)).toBe('intense');
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.sessionIntensity,
      )?.value,
    ).toBe('intense');
  });

  it('rejects invalid session intensity values', async () => {
    const db = await createUserDb();

    expect(() => setSessionIntensity(db, 'standard' as 'relaxed')).toThrow(
      'Invalid session intensity',
    );
  });

  it('treats corrupt session_intensity as unset', async () => {
    const db = await createUserDb();
    db.runSync(
      `INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
      PREFERENCE_KEYS.sessionIntensity,
      'invalid-value',
      new Date().toISOString(),
    );

    expect(getSessionIntensity(db)).toBeNull();
  });

  it('round-trips onboarding_path', async () => {
    const db = await createUserDb();

    expect(getOnboardingPath(db)).toBeNull();

    setOnboardingPath(db, 'import');
    expect(getOnboardingPath(db)).toBe('import');
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.onboardingPath,
      )?.value,
    ).toBe('import');

    setOnboardingPath(db, 'manual');
    expect(getOnboardingPath(db)).toBe('manual');
  });

  it('rejects invalid onboarding_path values', async () => {
    const db = await createUserDb();

    expect(() => setOnboardingPath(db, 'invalid' as 'import')).toThrow(
      'Invalid onboarding path',
    );
  });

  it('treats corrupt onboarding_path as unset', async () => {
    const db = await createUserDb();
    db.runSync(
      `INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
      PREFERENCE_KEYS.onboardingPath,
      'not-a-path',
      new Date().toISOString(),
    );

    expect(getOnboardingPath(db)).toBeNull();
  });
});
