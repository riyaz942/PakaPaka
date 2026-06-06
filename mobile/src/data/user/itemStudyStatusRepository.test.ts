import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  bulkSetStudyStatusKnown,
  clearStudyStatus,
  getStudyStatus,
  getStudyStatusOrDefault,
  listStudyStatusesForItems,
  setStudyStatus,
} from '@/data/user/itemStudyStatusRepository';

describe('itemStudyStatusRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial, migration002ItemStudyStatus]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('round-trips known and in_progress statuses', async () => {
    const db = await createUserDb();

    expect(getStudyStatusOrDefault(db, '42')).toBe('not_started');

    setStudyStatus(db, '42', 'known');
    expect(getStudyStatus(db, '42')).toBe('known');

    setStudyStatus(db, '42', 'in_progress');
    expect(getStudyStatus(db, '42')).toBe('in_progress');
  });

  it('deletes the row when status is not_started', async () => {
    const db = await createUserDb();

    setStudyStatus(db, '7', 'known');
    expect(getStudyStatus(db, '7')).toBe('known');

    setStudyStatus(db, '7', 'not_started');
    expect(getStudyStatus(db, '7')).toBeNull();
    expect(getStudyStatusOrDefault(db, '7')).toBe('not_started');
  });

  it('clearStudyStatus removes persisted rows', async () => {
    const db = await createUserDb();

    setStudyStatus(db, '3', 'in_progress');
    clearStudyStatus(db, '3');

    expect(getStudyStatus(db, '3')).toBeNull();
  });

  it('lists statuses for multiple items in one query', async () => {
    const db = await createUserDb();

    setStudyStatus(db, '1', 'known');
    setStudyStatus(db, '2', 'in_progress');

    const statuses = listStudyStatusesForItems(db, ['1', '2', '3']);

    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('in_progress');
    expect(statuses.has('3')).toBe(false);
  });

  it('rejects invalid status values', async () => {
    const db = await createUserDb();

    expect(() => setStudyStatus(db, '1', 'mastered' as 'known')).toThrow(
      'Invalid study status',
    );
  });

  it('bulkSetStudyStatusKnown returns updatedCount 0 for empty itemIds', async () => {
    const db = await createUserDb();

    expect(bulkSetStudyStatusKnown(db, [])).toEqual({ updatedCount: 0 });
  });

  it('bulkSetStudyStatusKnown writes known status in a transaction', async () => {
    const db = await createUserDb();

    const result = bulkSetStudyStatusKnown(db, ['1', '2', '3']);

    expect(result).toEqual({ updatedCount: 3 });
    expect(getStudyStatus(db, '1')).toBe('known');
    expect(getStudyStatus(db, '2')).toBe('known');
    expect(getStudyStatus(db, '3')).toBe('known');
  });

  it('bulkSetStudyStatusKnown overwrites in_progress to known', async () => {
    const db = await createUserDb();

    setStudyStatus(db, '5', 'in_progress');
    bulkSetStudyStatusKnown(db, ['5']);

    expect(getStudyStatus(db, '5')).toBe('known');
  });

  it('bulkSetStudyStatusKnown is idempotent when items are already known', async () => {
    const db = await createUserDb();

    setStudyStatus(db, '8', 'known');
    const first = bulkSetStudyStatusKnown(db, ['8']);
    const second = bulkSetStudyStatusKnown(db, ['8']);

    expect(first).toEqual({ updatedCount: 1 });
    expect(second).toEqual({ updatedCount: 1 });
    expect(getStudyStatus(db, '8')).toBe('known');
  });

  it('bulkSetStudyStatusKnown rejects invalid item ids', async () => {
    const db = await createUserDb();

    expect(() => bulkSetStudyStatusKnown(db, ['abc'])).toThrow('Invalid item id');
    expect(() => bulkSetStudyStatusKnown(db, ['1', '0'])).toThrow('Invalid item id');
  });
});
