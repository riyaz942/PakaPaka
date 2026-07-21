import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Pins a conversation to the grammar it was started with.
 *
 * `topic_item_id` held a single id, which was enough for `choose_grammar` but
 * not for `practise_recent_grammar`: that mode grounds the prompt in the whole
 * recent set, so re-deriving it on resume silently re-grounded the session in
 * whatever the learner had studied since. This column stores the full set as a
 * JSON array of item ids, captured once at session start.
 *
 * `topic_item_id` is left in place and still written — it remains the single
 * chosen topic for `choose_grammar`, and existing rows keep reading correctly.
 */
export const migration018AiSessionTopicIds: Migration = {
  version: 18,
  name: '018_ai_session_topic_ids',
  up: (db) => {
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(ai_sessions)');
    if (columns.some((column) => column.name === 'topic_item_ids')) {
      return;
    }
    db.execSync('ALTER TABLE ai_sessions ADD COLUMN topic_item_ids TEXT;');
  },
};
