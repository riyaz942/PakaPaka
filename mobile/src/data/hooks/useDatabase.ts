import { useDatabaseContext } from '@/providers/DatabaseContext';

export function useDatabase() {
  const { curriculumDb, userDb, isReady, error } = useDatabaseContext();

  if (!isReady) {
    throw new Error('useDatabase called before databases are ready');
  }

  if (error) {
    throw new Error(error.message);
  }

  return { curriculumDb, userDb };
}
