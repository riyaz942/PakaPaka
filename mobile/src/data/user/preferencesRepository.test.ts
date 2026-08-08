import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { isJlptLevel } from '@/data/curriculum/curriculum.types';
import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  clearOnboardingCompleted,
  getAiModel,
  getAiOpenAiBaseUrl,
  getCloudSttOptIn,
  getFuriganaDisplay,
  getOnboardingPath,
  getSeenKanjiReadingPrimer,
  getSessionIntensity,
  getShadowModeEnabled,
  getShadowModeEnabledAt,
  getShadowModePromptDismissed,
  getShadowModePromptSnoozedUntil,
  getStartingJlptLevel,
  getReducedMotionEnabled,
  getReviewAutoAdvanceEnabled,
  getThemeMode,
  getVacationStartedAt,
  isOnboardingCompleted,
  PREFERENCE_KEYS,
  setPreference,
  setAiModel,
  setAiOpenAiBaseUrl,
  setCloudSttOptIn,
  setFuriganaDisplay,
  setOnboardingCompleted,
  setOnboardingPath,
  setReducedMotionEnabled,
  setReviewAutoAdvanceEnabled,
  setSeenKanjiReadingPrimer,
  setSessionIntensity,
  setShadowModeEnabled,
  setShadowModeEnabledAt,
  setShadowModePromptDismissed,
  setShadowModePromptSnoozedUntil,
  setStartingJlptLevel,
  setThemeMode,
  setVacationStartedAt,
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

    setSessionIntensity(db, 'steady');
    expect(getSessionIntensity(db)).toBe('steady');
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

describe('preferencesRepository reduced motion preference', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('returns null when unset so the app follows the system setting', async () => {
    const db = await createUserDb();
    expect(getReducedMotionEnabled(db)).toBeNull();
  });

  it('round-trips reduced_motion', async () => {
    const db = await createUserDb();

    setReducedMotionEnabled(db, true);
    expect(getReducedMotionEnabled(db)).toBe(true);
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.reducedMotion,
      )?.value,
    ).toBe('true');

    setReducedMotionEnabled(db, false);
    expect(getReducedMotionEnabled(db)).toBe(false);
  });
});

describe('preferencesRepository review auto-advance (Lightning Mode) preference', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults to OFF when unset (FR84)', async () => {
    const db = await createUserDb();
    expect(getReviewAutoAdvanceEnabled(db)).toBe(false);
  });

  it('round-trips review_auto_advance and persists ON', async () => {
    const db = await createUserDb();

    setReviewAutoAdvanceEnabled(db, true);
    expect(getReviewAutoAdvanceEnabled(db)).toBe(true);
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.reviewAutoAdvance,
      )?.value,
    ).toBe('true');

    setReviewAutoAdvanceEnabled(db, false);
    expect(getReviewAutoAdvanceEnabled(db)).toBe(false);
  });
});

describe('preferencesRepository vacation mode start timestamp', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults to null when unset', async () => {
    const db = await createUserDb();
    expect(getVacationStartedAt(db)).toBeNull();
  });

  it('round-trips the ISO start timestamp', async () => {
    const db = await createUserDb();

    setVacationStartedAt(db, '2026-07-01T09:00:00.000Z');

    expect(getVacationStartedAt(db)).toBe('2026-07-01T09:00:00.000Z');
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.vacationStartedAt,
      )?.value,
    ).toBe('2026-07-01T09:00:00.000Z');
  });

  it('removes the row when set to null, so "off" reads back as null', async () => {
    const db = await createUserDb();

    setVacationStartedAt(db, '2026-07-01T09:00:00.000Z');
    setVacationStartedAt(db, null);

    expect(getVacationStartedAt(db)).toBeNull();
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.vacationStartedAt,
      ),
    ).toBeFalsy();
  });
});

describe('preferencesRepository furigana display preference', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults to "auto" when unset', async () => {
    const db = await createUserDb();
    expect(getFuriganaDisplay(db)).toBe('auto');
  });

  it('round-trips each mode', async () => {
    const db = await createUserDb();

    setFuriganaDisplay(db, 'shown');
    expect(getFuriganaDisplay(db)).toBe('shown');
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.furiganaDisplay,
      )?.value,
    ).toBe('shown');

    setFuriganaDisplay(db, 'hidden');
    expect(getFuriganaDisplay(db)).toBe('hidden');

    setFuriganaDisplay(db, 'auto');
    expect(getFuriganaDisplay(db)).toBe('auto');
  });
});

describe('preferencesRepository theme mode preference', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults to "system" when unset', async () => {
    const db = await createUserDb();
    expect(getThemeMode(db)).toBe('system');
  });

  it('round-trips each mode', async () => {
    const db = await createUserDb();

    setThemeMode(db, 'dark');
    expect(getThemeMode(db)).toBe('dark');
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.themeMode,
      )?.value,
    ).toBe('dark');

    setThemeMode(db, 'light');
    expect(getThemeMode(db)).toBe('light');

    setThemeMode(db, 'system');
    expect(getThemeMode(db)).toBe('system');
  });

  it('rejects an unknown mode', async () => {
    const db = await createUserDb();
    expect(() => setThemeMode(db, 'sepia' as never)).toThrow(/Invalid theme mode/);
  });

  it('falls back to "system" when the stored value is not a known mode', async () => {
    const db = await createUserDb();
    setPreference(db, PREFERENCE_KEYS.themeMode, 'sepia');
    expect(getThemeMode(db)).toBe('system');
  });
});

describe('preferencesRepository shadow mode preferences', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults shadow_mode_enabled to false when unset', async () => {
    const db = await createUserDb();
    expect(getShadowModeEnabled(db)).toBe(false);
    expect(getShadowModeEnabledAt(db)).toBeNull();
    expect(getShadowModePromptDismissed(db)).toBe(false);
    expect(getShadowModePromptSnoozedUntil(db)).toBeNull();
  });

  it('round-trips shadow_mode_enabled', async () => {
    const db = await createUserDb();

    setShadowModeEnabled(db, true);
    expect(getShadowModeEnabled(db)).toBe(true);
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.shadowModeEnabled,
      )?.value,
    ).toBe('true');

    setShadowModeEnabled(db, false);
    expect(getShadowModeEnabled(db)).toBe(false);
  });

  it('stamps shadow_mode_enabled_at only on the first enable', async () => {
    const db = await createUserDb();

    expect(getShadowModeEnabledAt(db)).toBeNull();

    setShadowModeEnabled(db, true);
    const firstStamp = getShadowModeEnabledAt(db);
    expect(firstStamp).not.toBeNull();

    setShadowModeEnabled(db, false);
    expect(getShadowModeEnabledAt(db)).toBe(firstStamp);

    setShadowModeEnabled(db, true);
    expect(getShadowModeEnabledAt(db)).toBe(firstStamp);
  });

  it('round-trips shadow_mode_enabled_at directly', async () => {
    const db = await createUserDb();
    const iso = '2026-06-01T00:00:00.000Z';

    setShadowModeEnabledAt(db, iso);
    expect(getShadowModeEnabledAt(db)).toBe(iso);
  });

  it('round-trips shadow_mode_prompt_dismissed', async () => {
    const db = await createUserDb();

    expect(getShadowModePromptDismissed(db)).toBe(false);

    setShadowModePromptDismissed(db, true);
    expect(getShadowModePromptDismissed(db)).toBe(true);

    setShadowModePromptDismissed(db, false);
    expect(getShadowModePromptDismissed(db)).toBe(false);
  });

  it('round-trips shadow_mode_prompt_snoozed_until', async () => {
    const db = await createUserDb();
    const iso = '2026-06-15T00:00:00.000Z';

    expect(getShadowModePromptSnoozedUntil(db)).toBeNull();

    setShadowModePromptSnoozedUntil(db, iso);
    expect(getShadowModePromptSnoozedUntil(db)).toBe(iso);
  });
});

describe('preferencesRepository kanji reading primer flag', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults seen_kanji_reading_primer to false when unset', async () => {
    const db = await createUserDb();
    expect(getSeenKanjiReadingPrimer(db)).toBe(false);
  });

  it('marks the primer seen and stays seen', async () => {
    const db = await createUserDb();

    setSeenKanjiReadingPrimer(db);
    expect(getSeenKanjiReadingPrimer(db)).toBe(true);

    // Re-marking is idempotent — the primer never comes back unprompted.
    setSeenKanjiReadingPrimer(db);
    expect(getSeenKanjiReadingPrimer(db)).toBe(true);
  });

  it('exposes the preference key so callers do not hardcode the string', async () => {
    expect(PREFERENCE_KEYS.seenKanjiReadingPrimer).toBe('seen_kanji_reading_primer');
  });
});

describe('preferencesRepository cloud STT opt-in', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('defaults to OFF so speech stays on-device unless asked otherwise (FR99)', async () => {
    const db = await createUserDb();
    expect(getCloudSttOptIn(db)).toBe(false);
  });

  it('round-trips cloud_stt_opt_in', async () => {
    const db = await createUserDb();

    setCloudSttOptIn(db, true);
    expect(getCloudSttOptIn(db)).toBe(true);
    expect(
      db.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.cloudSttOptIn,
      )?.value,
    ).toBe('true');

    setCloudSttOptIn(db, false);
    expect(getCloudSttOptIn(db)).toBe(false);
  });
});

describe('preferencesRepository AI model and base URL guards', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('clears the model row when set to blank so the adapter default applies', async () => {
    const db = await createUserDb();

    setAiModel(db, 'openai', 'gpt-4o-mini');
    expect(getAiModel(db, 'openai')).toBe('gpt-4o-mini');

    setAiModel(db, 'openai', '   ');
    // Null, not '', so resolveAiConfig falls through to DEFAULT_MODELS.
    expect(getAiModel(db, 'openai')).toBeNull();
  });

  it('keeps provider model overrides separate', async () => {
    const db = await createUserDb();

    setAiModel(db, 'openai', 'gpt-4o-mini');
    setAiModel(db, 'anthropic', 'claude-opus-4-8');

    expect(getAiModel(db, 'openai')).toBe('gpt-4o-mini');
    expect(getAiModel(db, 'anthropic')).toBe('claude-opus-4-8');
  });

  it('stores https and loopback base URLs', async () => {
    const db = await createUserDb();

    setAiOpenAiBaseUrl(db, 'https://api.example.com/v1');
    expect(getAiOpenAiBaseUrl(db)).toBe('https://api.example.com/v1');

    setAiOpenAiBaseUrl(db, 'http://localhost:1234/v1');
    expect(getAiOpenAiBaseUrl(db)).toBe('http://localhost:1234/v1');
  });

  it('refuses a plaintext remote base URL and leaves the stored one intact (NFR24)', async () => {
    const db = await createUserDb();

    setAiOpenAiBaseUrl(db, 'https://api.example.com/v1');
    setAiOpenAiBaseUrl(db, 'http://api.example.com/v1');

    expect(getAiOpenAiBaseUrl(db)).toBe('https://api.example.com/v1');
  });

  it('clears the base URL when set to blank', async () => {
    const db = await createUserDb();

    setAiOpenAiBaseUrl(db, 'https://api.example.com/v1');
    setAiOpenAiBaseUrl(db, '  ');

    expect(getAiOpenAiBaseUrl(db)).toBeNull();
  });
});
