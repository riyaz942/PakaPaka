import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';
import { readCurriculumLookup, readSyncSnapshot, readUserTables } from '@/data/sync/syncSnapshot';
import { migrations } from '@/data/migrations';
import { openTestUserDb, seedCurriculum, type TestDb } from '@/test-support/sqliteTestDb';

const AT = '2026-11-01T00:00:00.000Z';
const NEKO_ID = 1;

/** The rows of `fullSampleData()`, written with raw SQL so the read is checked on its own. */
async function seedSampleRows(db: TestDb): Promise<void> {
  const inserts: [string, unknown[]][] = [
    ['INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)', ['session_intensity', 'standard', AT]],
    ['INSERT INTO item_study_status (item_id, status, updated_at) VALUES (?, ?, ?)', [NEKO_ID, 'known', AT]],
    [
      `INSERT INTO srs_states (item_id, stability, difficulty, due_date, fsrs_state, reps, lapses,
         learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [NEKO_ID, 2.5, 5, AT, 'review', 3, 0, 0, 0, 'Apprentice 2', null, AT],
    ],
    [
      'INSERT INTO import_metadata (source, imported_at, mapped_count, unmatched_count) VALUES (?, ?, ?, ?)',
      ['anki', AT, 4, 1],
    ],
    ['INSERT INTO personal_mnemonics (item_id, mnemonic_text, updated_at) VALUES (?, ?, ?)', [NEKO_ID, 'cat', AT]],
    ['INSERT INTO related_item_boosts (item_id, boost, updated_at) VALUES (?, ?, ?)', [NEKO_ID, 0.5, AT]],
    [
      `INSERT INTO weakness_stats (item_id, correct_count, incorrect_count, typo_count, last_error_at,
         last_error_type, pattern_tags, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [NEKO_ID, 1, 2, 0, null, null, null, AT],
    ],
    [
      'INSERT INTO cognitive_load_history (date, load, threshold, updated_at) VALUES (?, ?, ?, ?)',
      ['2026-11-01', 12, 40, AT],
    ],
    [
      `INSERT INTO streaks (id, current_streak, longest_streak, last_review_date, last_celebrated_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 2, 5, '2026-11-01', null, AT],
    ],
    [
      'INSERT INTO user_synonyms (item_id, answer_type, answer_text, created_at) VALUES (?, ?, ?, ?)',
      [NEKO_ID, 'meaning', 'cat', AT],
    ],
    ['INSERT INTO daily_lesson_log (date, items_started) VALUES (?, ?)', ['2026-11-01', 3]],
    [
      `INSERT INTO goal_ring_state (id, daily_goal_target, goal_week_start, consecutive_miss_weeks,
         pending_rise_to, pending_reduction_to, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, null, null, 0, null, null, AT],
    ],
    [
      'INSERT INTO furigana_overrides (item_id, display_mode, updated_at) VALUES (?, ?, ?)',
      [String(NEKO_ID), 'shown', AT],
    ],
    ['INSERT INTO card_seen (card_id, seen_at) VALUES (?, ?)', ['welcome', AT]],
    [
      `INSERT INTO passage_practice_results (passage_id, question_id, is_correct, user_answer, answered_at)
       VALUES (?, ?, ?, ?, ?)`,
      [7, 21, 1, 'a', AT],
    ],
    [
      'INSERT INTO user_grammar_answers (item_id, sentence_key, answer_text, created_at) VALUES (?, ?, ?, ?)',
      [NEKO_ID, '猫がいる', '猫がいます', AT],
    ],
    [
      'INSERT INTO grammar_sentence_history (item_id, sentence_keys, updated_at) VALUES (?, ?, ?)',
      [NEKO_ID, JSON.stringify(['a', 'b']), AT],
    ],
    ['INSERT INTO lesson_opt_ins (item_id, opted_in_at) VALUES (?, ?)', [String(NEKO_ID), AT]],
  ];
  for (const [sql, params] of inserts) {
    await db.runAsync(sql, params as never);
  }
}

async function openSeededDb(): Promise<TestDb> {
  const db = await openTestUserDb();
  await seedCurriculum(db, {
    items: [[NEKO_ID, { itemType: 'vocabulary', slug: 'neko' }]],
    questions: [[7, 21]],
    version: '31',
  });
  return db;
}

describe('readUserTables', () => {
  it('readUserTables returns every table keyed by slug and leaves out never-synced preferences', async () => {
    const db = await openSeededDb();
    await seedSampleRows(db);
    await db.runAsync(
      'INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)',
      'theme_mode',
      'dark',
      AT,
    );

    const lookup = await readCurriculumLookup(db);

    expect(await readUserTables(db, lookup)).toEqual(fullSampleData());
  });

  it('readUserTables leaves out a row whose item is not in the curriculum', async () => {
    const db = await openSeededDb();
    await db.runAsync(
      'INSERT INTO item_study_status (item_id, status, updated_at) VALUES (?, ?, ?)',
      99,
      'known',
      AT,
    );
    await db.runAsync(
      'INSERT INTO furigana_overrides (item_id, display_mode, updated_at) VALUES (?, ?, ?)',
      '99',
      'hidden',
      AT,
    );

    const lookup = await readCurriculumLookup(db);

    expect(await readUserTables(db, lookup)).toEqual(emptySyncData());
  });
});

describe('readCurriculumLookup', () => {
  it('maps item ids both ways and knows passage questions by their raw ids', async () => {
    const db = await openSeededDb();

    const lookup = await readCurriculumLookup(db);

    expect(lookup.idToRef.get(NEKO_ID)).toEqual({ itemType: 'vocabulary', slug: 'neko' });
    expect(lookup.refToId.get('vocabulary:neko')).toBe(NEKO_ID);
    expect(lookup.known.hasItem({ itemType: 'vocabulary', slug: 'neko' })).toBe(true);
    expect(lookup.known.hasItem({ itemType: 'kanji', slug: 'neko' })).toBe(false);
    expect(lookup.known.hasPassageQuestion('7', '21')).toBe(true);
    expect(lookup.known.hasPassageQuestion('7', '22')).toBe(false);
    expect(lookup.known.hasPassageQuestion('8', '21')).toBe(false);
    expect(lookup.curriculumVersion).toBe('31');
  });
});

describe('readSyncSnapshot', () => {
  it('returns the sync data, the schema version and the lookup', async () => {
    const db = await openSeededDb();
    await seedSampleRows(db);

    const result = await readSyncSnapshot(db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data).toEqual(fullSampleData());
    expect(result.value.schemaVersion).toBe(migrations.length);
    expect(result.value.lookup.curriculumVersion).toBe('31');
  });

  it('returns sync_local_failed when a read fails', async () => {
    const db = await openSeededDb();
    jest.spyOn(db, 'getAllAsync').mockRejectedValue(new Error('disk I/O error'));

    const result = await readSyncSnapshot(db);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_local_failed');
  });
});
