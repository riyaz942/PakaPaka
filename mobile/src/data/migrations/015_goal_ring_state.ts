import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Sticky daily goal state for the adaptive goal ring (FR55–57).
 * Single-row table (id = 1). `daily_goal_target` NULL means "unset — seed from
 * intensity base". `cognitive_load_history` stays the achievement ledger; this
 * table owns the goal denominator and the weekly ratchet bookkeeping.
 */
export const migration015GoalRingState: Migration = {
  version: 15,
  name: '015_goal_ring_state',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS goal_ring_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        daily_goal_target REAL,
        goal_week_start TEXT,
        consecutive_miss_weeks INTEGER NOT NULL DEFAULT 0,
        pending_rise_to REAL,
        pending_reduction_to REAL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
