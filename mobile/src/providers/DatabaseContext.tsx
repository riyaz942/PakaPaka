import { createContext, useContext } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError } from '@/types/result.types';

export type DatabaseContextValue = {
  curriculumDb: SQLiteDatabase;
  userDb: SQLiteDatabase;
  isReady: boolean;
  error: AppError | null;
};

export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function useDatabaseContext(): DatabaseContextValue {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabaseContext must be used within a DatabaseProvider');
  }

  return context;
}
