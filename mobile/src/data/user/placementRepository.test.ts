import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { applyPlacement, levelsBelow } from '@/data/user/placementRepository';

function item(id: number, itemType: string, level: string, sortOrder: number) {
  return {
    id,
    item_type: itemType,
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: `form-${id}`,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

async function createDatabases() {
  const userDb = await openDatabaseAsync('user.db');
  const curriculumDb = await openDatabaseAsync('curriculum.db.test');

  const migrationResult = runMigrations(userDb, [
    migration001Initial,
    migration002ItemStudyStatus,
  ]);
  expect(migrationResult.ok).toBe(true);

  __mockSetItems('curriculum.db.test', [
    item(1, 'radical', 'N5', 1),
    item(2, 'radical', 'N5', 2),
    item(11, 'kanji', 'N4', 1),
    item(12, 'kanji', 'N4', 2),
    item(21, 'kanji', 'N3', 1),
    item(22, 'kanji', 'N3', 2),
  ]);

  return { userDb, curriculumDb };
}

describe('levelsBelow', () => {
  it('lists the easier levels in curriculum order', () => {
    expect(levelsBelow('N3')).toEqual(['N5', 'N4']);
    expect(levelsBelow('N5')).toEqual([]);
  });
});

describe('applyPlacement', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('marks the tested level ids plus everything below the range', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    const result = applyPlacement(userDb, curriculumDb, [
      { level: 'N4', knownIds: ['11'] },
    ]);

    expect(result.lowerLevelCount).toBe(2);
    expect(result.withinLevelCounts).toEqual([{ level: 'N4', count: 1 }]);

    const statuses = listStudyStatusesForItems(userDb, ['1', '2', '11', '12']);
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');
    expect(statuses.get('11')).toBe('known');
    expect(statuses.get('12')).toBeUndefined();
  });

  it('reports a count per tested level and anchors below the lowest one', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    const result = applyPlacement(userDb, curriculumDb, [
      { level: 'N4', knownIds: ['11', '12'] },
      { level: 'N3', knownIds: ['21'] },
    ]);

    // Below the lowest tested level (N4) → the two N5 radicals only.
    expect(result.lowerLevelCount).toBe(2);
    expect(result.withinLevelCounts).toEqual([
      { level: 'N4', count: 2 },
      { level: 'N3', count: 1 },
    ]);

    const statuses = listStudyStatusesForItems(userDb, ['1', '11', '12', '21', '22']);
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('12')).toBe('known');
    expect(statuses.get('21')).toBe('known');
    expect(statuses.get('22')).toBeUndefined();
  });

  it('anchors on the lowest tested level regardless of list order', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    const result = applyPlacement(userDb, curriculumDb, [
      { level: 'N3', knownIds: [] },
      { level: 'N4', knownIds: [] },
    ]);

    expect(result.lowerLevelCount).toBe(2);
  });

  it('start from scratch marks nothing inside the range but still unlocks below it', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    const result = applyPlacement(userDb, curriculumDb, [
      { level: 'N4', knownIds: [] },
      { level: 'N3', knownIds: [] },
    ]);

    expect(result.lowerLevelCount).toBe(2);
    expect(result.withinLevelCounts).toEqual([
      { level: 'N4', count: 0 },
      { level: 'N3', count: 0 },
    ]);

    const statuses = listStudyStatusesForItems(userDb, ['1', '2', '11', '21']);
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');
    expect(statuses.get('11')).toBeUndefined();
    expect(statuses.get('21')).toBeUndefined();
  });
});
