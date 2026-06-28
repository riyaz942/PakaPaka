import { openDatabaseAsync, __mockResetSqlite, __mockSetSrsStates } from '../../../__mocks__/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getDueSrsStates,
  getSrsStageCounts,
  getSrsState,
  seedMissingSrsStatesForInProgress,
  upsertSrsState,
} from './srsStateRepository';
import type { SRSState } from '@/core/srs/srs.types';

const NOW = new Date('2026-06-27T10:00:00.000Z');
const PAST_ISO = '2026-06-26T10:00:00.000Z';
const FUTURE_ISO = '2026-06-28T10:00:00.000Z';

function makeSrsState(itemId: string, overrides: Partial<SRSState> = {}): SRSState {
  return {
    itemId,
    stability: 5,
    difficulty: 5,
    dueDate: PAST_ISO,
    fsrsState: 'review',
    reps: 3,
    lapses: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    updatedAt: PAST_ISO,
    ...overrides,
  };
}

let db: SQLiteDatabase;

beforeEach(async () => {
  __mockResetSqlite();
  db = await openDatabaseAsync('user.db') as unknown as SQLiteDatabase;
});

describe('getSrsStageCounts', () => {
  it('returns all five stages at zero on an empty database', () => {
    const counts = getSrsStageCounts(db);
    expect(counts).toEqual({
      apprentice: 0,
      guru: 0,
      master: 0,
      enlightened: 0,
      burned: 0,
    });
  });

  it('returns correct per-stage counts for mixed rows', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 1, lapses: 0, is_burned: 0, srs_stage_label: 'apprentice', updated_at: PAST_ISO },
      { item_id: 2, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 2, lapses: 0, is_burned: 0, srs_stage_label: 'apprentice', updated_at: PAST_ISO },
      { item_id: 3, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
      { item_id: 4, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 4, lapses: 0, is_burned: 0, srs_stage_label: 'master', updated_at: PAST_ISO },
      { item_id: 5, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 5, lapses: 0, is_burned: 0, srs_stage_label: 'enlightened', updated_at: PAST_ISO },
    ]);

    expect(getSrsStageCounts(db)).toEqual({
      apprentice: 2,
      guru: 1,
      master: 1,
      enlightened: 1,
      burned: 0,
    });
  });

  it('includes burned rows in the burned stage count', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 1, srs_stage_label: 'burned', updated_at: PAST_ISO },
      { item_id: 2, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 1, srs_stage_label: 'burned', updated_at: PAST_ISO },
      { item_id: 3, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
    ]);

    expect(getSrsStageCounts(db)).toEqual({
      apprentice: 0,
      guru: 1,
      master: 0,
      enlightened: 0,
      burned: 2,
    });
  });
});

describe('getDueSrsStates', () => {
  it('returns items with due_date <= now and is_burned = 0', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
      { item_id: 2, stability: 5, difficulty: 5, due_date: FUTURE_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
      { item_id: 3, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 1, srs_stage_label: 'burned', updated_at: PAST_ISO },
    ]);

    const result = getDueSrsStates(db, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('1');
  });

  it('returns empty array when nothing is due', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 5, difficulty: 5, due_date: FUTURE_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
    ]);
    const result = getDueSrsStates(db, NOW);
    expect(result).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 1, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
      { item_id: 2, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 2, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
      { item_id: 3, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
    ]);
    const result = getDueSrsStates(db, NOW, 2);
    expect(result).toHaveLength(2);
  });
});

describe('getSrsState', () => {
  it('returns null for unknown item', () => {
    expect(getSrsState(db, '999')).toBeNull();
  });

  it('returns the SRS state for a known item', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 5, stability: 7, difficulty: 4, due_date: PAST_ISO, fsrs_state: 'review', reps: 2, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
    ]);
    const result = getSrsState(db, '5');
    expect(result).not.toBeNull();
    expect(result!.itemId).toBe('5');
    expect(result!.stability).toBe(7);
  });
});

describe('upsertSrsState', () => {
  it('inserts a new SRS state', () => {
    const state = makeSrsState('10');
    const result = upsertSrsState(db, state);
    expect(result.ok).toBe(true);
    const fetched = getSrsState(db, '10');
    expect(fetched).not.toBeNull();
    expect(fetched!.itemId).toBe('10');
  });

  it('updates an existing SRS state', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 10, stability: 5, difficulty: 5, due_date: PAST_ISO, fsrs_state: 'review', reps: 3, lapses: 0, is_burned: 0, srs_stage_label: 'guru', updated_at: PAST_ISO },
    ]);
    const updated = makeSrsState('10', { stability: 15, srsStageLabel: 'master' });
    const result = upsertSrsState(db, updated);
    expect(result.ok).toBe(true);
    const fetched = getSrsState(db, '10');
    expect(fetched!.stability).toBe(15);
    expect(fetched!.srsStageLabel).toBe('master');
  });

  it('syncs item_study_status to known when isBurned=true', () => {
    const state = makeSrsState('20', { isBurned: true, srsStageLabel: 'burned' });
    upsertSrsState(db, state);
    const rows = db.getAllSync<{ item_id: number; status: string }>(
      `SELECT item_id, status FROM item_study_status WHERE item_id = ?`,
      20,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('known');
  });
});

describe('seedMissingSrsStatesForInProgress', () => {
  it('seeds SRS state for items without existing rows', () => {
    const result = seedMissingSrsStatesForInProgress(db, ['1', '2']);
    expect(result.ok).toBe(true);
    expect(getSrsState(db, '1')).not.toBeNull();
    expect(getSrsState(db, '2')).not.toBeNull();
  });

  it('does NOT overwrite existing SRS rows (idempotent)', () => {
    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 99, difficulty: 3, due_date: PAST_ISO, fsrs_state: 'review', reps: 10, lapses: 0, is_burned: 0, srs_stage_label: 'enlightened', updated_at: PAST_ISO },
    ]);
    const result = seedMissingSrsStatesForInProgress(db, ['1']);
    expect(result.ok).toBe(true);
    const state = getSrsState(db, '1');
    expect(state!.stability).toBe(99); // unchanged
    expect(state!.srsStageLabel).toBe('enlightened'); // unchanged
  });

  it('returns ok for empty itemIds array', () => {
    const result = seedMissingSrsStatesForInProgress(db, []);
    expect(result.ok).toBe(true);
  });

  it('seeds with fsrsState=new and srsStageLabel=apprentice', () => {
    seedMissingSrsStatesForInProgress(db, ['5']);
    const state = getSrsState(db, '5');
    expect(state!.fsrsState).toBe('new');
    expect(state!.srsStageLabel).toBe('apprentice');
    expect(state!.isBurned).toBe(false);
  });
});
