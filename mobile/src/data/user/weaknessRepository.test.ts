import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { WEAKNESS_MIN_SAMPLE } from '@/config/constants';
import { migration007WeaknessStats } from '@/data/migrations/007_weakness_stats';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getAllWeaknessStats,
  getWeaknessScores,
  recordOutcome,
} from '@/data/user/weaknessRepository';

describe('weaknessRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration007WeaknessStats]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  describe('recordOutcome', () => {
    it('increments correct_count on correct outcome', async () => {
      const userDb = await createUserDb();

      const result = recordOutcome(userDb, { itemId: '1', result: 'correct', promptType: 'meaning' });
      expect(result.ok).toBe(true);

      // Score = 0 below WEAKNESS_MIN_SAMPLE, but row was inserted
      const stats = getAllWeaknessStats(userDb);
      const stat = stats.find((s) => s.itemId === '1');
      expect(stat).toBeDefined();
      expect(stat!.correctCount).toBe(1);
      expect(stat!.incorrectCount).toBe(0);
    });

    it('increments incorrect_count and sets last_error metadata on incorrect', async () => {
      const userDb = await createUserDb();

      const result = recordOutcome(userDb, { itemId: '2', result: 'incorrect', promptType: 'reading' });
      expect(result.ok).toBe(true);

      const stats = getAllWeaknessStats(userDb);
      const stat = stats.find((s) => s.itemId === '2');
      expect(stat).toBeDefined();
      expect(stat!.incorrectCount).toBe(1);
      expect(stat!.correctCount).toBe(0);
      expect(stat!.lastErrorType).toBe('reading');
      expect(stat!.lastErrorAt).not.toBeNull();
    });

    it('increments typo_count on typo but does NOT set last_error metadata', async () => {
      const userDb = await createUserDb();

      const result = recordOutcome(userDb, { itemId: '3', result: 'typo', promptType: 'meaning' });
      expect(result.ok).toBe(true);

      const stats = getAllWeaknessStats(userDb);
      const stat = stats.find((s) => s.itemId === '3');
      expect(stat).toBeDefined();
      expect(stat!.typoCount).toBe(1);
      expect(stat!.correctCount).toBe(0);
      expect(stat!.incorrectCount).toBe(0);
      expect(stat!.lastErrorAt).toBeNull();
      expect(stat!.lastErrorType).toBeNull();
    });

    it('accumulates counts across multiple calls', async () => {
      const userDb = await createUserDb();

      recordOutcome(userDb, { itemId: '4', result: 'correct', promptType: 'meaning' });
      recordOutcome(userDb, { itemId: '4', result: 'correct', promptType: 'meaning' });
      recordOutcome(userDb, { itemId: '4', result: 'incorrect', promptType: 'reading' });

      const stats = getAllWeaknessStats(userDb);
      const stat = stats.find((s) => s.itemId === '4');
      expect(stat!.correctCount).toBe(2);
      expect(stat!.incorrectCount).toBe(1);
    });

    it('returns ok: false (not a throw) when write fails', async () => {
      const userDb = await createUserDb();

      // Corrupt the database by closing it — just test with an invalid id
      const result = recordOutcome(userDb, { itemId: '0', result: 'correct', promptType: 'meaning' });
      expect(result.ok).toBe(false);
    });
  });

  describe('getWeaknessScores', () => {
    it('returns empty map for no item IDs', async () => {
      const userDb = await createUserDb();
      expect(getWeaknessScores(userDb, []).size).toBe(0);
    });

    it('returns 0 (absent from map) for unrecorded items', async () => {
      const userDb = await createUserDb();
      const scores = getWeaknessScores(userDb, ['99', '100']);
      // Items with no row are not in the map; callers use ?? 0
      expect(scores.has('99')).toBe(false);
      expect(scores.has('100')).toBe(false);
    });

    it('returns 0 for items below WEAKNESS_MIN_SAMPLE', async () => {
      const userDb = await createUserDb();

      // Record fewer than WEAKNESS_MIN_SAMPLE total answers
      for (let i = 0; i < WEAKNESS_MIN_SAMPLE - 1; i++) {
        recordOutcome(userDb, { itemId: '5', result: i % 2 === 0 ? 'correct' : 'incorrect', promptType: 'meaning' });
      }

      const scores = getWeaknessScores(userDb, ['5']);
      expect(scores.get('5') ?? 0).toBe(0);
    });

    it('returns a positive score for items with sufficient incorrect answers', async () => {
      const userDb = await createUserDb();

      // Record WEAKNESS_MIN_SAMPLE all-incorrect answers
      for (let i = 0; i < WEAKNESS_MIN_SAMPLE; i++) {
        recordOutcome(userDb, { itemId: '6', result: 'incorrect', promptType: 'meaning' });
      }

      const scores = getWeaknessScores(userDb, ['6']);
      expect(scores.get('6')).toBeGreaterThan(0);
    });

    it('handles batched read over many IDs', async () => {
      const userDb = await createUserDb();

      const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
      // Record some outcomes
      for (const id of ids.slice(0, 5)) {
        recordOutcome(userDb, { itemId: id, result: 'correct', promptType: 'meaning' });
      }

      const scores = getWeaknessScores(userDb, ids);
      // All recorded items return 0 (below min sample) — just verify no throw
      expect(scores).toBeInstanceOf(Map);
    });
  });

  describe('getAllWeaknessStats', () => {
    it('returns empty array when no stats exist', async () => {
      const userDb = await createUserDb();
      expect(getAllWeaknessStats(userDb)).toHaveLength(0);
    });

    it('returns all recorded stats', async () => {
      const userDb = await createUserDb();

      recordOutcome(userDb, { itemId: '10', result: 'correct', promptType: 'meaning' });
      recordOutcome(userDb, { itemId: '11', result: 'incorrect', promptType: 'reading' });

      const stats = getAllWeaknessStats(userDb);
      expect(stats).toHaveLength(2);
      const ids = stats.map((s) => s.itemId);
      expect(ids).toContain('10');
      expect(ids).toContain('11');
    });
  });
});
