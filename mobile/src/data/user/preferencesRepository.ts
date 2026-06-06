import type { SQLiteDatabase } from 'expo-sqlite';

import type { CurriculumUpdateSource } from '@/data/curriculum/curriculumManifest.types';
import { isJlptLevel, type JLPTLevel } from '@/data/curriculum/curriculum.types';

export const PREFERENCE_KEYS = {
  installedCurriculumVersion: 'installed_curriculum_version',
  installedCurriculumContentHash: 'installed_curriculum_content_hash',
  curriculumUpdateSource: 'curriculum_update_source',
  startingJlptLevel: 'starting_jlpt_level',
  onboardingCompleted: 'onboarding_completed',
} as const;

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

export function isOnboardingCompleted(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.onboardingCompleted) === 'true';
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
