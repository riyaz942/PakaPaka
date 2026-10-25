import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { getStudyStatus } from '@/data/user/itemStudyStatusRepository';
import {
  getLessonItemsStartedOn,
  startLessonItems,
} from '@/data/user/lessonProgressRepository';
import { getSrsState } from '@/data/user/srsStateRepository';

describe('lessonProgressRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, migrations);
    expect(result.ok).toBe(true);
    return db;
  }

  it('marks items in_progress, seeds SRS state, and logs the daily count together', async () => {
    const db = await createUserDb();

    const result = startLessonItems(db, ['1', '2', '3']);
    expect(result.ok).toBe(true);

    expect(getStudyStatus(db, '1')).toBe('in_progress');
    expect(getStudyStatus(db, '3')).toBe('in_progress');
    expect(getSrsState(db, '1')).not.toBeNull();
    expect(getLessonItemsStartedOn(db, todayKey())).toBe(3);
  });

  it('marks a read-once item known with no SRS state, but still counts it as started today', async () => {
    const db = await createUserDb();

    const result = startLessonItems(db, ['10', '11'], new Set(['10']));
    expect(result.ok).toBe(true);

    expect(getStudyStatus(db, '10')).toBe('known');
    expect(getSrsState(db, '10')).toBeNull();
    expect(getStudyStatus(db, '11')).toBe('in_progress');
    expect(getSrsState(db, '11')).not.toBeNull();
    expect(getLessonItemsStartedOn(db, todayKey())).toBe(2);
  });

  it('accumulates the daily log across multiple lesson batches', async () => {
    const db = await createUserDb();

    expect(startLessonItems(db, ['1', '2']).ok).toBe(true);
    expect(startLessonItems(db, ['3', '4', '5']).ok).toBe(true);

    expect(getLessonItemsStartedOn(db, todayKey())).toBe(5);
  });

  it('returns zero for a date with no lessons', async () => {
    const db = await createUserDb();
    expect(getLessonItemsStartedOn(db, '1999-01-01')).toBe(0);
  });
});
