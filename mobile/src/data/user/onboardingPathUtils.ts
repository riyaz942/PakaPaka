import type { SQLiteDatabase } from 'expo-sqlite';

import { countImportMetadataRows } from '@/data/user/importRepository';
import { getOnboardingPath } from '@/data/user/preferencesRepository';

export function isImportOnboardingPath(userDb: SQLiteDatabase): boolean {
  const path = getOnboardingPath(userDb);
  if (path === 'import') {
    return true;
  }
  if (path === 'manual' || path === 'beginner') {
    return false;
  }
  return countImportMetadataRows(userDb) > 0;
}

/** User entered import from welcome but has not confirmed an import yet. */
export function isPendingImportBranch(userDb: SQLiteDatabase): boolean {
  return getOnboardingPath(userDb) === 'import' && countImportMetadataRows(userDb) === 0;
}
