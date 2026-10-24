import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetItemStudyStatuses,
  __mockSetSrsStates,
} from '../../../__mocks__/expo-sqlite';

import {
  countStartedOrKnownItems,
  listGrammarStarts,
} from '@/data/user/lessonLearnerRepository';

function srsRow(itemId: number, stage: string) {
  return {
    item_id: itemId,
    stability: 1,
    difficulty: 5,
    due_date: '2026-10-26T00:00:00.000Z',
    fsrs_state: 'review',
    reps: 1,
    lapses: 0,
    is_burned: 0,
    srs_stage_label: stage,
    updated_at: '2026-10-24T00:00:00.000Z',
  };
}

describe('lessonLearnerRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('counts known items that have no srs row', async () => {
    const db = await openDatabaseAsync('user.db');
    // 1: srs row only; 2: in_progress + srs row; 3: known, no srs row; 4: nothing.
    __mockSetSrsStates('user.db', [srsRow(1, 'apprentice'), srsRow(2, 'apprentice')]);
    __mockSetItemStudyStatuses('user.db', [
      { item_id: 2, status: 'in_progress', updated_at: '2026-10-24T00:00:00.000Z' },
      { item_id: 3, status: 'known', updated_at: '2026-10-24T00:00:00.000Z' },
    ]);

    expect(countStartedOrKnownItems(db, ['1', '2', '3', '4'])).toBe(3);
  });

  it('lists in_progress grammar with its start time and stage', async () => {
    const db = await openDatabaseAsync('user.db');
    __mockSetItemStudyStatuses('user.db', [
      { item_id: 1, status: 'in_progress', updated_at: '2026-10-24T01:00:00.000Z' },
      { item_id: 2, status: 'known', updated_at: '2026-10-24T02:00:00.000Z' },
      { item_id: 3, status: 'in_progress', updated_at: '2026-10-24T03:00:00.000Z' },
    ]);
    __mockSetSrsStates('user.db', [srsRow(1, 'guru')]);

    expect(listGrammarStarts(db, ['1', '2', '3'])).toEqual([
      { itemId: '1', startedAt: '2026-10-24T01:00:00.000Z', stage: 'guru' },
      { itemId: '3', startedAt: '2026-10-24T03:00:00.000Z', stage: null },
    ]);
  });
});
