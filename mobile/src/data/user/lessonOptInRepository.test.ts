import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration020LessonOptIns } from '@/data/migrations/020_lesson_opt_ins';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  addLessonOptIn,
  isLessonOptIn,
  listLessonOptInIds,
  removeLessonOptIn,
} from '@/data/user/lessonOptInRepository';

async function createUserDb() {
  const db = await openDatabaseAsync('user.db');
  const result = runMigrations(db, [migration001Initial, migration020LessonOptIns]);
  expect(result.ok).toBe(true);
  return db;
}

describe('lessonOptInRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('reports no opt-ins on a fresh database', async () => {
    const db = await createUserDb();
    expect(listLessonOptInIds(db)).toEqual([]);
    expect(isLessonOptIn(db, '2552')).toBe(false);
  });

  it('records an opt-in and reads it back', async () => {
    const db = await createUserDb();
    addLessonOptIn(db, '2552');

    expect(isLessonOptIn(db, '2552')).toBe(true);
    expect(listLessonOptInIds(db)).toEqual(['2552']);
  });

  it('keeps the original opted_in_at when the same item is opted into twice', async () => {
    const db = await createUserDb();
    // Real clocks make this vacuous: two calls in the same millisecond produce
    // the same timestamp whether or not the second write updated the row.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T09:00:00.000Z'));
    addLessonOptIn(db, '2552');

    jest.setSystemTime(new Date('2026-09-06T09:00:00.000Z'));
    addLessonOptIn(db, '2552');

    expect(listLessonOptInIds(db)).toEqual(['2552']);
    expect(
      db.getFirstSync<{ opted_in_at: string }>(
        'SELECT opted_in_at FROM lesson_opt_ins WHERE item_id = ?',
        '2552',
      )?.opted_in_at,
    ).toBe('2026-09-05T09:00:00.000Z');
    jest.useRealTimers();
  });

  it('removes one opt-in and leaves the others', async () => {
    const db = await createUserDb();
    addLessonOptIn(db, '2552');
    addLessonOptIn(db, '1091');

    removeLessonOptIn(db, '2552');

    expect(isLessonOptIn(db, '2552')).toBe(false);
    expect(listLessonOptInIds(db)).toEqual(['1091']);
  });
});
