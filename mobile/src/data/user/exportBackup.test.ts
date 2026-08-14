import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as pako from 'pako';

import { parseBackupBundle } from '@/core/backup/backupSerializer';
import { buildItemRefToIdMap, resolveItemRefToId } from '@/core/backup/slugResolver';
import { exportBackup } from '@/data/user/exportBackup';
import { getMockFileStore, resetMockFileSystem } from '@/test-support/file-system-test-state';

// The shared hand-rolled expo-sqlite mock (mobile/__mocks__/expo-sqlite.ts) has
// no `ATTACH DATABASE` / cross-schema table support, so it can't simulate the
// `curriculum.items` join exportBackup issues (see furiganaOverrideRepository.test.ts
// and masteryRepository.test.ts for the same constraint). A routing fake db verifies
// the SQL shape and the row -> bundle mapping instead.
type TableRows = Record<string, unknown[]>;

function fakeUserDb(options: {
  curriculumItems?: { id: number | string; item_type: string; slug: string }[];
  curriculumVersion?: string | null;
  schemaVersion?: number | null;
  tables?: TableRows;
} = {}): SQLiteDatabase {
  const tables = options.tables ?? {};

  const tableMatchers: [RegExp, unknown[]][] = [
    [/FROM curriculum\.items/i, options.curriculumItems ?? []],
    [/FROM user_preferences/i, tables.user_preferences ?? []],
    [/FROM item_study_status/i, tables.item_study_status ?? []],
    [/FROM srs_states/i, tables.srs_states ?? []],
    [/FROM import_metadata/i, tables.import_metadata ?? []],
    [/FROM personal_mnemonics/i, tables.personal_mnemonics ?? []],
    [/FROM related_item_boosts/i, tables.related_item_boosts ?? []],
    [/FROM weakness_stats/i, tables.weakness_stats ?? []],
    [/FROM cognitive_load_history/i, tables.cognitive_load_history ?? []],
    [/FROM streaks/i, tables.streaks ?? []],
    [/FROM user_synonyms/i, tables.user_synonyms ?? []],
    [/FROM daily_lesson_log/i, tables.daily_lesson_log ?? []],
    [/FROM goal_ring_state/i, tables.goal_ring_state ?? []],
    [/FROM furigana_overrides/i, tables.furigana_overrides ?? []],
    [/FROM card_seen/i, tables.card_seen ?? []],
    [/FROM passage_practice_results/i, tables.passage_practice_results ?? []],
    [/FROM ai_sessions/i, tables.ai_sessions ?? []],
    [/FROM ai_messages/i, tables.ai_messages ?? []],
  ];

  return {
    getAllSync: jest.fn((sql: string) => {
      for (const [pattern, rows] of tableMatchers) {
        if (pattern.test(sql)) return rows;
      }
      return [];
    }),
    getFirstSync: jest.fn((sql: string) => {
      if (/FROM curriculum\.curriculum_metadata/i.test(sql)) {
        return options.curriculumVersion === undefined
          ? null
          : { version: options.curriculumVersion };
      }
      if (/MAX\(version\)/i.test(sql)) {
        return { maxVersion: options.schemaVersion ?? null };
      }
      return null;
    }),
    withTransactionSync: jest.fn((task: () => void) => {
      task();
    }),
  } as unknown as SQLiteDatabase;
}

async function readWrittenJson(fileUri: string): Promise<string> {
  const base64 = getMockFileStore().get(fileUri);
  if (!base64) throw new Error(`No file written at ${fileUri}`);
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return pako.ungzip(bytes, { to: 'string' });
}

const CURRICULUM_ITEMS = [
  { id: 1, item_type: 'kanji', slug: 'sun' },
  { id: 2, item_type: 'vocabulary', slug: 'nichiyoubi' },
];

const SHIFTED_CURRICULUM = [
  { id: 101, itemType: 'kanji' as const, slug: 'sun' },
  { id: 102, itemType: 'vocabulary' as const, slug: 'nichiyoubi' },
];

describe('exportBackup', () => {
  beforeEach(() => {
    resetMockFileSystem();
  });

  it('writes a gzipped .json.gz envelope that parseBackupBundle accepts', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      curriculumVersion: '1.4.0',
      schemaVersion: 19,
      tables: {
        item_study_status: [{ item_id: 1, status: 'in_progress', updated_at: '2026-08-01T00:00:00.000Z' }],
        srs_states: [
          {
            item_id: 1,
            stability: 2.5,
            difficulty: 4.1,
            due_date: '2026-08-05T00:00:00.000Z',
            fsrs_state: 'review',
            reps: 3,
            lapses: 0,
            learning_steps: 0,
            is_burned: 0,
            srs_stage_label: 'guru',
            last_reviewed_at: '2026-08-01T00:00:00.000Z',
            updated_at: '2026-08-01T00:00:00.000Z',
          },
        ],
        user_preferences: [{ key: 'theme_mode', value: 'dark', updated_at: '2026-08-01T00:00:00.000Z' }],
        streaks: [
          {
            current_streak: 4,
            longest_streak: 10,
            last_review_date: '2026-08-01',
            last_celebrated_date: null,
            updated_at: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
    });

    const result = await exportBackup(db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.fileUri.endsWith('.json.gz')).toBe(true);
    expect(result.value.fileUri).toMatch(/kizamu-backup-\d{4}-\d{2}-\d{2}T/);
    expect(result.value.byteSize).toBeGreaterThan(0);
    expect(result.value.itemCount).toBe(4);
    expect(result.value.omittedCount).toBe(0);

    const json = await readWrittenJson(result.value.fileUri);
    const parsed = parseBackupBundle(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.format).toBe('kizamu-backup');
    expect(parsed.value.formatVersion).toBe(1);
    expect(parsed.value.schemaVersion).toBe(19);
    expect(parsed.value.curriculumVersion).toBe('1.4.0');
    expect(parsed.value.includesConversations).toBe(false);
    expect(parsed.value.data.itemStudyStatus).toEqual([
      { item: { itemType: 'kanji', slug: 'sun' }, status: 'in_progress', updatedAt: '2026-08-01T00:00:00.000Z' },
    ]);
    expect(parsed.value.data.srsStates[0].item).toEqual({ itemType: 'kanji', slug: 'sun' });
    expect(parsed.value.data.srsStates[0]).not.toHaveProperty('itemId');
    expect(parsed.value.data.userPreferences).toHaveLength(1);
    expect(parsed.value.data.streaks[0].currentStreak).toBe(4);
  });

  it('slug-resolves progress so a shifted-id curriculum restore lands on the same item', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      tables: {
        item_study_status: [{ item_id: 1, status: 'known', updated_at: '2026-08-01T00:00:00.000Z' }],
      },
    });

    const result = await exportBackup(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const ref = parsed.value.data.itemStudyStatus[0].item;
    const restoredId = resolveItemRefToId(buildItemRefToIdMap(SHIFTED_CURRICULUM), ref);
    expect(restoredId).toBe(101);
    expect(restoredId).not.toBe(1);
  });

  it('resolves string sqlite ids the same as numeric ids', async () => {
    const db = fakeUserDb({
      curriculumItems: [{ id: '1', item_type: 'kanji', slug: 'sun' }],
      tables: {
        item_study_status: [{ item_id: '1', status: 'known', updated_at: '2026-08-01T00:00:00.000Z' }],
      },
    });

    const result = await exportBackup(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.data.itemStudyStatus[0].item.slug).toBe('sun');
    expect(result.value.omittedCount).toBe(0);
  });

  it('skips orphaned item_id rows and reports how many were omitted', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      tables: {
        item_study_status: [
          { item_id: 1, status: 'known', updated_at: '2026-08-01T00:00:00.000Z' },
          { item_id: 999, status: 'known', updated_at: '2026-08-01T00:00:00.000Z' },
        ],
      },
    });

    const result = await exportBackup(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.omittedCount).toBe(1);
    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.data.itemStudyStatus).toHaveLength(1);
    expect(parsed.value.data.itemStudyStatus[0].item.slug).toBe('sun');
  });

  it('fails when the curriculum item lookup is empty but progress rows exist', async () => {
    const db = fakeUserDb({
      curriculumItems: [],
      tables: {
        item_study_status: [{ item_id: 1, status: 'known', updated_at: '2026-08-01T00:00:00.000Z' }],
      },
    });

    const result = await exportBackup(db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_EXPORT_FAILED');
    expect(result.error.userMessage).toMatch(/curriculum/i);
  });

  it('excludes AI transcripts by default', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      tables: {
        ai_sessions: [
          {
            id: 's1',
            provider: 'anthropic',
            model: 'claude-sonnet-5',
            mode: 'random',
            topic_item_id: null,
            topic_item_ids: null,
            started_at: '2026-08-01T00:00:00.000Z',
            ended_at: null,
            ended_reason: null,
            turn_count: 1,
            summary_json: null,
            summary_generated_at: null,
          },
        ],
        ai_messages: [
          { id: 'm1', session_id: 's1', role: 'user', content: 'secret conversation', created_at: '2026-08-01T00:00:00.000Z' },
        ],
      },
    });

    const result = await exportBackup(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.includesConversations).toBe(false);
    expect(parsed.value.data.aiSessions).toEqual([]);
    expect(parsed.value.data.aiMessages).toEqual([]);
  });

  it('includes AI transcripts when explicitly opted in', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      tables: {
        ai_sessions: [
          {
            id: 's1',
            provider: 'anthropic',
            model: 'claude-sonnet-5',
            mode: 'choose_grammar',
            topic_item_id: '2',
            topic_item_ids: JSON.stringify(['2']),
            started_at: '2026-08-01T00:00:00.000Z',
            ended_at: '2026-08-01T00:05:00.000Z',
            ended_reason: 'user_end',
            turn_count: 1,
            summary_json: null,
            summary_generated_at: null,
          },
        ],
        ai_messages: [
          { id: 'm1', session_id: 's1', role: 'user', content: 'hello', created_at: '2026-08-01T00:00:00.000Z' },
        ],
      },
    });

    const result = await exportBackup(db, { includeConversations: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.includesConversations).toBe(true);
    expect(parsed.value.data.aiSessions).toHaveLength(1);
    expect(parsed.value.data.aiSessions[0].topicItem).toEqual({ itemType: 'vocabulary', slug: 'nichiyoubi' });
    expect(parsed.value.data.aiSessions[0].topicItems).toEqual([{ itemType: 'vocabulary', slug: 'nichiyoubi' }]);
    expect(parsed.value.data.aiMessages).toEqual([
      { id: 'm1', sessionId: 's1', role: 'user', content: 'hello', createdAt: '2026-08-01T00:00:00.000Z' },
    ]);
  });

  it('falls back to topic_item_id when topic_item_ids is null (pre-018 rows)', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      tables: {
        ai_sessions: [
          {
            id: 's1',
            provider: 'anthropic',
            model: 'claude-sonnet-5',
            mode: 'choose_grammar',
            topic_item_id: '2',
            topic_item_ids: null,
            started_at: '2026-08-01T00:00:00.000Z',
            ended_at: null,
            ended_reason: null,
            turn_count: 1,
            summary_json: null,
            summary_generated_at: null,
          },
        ],
      },
    });

    const result = await exportBackup(db, { includeConversations: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.data.aiSessions[0].topicItems).toEqual([
      { itemType: 'vocabulary', slug: 'nichiyoubi' },
    ]);
  });

  it('rewrites summaryJson wordsMet itemIds to slug refs', async () => {
    const db = fakeUserDb({
      curriculumItems: CURRICULUM_ITEMS,
      tables: {
        ai_sessions: [
          {
            id: 's1',
            provider: 'anthropic',
            model: 'claude-sonnet-5',
            mode: 'random',
            topic_item_id: null,
            topic_item_ids: null,
            started_at: '2026-08-01T00:00:00.000Z',
            ended_at: null,
            ended_reason: null,
            turn_count: 1,
            summary_json: JSON.stringify({
              mistakes: [],
              wordsMet: [{ text: '日曜日', itemId: '2' }, { text: 'ラーメン', itemId: null }],
              grammarNotes: [],
            }),
            summary_generated_at: '2026-08-01T00:06:00.000Z',
          },
        ],
      },
    });

    const result = await exportBackup(db, { includeConversations: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = await readWrittenJson(result.value.fileUri);
    expect(json).not.toMatch(/"itemId":"2"/);
    const parsed = parseBackupBundle(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const summary = JSON.parse(parsed.value.data.aiSessions[0].summaryJson ?? '{}') as {
      wordsMet: { text: string; item?: { itemType: string; slug: string }; itemId?: string }[];
    };
    expect(summary.wordsMet[0]).toEqual({
      text: '日曜日',
      item: { itemType: 'vocabulary', slug: 'nichiyoubi' },
    });
    expect(summary.wordsMet[1]).toEqual({ text: 'ラーメン', itemId: null });
  });

  it('returns a userMessage when export throws', async () => {
    const db = {
      withTransactionSync: jest.fn(() => {
        throw new Error('disk full');
      }),
    } as unknown as SQLiteDatabase;

    const result = await exportBackup(db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.userMessage).toBe('Could not export your backup. Please try again.');
    expect(result.error.message).toBe('disk full');
  });

  it('never touches secure storage and never leaks a credential into the output', async () => {
    await SecureStore.setItemAsync('byok_openai_api_key', 'sk-super-secret-value');
    const getItemSpy = jest.spyOn(SecureStore, 'getItemAsync');

    const db = fakeUserDb({ curriculumItems: CURRICULUM_ITEMS });
    const result = await exportBackup(db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getItemSpy).not.toHaveBeenCalled();

    const base64 = getMockFileStore().get(result.value.fileUri);
    expect(base64).toBeDefined();
    expect(base64).not.toContain('sk-super-secret-value');

    const json = await readWrittenJson(result.value.fileUri);
    expect(json).not.toContain('sk-super-secret-value');

    getItemSpy.mockRestore();
  });
});
