import * as SecureStore from 'expo-secure-store';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as pako from 'pako';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { buildBackupBundle, serializeBackupBundle } from '@/core/backup/backupSerializer';
import type { BackupBundle, BackupData } from '@/core/backup/backup.types';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { exportBackup } from '@/data/user/exportBackup';
import { getPreference, setPreference } from '@/data/user/preferencesRepository';
import { previewRestore, restoreBackup } from '@/data/user/restoreBackup';
import { subscribeFuriganaOverrides } from '@/data/user/furiganaOverrideEvents';
import {
  getMockFileContents,
  resetMockFileSystem,
  setMockFileContents,
} from '@/test-support/file-system-test-state';

const BACKUP_URI = 'file:///mock-documents/pakapaka-backup.json.gz';

const CURRICULUM_ITEMS = [
  { id: 1, item_type: 'kanji', slug: 'sun' },
  { id: 2, item_type: 'vocabulary', slug: 'nichiyoubi' },
];

/** Same slugs, different row ids — what an OTA recompile does (AC1/AC5). */
const SHIFTED_CURRICULUM_ITEMS = [
  { id: 101, item_type: 'kanji', slug: 'sun' },
  { id: 102, item_type: 'vocabulary', slug: 'nichiyoubi' },
];

function emptyData(): BackupData {
  return {
    userPreferences: [],
    itemStudyStatus: [],
    srsStates: [],
    importMetadata: [],
    personalMnemonics: [],
    relatedItemBoosts: [],
    weaknessStats: [],
    cognitiveLoadHistory: [],
    streaks: [],
    userSynonyms: [],
    dailyLessonLog: [],
    goalRingState: [],
    furiganaOverrides: [],
    cardSeen: [],
    passagePracticeResults: [],
    grammarAnswers: [],
    grammarSentenceHistory: [],
    aiSessions: [],
    aiMessages: [],
  };
}

function srsRow(slug: string, itemType: 'kanji' | 'vocabulary', dueDate: string) {
  return {
    item: { itemType, slug },
    stability: 2.5,
    difficulty: 4.1,
    dueDate,
    fsrsState: 'review' as const,
    reps: 3,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    lastReviewedAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function makeBundle(
  data: Partial<BackupData> = {},
  envelope: Partial<{
    schemaVersion: number;
    curriculumVersion: string | null;
    exportedAt: string;
    includesConversations: boolean;
  }> = {},
): BackupBundle {
  return buildBackupBundle(
    {
      schemaVersion: envelope.schemaVersion ?? 19,
      curriculumVersion: envelope.curriculumVersion ?? '1.4.0',
      exportedAt: envelope.exportedAt ?? '2026-08-10T00:00:00.000Z',
      includesConversations: envelope.includesConversations ?? false,
    },
    { ...emptyData(), ...data },
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return globalThis.btoa(binary);
}

function writeBackupFixture(bundle: BackupBundle, uri = BACKUP_URI): string {
  setMockFileContents(uri, bytesToBase64(pako.gzip(serializeBackupBundle(bundle))));
  return uri;
}

function writeRawFixture(contents: string | Uint8Array, uri = BACKUP_URI): string {
  const bytes =
    typeof contents === 'string'
      ? Uint8Array.from(contents, (character) => character.charCodeAt(0))
      : contents;
  setMockFileContents(uri, bytesToBase64(bytes));
  return uri;
}

async function createUserDb(
  items: { id: number; item_type: string; slug: string }[] = CURRICULUM_ITEMS,
): Promise<SQLiteDatabase> {
  const userDb = await openDatabaseAsync('user.db');
  expect(runMigrations(userDb, migrations).ok).toBe(true);
  __mockSetItems('user.db', items);
  return userDb;
}

function rows(userDb: SQLiteDatabase, table: string): Record<string, unknown>[] {
  return userDb.getAllSync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}

async function previewOrThrow(userDb: SQLiteDatabase, uri = BACKUP_URI) {
  const preview = await previewRestore(userDb, uri);
  if (!preview.ok) throw new Error(`Preview failed: ${preview.error.code}`);
  return preview.value;
}

describe('previewRestore', () => {
  beforeEach(() => {
    __mockResetSqlite();
    resetMockFileSystem();
  });

  it('summarises the bundle without writing anything', async () => {
    const userDb = await createUserDb();
    setPreference(userDb, 'theme_mode', 'light');
    writeBackupFixture(
      makeBundle({
        srsStates: [srsRow('sun', 'kanji', '2026-08-05T00:00:00.000Z')],
        userPreferences: [
          { key: 'theme_mode', value: 'dark', updatedAt: '2026-08-01T00:00:00.000Z' },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);

    expect(preview.summary.itemCount).toBe(2);
    expect(preview.summary.unmatchedSlugCount).toBe(0);
    expect(preview.summary.unmatchedPassageCount).toBe(0);
    expect(preview.summary.includesConversations).toBe(false);
    expect(preview.summary.exportedAt).toBe('2026-08-10T00:00:00.000Z');
    expect(preview.summary.curriculumVersion).toBe('1.4.0');

    // Nothing written: the pre-existing preference is untouched.
    expect(getPreference(userDb, 'theme_mode')).toBe('light');
    expect(rows(userDb, 'srs_states')).toHaveLength(0);
  });

  it('does not count unknown extra tables in the preview row count', async () => {
    const userDb = await createUserDb();
    const bundle = makeBundle({
      srsStates: [srsRow('sun', 'kanji', '2026-08-05T00:00:00.000Z')],
    });
    const parsed = JSON.parse(serializeBackupBundle(bundle)) as { data: Record<string, unknown> };
    parsed.data.futureTable = [{ x: 1 }, { x: 2 }];
    writeRawFixture(pako.gzip(JSON.stringify(parsed)));

    const preview = await previewOrThrow(userDb);
    expect(preview.summary.itemCount).toBe(1);
  });

  it('counts slugs this curriculum no longer has', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        srsStates: [
          srsRow('sun', 'kanji', '2026-08-05T00:00:00.000Z'),
          srsRow('gone-forever', 'kanji', '2026-08-05T00:00:00.000Z'),
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);

    expect(preview.summary.unmatchedSlugCount).toBe(1);
    expect(preview.unmatchedSlugs).toEqual(['kanji:gone-forever']);
  });

  it('fails a truncated gzip file as a typed error', async () => {
    const userDb = await createUserDb();
    const gzipped = pako.gzip(serializeBackupBundle(makeBundle()));
    writeRawFixture(gzipped.slice(0, Math.floor(gzipped.length / 2)));

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_GZIP');
    expect(result.error.userMessage).toMatch(/\.json\.gz/);
  });

  it('fails random bytes as a typed error', async () => {
    const userDb = await createUserDb();
    writeRawFixture(new Uint8Array([3, 141, 59, 26, 53, 89, 79, 32]));

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_GZIP');
  });

  it('tells a learner who picked the un-gzipped JSON which file to pick', async () => {
    const userDb = await createUserDb();
    writeRawFixture(serializeBackupBundle(makeBundle()));

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_GZIP');
    expect(result.error.userMessage).toMatch(/\.json\.gz/);
  });

  it('fails a file that is not a PakaPaka backup', async () => {
    const userDb = await createUserDb();
    writeRawFixture(pako.gzip(JSON.stringify({ format: 'anki-export', formatVersion: 1 })));

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_FORMAT_MISMATCH');
    expect(result.error.userMessage).toBe('That file is not a PakaPaka backup.');
    expect(result.error.userMessage).not.toMatch(/\.json\.gz/);
  });

  it('fails an unsupported formatVersion', async () => {
    const userDb = await createUserDb();
    writeRawFixture(
      pako.gzip(JSON.stringify({ ...makeBundle(), formatVersion: 2 })),
    );

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_VERSION_UNSUPPORTED');
    expect(result.error.userMessage).toMatch(/newer version/i);
    expect(result.error.userMessage).not.toMatch(/\.json\.gz/);
  });

  it('fails a null row with BACKUP_INVALID_SHAPE', async () => {
    const userDb = await createUserDb();
    const bundle = makeBundle();
    (bundle.data.cardSeen as unknown[])[0] = null;
    writeBackupFixture(bundle);

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
    expect(result.error.userMessage).toBeDefined();
  });

  it('fails an item-keyed row with no item ref', async () => {
    const userDb = await createUserDb();
    const bundle = makeBundle();
    (bundle.data.srsStates as unknown[])[0] = { stability: 1, difficulty: 2 };
    writeBackupFixture(bundle);

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
  });

  it('refuses a backup from a newer schema', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(makeBundle({}, { schemaVersion: 99 }));

    const result = await previewRestore(userDb, BACKUP_URI);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_SCHEMA_TOO_NEW');
    expect(result.error.userMessage).toMatch(/newer version/i);
  });

  it('fails with a typed error when the file cannot be read', async () => {
    const userDb = await createUserDb();

    const result = await previewRestore(userDb, 'file:///nowhere/missing.json.gz');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_READ_FAILED');
    expect(result.error.userMessage).toBeDefined();
  });
});

describe('restoreBackup', () => {
  beforeEach(() => {
    __mockResetSqlite();
    resetMockFileSystem();
  });

  it('replaces current progress instead of merging it', async () => {
    const userDb = await createUserDb();
    // Item 1 (sun) has progress here; the backup only knows item 2.
    userDb.runSync(
      `INSERT INTO srs_states (item_id, stability, difficulty, due_date, fsrs_state, reps, lapses,
         learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      1, 1, 1, '2026-08-01T00:00:00.000Z', 'review', 1, 0, 0, 0, 'apprentice', null,
      '2026-08-01T00:00:00.000Z',
    );
    writeBackupFixture(
      makeBundle({ srsStates: [srsRow('nichiyoubi', 'vocabulary', '2026-08-05T00:00:00.000Z')] }),
    );

    const preview = await previewOrThrow(userDb);
    const result = restoreBackup(userDb, preview, 'settings');

    expect(result.ok).toBe(true);
    const srsStates = rows(userDb, 'srs_states');
    expect(srsStates).toHaveLength(1);
    expect(srsStates[0].item_id).toBe(2);
  });

  it('lands progress on the current row id when curriculum ids have shifted', async () => {
    const userDb = await createUserDb(SHIFTED_CURRICULUM_ITEMS);
    writeBackupFixture(
      makeBundle({
        itemStudyStatus: [
          {
            item: { itemType: 'vocabulary', slug: 'nichiyoubi' },
            status: 'known',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    const studyStatus = rows(userDb, 'item_study_status');
    expect(studyStatus).toHaveLength(1);
    expect(studyStatus[0].item_id).toBe(102);
    expect(studyStatus[0].item_id).not.toBe(2);
  });

  it('skips unmatched slugs rather than writing an unresolved row', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        srsStates: [
          srsRow('sun', 'kanji', '2026-08-05T00:00:00.000Z'),
          srsRow('gone-forever', 'kanji', '2026-08-05T00:00:00.000Z'),
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    const result = restoreBackup(userDb, preview, 'settings');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unmatchedSlugCount).toBe(1);
    // The count reports rows actually written, not the bundle's row count.
    expect(result.value.restoredRowCount).toBe(1);
    expect(preview.summary.itemCount).toBe(2);
    const srsStates = rows(userDb, 'srs_states');
    expect(srsStates).toHaveLength(1);
    expect(srsStates[0].item_id).toBe(1);
  });

  it('empties existing conversations when the backup has none', async () => {
    const userDb = await createUserDb();
    userDb.runSync(
      'INSERT INTO ai_sessions (id, provider, model, mode, topic_item_id, started_at) VALUES (?, ?, ?, ?, ?, ?)',
      'old-session', 'anthropic', 'claude-sonnet-5', 'random', null, '2026-08-01T00:00:00.000Z',
    );
    userDb.runSync(
      'INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      'old-message', 'old-session', 'user', 'hello', '2026-08-01T00:00:00.000Z',
    );
    writeBackupFixture(makeBundle({}, { includesConversations: false }));

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'ai_sessions')).toHaveLength(0);
    expect(rows(userDb, 'ai_messages')).toHaveLength(0);
  });

  it('restores conversations with topic items remapped to current ids', async () => {
    const userDb = await createUserDb(SHIFTED_CURRICULUM_ITEMS);
    writeBackupFixture(
      makeBundle(
        {
          aiSessions: [
            {
              id: 's1',
              provider: 'anthropic',
              model: 'claude-sonnet-5',
              mode: 'choose_grammar',
              topicItem: { itemType: 'vocabulary', slug: 'nichiyoubi' },
              topicItems: [{ itemType: 'vocabulary', slug: 'nichiyoubi' }],
              startedAt: '2026-08-01T00:00:00.000Z',
              endedAt: null,
              endedReason: null,
              turnCount: 1,
              summaryJson: JSON.stringify({
                wordsMet: [{ text: '日曜日', item: { itemType: 'vocabulary', slug: 'nichiyoubi' } }],
              }),
              summaryGeneratedAt: '2026-08-01T00:06:00.000Z',
            },
          ],
          aiMessages: [
            {
              id: 'm1',
              sessionId: 's1',
              role: 'user',
              content: 'hello',
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ],
        },
        { includesConversations: true },
      ),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    const sessions = rows(userDb, 'ai_sessions');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].topic_item_id).toBe('102');
    expect(sessions[0].topic_item_ids).toBe(JSON.stringify(['102']));
    expect(String(sessions[0].summary_json)).toContain('"itemId":"102"');
    expect(rows(userDb, 'ai_messages')).toHaveLength(1);
  });

  it('restores single-row tables with their CHECK(id = 1) primary key', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        streaks: [
          {
            currentStreak: 4,
            longestStreak: 10,
            lastReviewDate: '2026-08-01',
            lastCelebratedDate: null,
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        goalRingState: [
          {
            dailyGoalTarget: 25,
            goalWeekStart: '2026-07-27',
            consecutiveMissWeeks: 0,
            pendingRiseTo: null,
            pendingReductionTo: null,
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'streaks')).toEqual([
      {
        id: 1,
        current_streak: 4,
        longest_streak: 10,
        last_review_date: '2026-08-01',
        last_celebrated_date: null,
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ]);
    expect(rows(userDb, 'goal_ring_state')[0].id).toBe(1);
    expect(rows(userDb, 'goal_ring_state')[0].daily_goal_target).toBe(25);
  });

  it('restores grammar answers and sentence history on the current item id', async () => {
    const userDb = await createUserDb([...CURRICULUM_ITEMS, { id: 3, item_type: 'grammar', slug: 'kara-because' }]);
    const item = { itemType: 'grammar' as const, slug: 'kara-because' };
    writeBackupFixture(
      makeBundle({
        grammarAnswers: [{ item, sentenceKey: 'S1', answerText: 'A1', createdAt: '2026-10-13T00:00:00.000Z' }],
        grammarSentenceHistory: [{ item, sentenceKeys: ['S1', 'S2'], updatedAt: '2026-10-13T00:00:00.000Z' }],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'user_grammar_answers')).toEqual([
      { item_id: 3, sentence_key: 'S1', answer_text: 'A1', created_at: '2026-10-13T00:00:00.000Z' },
    ]);
    expect(rows(userDb, 'grammar_sentence_history')).toEqual([
      { item_id: 3, sentence_keys: '["S1","S2"]', updated_at: '2026-10-13T00:00:00.000Z' },
    ]);
  });

  it('writes furigana override item ids as TEXT', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        furiganaOverrides: [
          {
            item: { itemType: 'vocabulary', slug: 'nichiyoubi' },
            displayMode: 'shown',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'furigana_overrides')[0].item_id).toBe('2');
  });

  it('keeps this device curriculum install preferences across the replace', async () => {
    const userDb = await createUserDb();
    setPreference(userDb, 'installed_curriculum_version', '2.0.0');
    setPreference(userDb, 'installed_curriculum_content_hash', 'this-device-hash');
    setPreference(userDb, 'curriculum_update_source', 'downloaded');
    writeBackupFixture(
      makeBundle({
        userPreferences: [
          { key: 'installed_curriculum_version', value: '1.0.0', updatedAt: '2026-08-01T00:00:00.000Z' },
          { key: 'installed_curriculum_content_hash', value: 'other-device-hash', updatedAt: '2026-08-01T00:00:00.000Z' },
          { key: 'curriculum_update_source', value: 'bundled', updatedAt: '2026-08-01T00:00:00.000Z' },
          { key: 'theme_mode', value: 'dark', updatedAt: '2026-08-01T00:00:00.000Z' },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(getPreference(userDb, 'installed_curriculum_version')).toBe('2.0.0');
    expect(getPreference(userDb, 'installed_curriculum_content_hash')).toBe('this-device-hash');
    expect(getPreference(userDb, 'curriculum_update_source')).toBe('downloaded');
    // Learner preferences still come from the backup.
    expect(getPreference(userDb, 'theme_mode')).toBe('dark');
  });

  it('stamps last_backed_up_at from the file so a restored device is not "never backed up"', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(makeBundle({}, { exportedAt: '2026-08-09T10:00:00.000Z' }));

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(getPreference(userDb, 'last_backed_up_at')).toBe('2026-08-09T10:00:00.000Z');
  });

  it('keeps the backup completion flag on a Settings restore', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        userPreferences: [
          { key: 'onboarding_completed', value: 'true', updatedAt: '2026-08-01T00:00:00.000Z' },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(getPreference(userDb, 'onboarding_completed')).toBe('true');
  });

  it('forces onboarding back open on an onboarding restore', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        userPreferences: [
          { key: 'onboarding_completed', value: 'true', updatedAt: '2026-08-01T00:00:00.000Z' },
          { key: 'onboarding_path', value: 'beginner', updatedAt: '2026-08-01T00:00:00.000Z' },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'onboarding').ok).toBe(true);

    expect(getPreference(userDb, 'onboarding_completed')).toBeNull();
    expect(getPreference(userDb, 'onboarding_path')).toBe('import');
  });

  it('skips passage results whose passage or question is not in this curriculum', async () => {
    const userDb = await createUserDb();
    userDb.execSync('CREATE TABLE IF NOT EXISTS reading_passages (id)');
    userDb.execSync('CREATE TABLE IF NOT EXISTS passage_questions (id)');
    userDb.runSync('INSERT INTO reading_passages (id) VALUES (?)', 7);
    userDb.runSync('INSERT INTO passage_questions (id) VALUES (?)', 70);
    writeBackupFixture(
      makeBundle({
        passagePracticeResults: [
          { passageId: '7', questionId: '70', isCorrect: true, userAnswer: 'a', answeredAt: '2026-08-01T00:00:00.000Z' },
          { passageId: '999', questionId: '9990', isCorrect: false, userAnswer: 'b', answeredAt: '2026-08-01T00:00:00.000Z' },
        ],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(preview.summary.unmatchedPassageCount).toBe(1);

    const result = restoreBackup(userDb, preview, 'settings');
    expect(result.ok).toBe(true);

    const practice = rows(userDb, 'passage_practice_results');
    expect(practice).toHaveLength(1);
    expect(practice[0].passage_id).toBe(7);
  });

  it('never writes schema_migrations', async () => {
    const userDb = await createUserDb();
    const before = rows(userDb, 'schema_migrations').length;
    writeBackupFixture(makeBundle({}, { schemaVersion: 5 }));

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'schema_migrations')).toHaveLength(before);
  });

  it('restores an older schema and leaves newer tables empty', async () => {
    const userDb = await createUserDb();
    userDb.runSync('INSERT INTO card_seen (card_id, seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING',
      'goal-overshoot', '2026-08-01T00:00:00.000Z');
    // A pre-019 export has no card_seen rows at all.
    writeBackupFixture(
      makeBundle({ itemStudyStatus: [
        { item: { itemType: 'kanji', slug: 'sun' }, status: 'known', updatedAt: '2026-08-01T00:00:00.000Z' },
      ] }, { schemaVersion: 18 }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'card_seen')).toHaveLength(0);
    expect(rows(userDb, 'item_study_status')).toHaveLength(1);
  });

  it('leaves prior progress intact when the restore write throws', async () => {
    const userDb = await createUserDb();
    userDb.runSync(
      `INSERT INTO srs_states (item_id, stability, difficulty, due_date, fsrs_state, reps, lapses,
         learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      1, 1, 1, '2026-08-01T00:00:00.000Z', 'review', 1, 0, 0, 0, 'apprentice', null,
      '2026-08-01T00:00:00.000Z',
    );
    setPreference(userDb, 'theme_mode', 'light');
    writeBackupFixture(
      makeBundle({ srsStates: [srsRow('nichiyoubi', 'vocabulary', '2026-08-05T00:00:00.000Z')] }),
    );

    const preview = await previewOrThrow(userDb);
    const realRunSync = userDb.runSync.bind(userDb);
    let insertCount = 0;
    jest.spyOn(userDb, 'runSync').mockImplementation(((sql: string, ...params: never[]) => {
      if (/^INSERT INTO srs_states/i.test(sql.trim())) {
        insertCount += 1;
        throw new Error('disk full');
      }
      return realRunSync(sql, ...params);
    }) as typeof userDb.runSync);

    const result = restoreBackup(userDb, preview, 'settings');

    expect(insertCount).toBe(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_RESTORE_FAILED');
    expect(result.error.userMessage).toBe(
      'Restore could not be saved. Your previous progress was not changed.',
    );

    jest.restoreAllMocks();
    expect(rows(userDb, 'srs_states')).toHaveLength(1);
    expect(rows(userDb, 'srs_states')[0].item_id).toBe(1);
    expect(getPreference(userDb, 'theme_mode')).toBe('light');
  });

  it('never touches secure storage', async () => {
    const userDb = await createUserDb();
    await SecureStore.setItemAsync('byok_openai_api_key', 'sk-super-secret-value');
    const setSpy = jest.spyOn(SecureStore, 'setItemAsync');
    const deleteSpy = jest.spyOn(SecureStore, 'deleteItemAsync');
    writeBackupFixture(makeBundle());

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(setSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync('byok_openai_api_key')).toBe('sk-super-secret-value');

    setSpy.mockRestore();
    deleteSpy.mockRestore();
  });

  it('notifies furigana override subscribers after a successful restore', async () => {
    const userDb = await createUserDb();
    writeBackupFixture(
      makeBundle({
        srsStates: [srsRow('sun', 'kanji', '2026-08-05T00:00:00.000Z')],
      }),
    );
    const listener = jest.fn();
    const unsubscribe = subscribeFuriganaOverrides(listener);

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});

describe('export → restore round trip', () => {
  beforeEach(() => {
    __mockResetSqlite();
    resetMockFileSystem();
  });

  it('rebuilds progress and preferences on a wiped device', async () => {
    const sourceDb = await createUserDb();
    setPreference(sourceDb, 'theme_mode', 'dark');
    setPreference(sourceDb, 'session_intensity', 'standard');
    sourceDb.runSync(
      'INSERT INTO item_study_status (item_id, status, updated_at) VALUES (?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET status = excluded.status',
      2, 'known', '2026-08-01T00:00:00.000Z',
    );
    sourceDb.runSync(
      `INSERT INTO srs_states (item_id, stability, difficulty, due_date, fsrs_state, reps, lapses,
         learning_steps, is_burned, srs_stage_label, last_reviewed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      1, 2.5, 4.1, '2026-08-05T00:00:00.000Z', 'review', 3, 0, 0, 0, 'guru',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
    );

    const exported = await exportBackup(sourceDb);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(getMockFileContents(exported.value.fileUri)).toBeDefined();

    // A fresh device: same slugs, different curriculum row ids.
    __mockResetSqlite();
    const targetDb = await createUserDb(SHIFTED_CURRICULUM_ITEMS);

    const preview = await previewOrThrow(targetDb, exported.value.fileUri);
    expect(preview.summary.unmatchedSlugCount).toBe(0);
    expect(restoreBackup(targetDb, preview, 'settings').ok).toBe(true);

    expect(getPreference(targetDb, 'theme_mode')).toBe('dark');
    expect(getPreference(targetDb, 'session_intensity')).toBe('standard');

    const studyStatus = rows(targetDb, 'item_study_status');
    expect(studyStatus).toHaveLength(1);
    expect(studyStatus[0].item_id).toBe(102);

    const srsStates = rows(targetDb, 'srs_states');
    expect(srsStates).toHaveLength(1);
    expect(srsStates[0].item_id).toBe(101);
    expect(srsStates[0].stability).toBe(2.5);
    expect(srsStates[0].due_date).toBe('2026-08-05T00:00:00.000Z');
    expect(srsStates[0].srs_stage_label).toBe('guru');
  });
});
