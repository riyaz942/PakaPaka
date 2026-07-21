import type { Migration } from '@/data/migrations/migrations.types';

/**
 * AI conversation persistence (FR89, FR94–FR96, NFR28).
 *
 * The summary lives in nullable columns on `ai_sessions` rather than its own
 * table: a summary is generated once, cached, and never regenerated, so it is
 * one-to-one with the session and a separate table would only add a join.
 * `summary_generated_at` being null is what "not summarised yet" means, which
 * is also how an abandoned-but-resumable session reads (FR94).
 *
 * Note: the planning docs call this migration `016`; that id was taken by
 * `016_furigana_overrides` before this story shipped, hence `017`.
 */
export const migration017AiSessions: Migration = {
  version: 17,
  name: '017_ai_sessions',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS ai_sessions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        mode TEXT NOT NULL,
        topic_item_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        ended_reason TEXT CHECK (ended_reason IN ('ai_wrap_up', 'user_end', 'abandoned')),
        turn_count INTEGER NOT NULL DEFAULT 0,
        summary_json TEXT,
        summary_generated_at TEXT
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_session
        ON ai_messages (session_id, created_at);
    `);
  },
};
