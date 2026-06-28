import type { SQLiteDatabase } from 'expo-sqlite';

import type { CurriculumUpdateSource } from '@/data/curriculum/curriculumManifest.types';
import { isJlptLevel, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  isSessionIntensity,
  type SessionIntensity,
} from '@/data/user/sessionIntensity.types';

export type OnboardingPath = 'beginner' | 'manual' | 'import';

export const PREFERENCE_KEYS = {
  installedCurriculumVersion: 'installed_curriculum_version',
  installedCurriculumContentHash: 'installed_curriculum_content_hash',
  curriculumUpdateSource: 'curriculum_update_source',
  startingJlptLevel: 'starting_jlpt_level',
  sessionIntensity: 'session_intensity',
  onboardingCompleted: 'onboarding_completed',
  onboardingPath: 'onboarding_path',
  weaknessBiasEnabled: 'weakness_bias_enabled',
} as const;

const ONBOARDING_PATHS: readonly OnboardingPath[] = ['beginner', 'manual', 'import'];

function isOnboardingPath(value: string): value is OnboardingPath {
  return (ONBOARDING_PATHS as readonly string[]).includes(value);
}

export function getPreference(
  userDb: SQLiteDatabase,
  key: string,
): string | null {
  const row = userDb.getFirstSync<{ value: string }>(
    'SELECT value FROM user_preferences WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export function setPreference(
  userDb: SQLiteDatabase,
  key: string,
  value: string,
): void {
  const updatedAt = new Date().toISOString();
  userDb.runSync(
    `INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    updatedAt,
  );
}

export function getCurriculumUpdateSource(
  userDb: SQLiteDatabase,
): CurriculumUpdateSource | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.curriculumUpdateSource);
  if (value === 'bundled' || value === 'downloaded') {
    return value;
  }
  return null;
}

export function getStartingJlptLevel(userDb: SQLiteDatabase): JLPTLevel | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.startingJlptLevel);
  if (value && isJlptLevel(value)) {
    return value;
  }
  return null;
}

export function setStartingJlptLevel(userDb: SQLiteDatabase, level: JLPTLevel): void {
  if (!isJlptLevel(level)) {
    throw new Error(`Invalid JLPT level: ${level}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.startingJlptLevel, level);
}

export function getSessionIntensity(userDb: SQLiteDatabase): SessionIntensity | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.sessionIntensity);
  if (value && isSessionIntensity(value)) {
    return value;
  }
  return null;
}

export function setSessionIntensity(
  userDb: SQLiteDatabase,
  intensity: SessionIntensity,
): void {
  if (!isSessionIntensity(intensity)) {
    throw new Error(`Invalid session intensity: ${intensity}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.sessionIntensity, intensity);
}

export function isOnboardingCompleted(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.onboardingCompleted) === 'true';
}

export function setOnboardingCompleted(userDb: SQLiteDatabase): void {
  setPreference(userDb, PREFERENCE_KEYS.onboardingCompleted, 'true');
}

export function getOnboardingPath(userDb: SQLiteDatabase): OnboardingPath | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.onboardingPath);
  if (value && isOnboardingPath(value)) {
    return value;
  }
  return null;
}

export function setOnboardingPath(userDb: SQLiteDatabase, path: OnboardingPath): void {
  if (!isOnboardingPath(path)) {
    throw new Error(`Invalid onboarding path: ${path}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.onboardingPath, path);
}

export function clearOnboardingCompleted(userDb: SQLiteDatabase): void {
  userDb.runSync('DELETE FROM user_preferences WHERE key = ?', PREFERENCE_KEYS.onboardingCompleted);
}

/**
 * Returns true when weakness bias is enabled (default when unset).
 * Stored as 'true'/'false' string to match existing preference storage pattern.
 */
export function getWeaknessBiasEnabled(userDb: SQLiteDatabase): boolean {
  const value = getPreference(userDb, PREFERENCE_KEYS.weaknessBiasEnabled);
  // Default is enabled (true) when the key is not set.
  return value === null ? true : value === 'true';
}

export function setWeaknessBiasEnabled(userDb: SQLiteDatabase, enabled: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.weaknessBiasEnabled, enabled ? 'true' : 'false');
}

export function setCurriculumInstallMetadata(
  userDb: SQLiteDatabase,
  options: {
    version: string;
    source: CurriculumUpdateSource;
    contentHash?: string | null;
  },
): void {
  setPreference(userDb, PREFERENCE_KEYS.installedCurriculumVersion, options.version);
  setPreference(userDb, PREFERENCE_KEYS.curriculumUpdateSource, options.source);
  if (options.contentHash) {
    setPreference(userDb, PREFERENCE_KEYS.installedCurriculumContentHash, options.contentHash);
  }
}
