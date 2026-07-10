import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSecureStore } from '../../../__mocks__/expo-secure-store';
import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { saveImportCredential, getImportCredential } from '@/data/user/credentialStore';
import {
  confirmCredentialedImport,
  confirmImport,
  countImportMetadataRows,
  countSrsStates,
  persistMappedImportItems,
  previewAnkiImport,
  previewBunproImport,
  previewWaniKaniImport,
  runAnkiImport,
  runBunproImport,
  runWaniKaniImport,
} from '@/data/user/importRepository';
import type { MappedImportItem } from '@/core/import/import.types';

describe('importRepository', () => {
  const apiKey = 'wk-test-api-key-12345';
  const bunproToken = 'bunpro-frontend-token-test';

  beforeEach(() => {
    __mockResetSqlite();
    __mockResetSecureStore();
  });

  async function createDatabases() {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db');
    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration002ItemStudyStatus,
      migration003SrsStatesAndImportMetadata,
    ]);
    expect(migrationResult.ok).toBe(true);
    return { userDb, curriculumDb };
  }

  function buildMappedItem(itemId: string, burned = false): MappedImportItem {
    return {
      itemId,
      externalId: itemId,
      srsStage: burned ? 9 : 2,
      srsStageName: burned ? 'burned' : 'apprentice',
      fsrsState: {
        stability: burned ? 365 : 1,
        difficulty: burned ? 2 : 5,
        dueDate: '2026-06-15T12:00:00.000Z',
        state: burned ? 'review' : 'learning',
        reps: burned ? 5 : 2,
        lapses: 0,
        learningSteps: 0,
        isBurned: burned,
        srsStageLabel: burned ? 'burned' : 'apprentice',
      },
    };
  }

  it('persists mapped items and import metadata in one transaction', async () => {
    const { userDb } = await createDatabases();
    const mapped = [buildMappedItem('1'), buildMappedItem('2', true)];

    const result = persistMappedImportItems(userDb, mapped, {
      source: 'wanikani',
      mappedCount: 2,
      unmatchedCount: 1,
      burnedCount: 1,
      apprenticeCount: 1,
    });

    expect(result.ok).toBe(true);
    expect(countSrsStates(userDb)).toBe(2);
    expect(countImportMetadataRows(userDb)).toBe(1);
  });

  it('rolls back partial writes when persistence fails mid-transaction', async () => {
    const { userDb } = await createDatabases();
    const mapped = [buildMappedItem('1'), buildMappedItem('2')];

    const result = persistMappedImportItems(userDb, mapped, {
      source: 'wanikani',
      mappedCount: 2,
      unmatchedCount: 0,
      burnedCount: 0,
      apprenticeCount: 2,
    }, {
      onBeforeInsert: (_item, index) => {
        if (index === 1) {
          throw new Error('simulated write failure');
        }
      },
    });

    expect(result.ok).toBe(false);
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);
  });

  it('runs WaniKani import end-to-end and discards the credential', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('wanikani', apiKey);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'wanikani',
      '42',
      1,
    );
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'wanikani',
      '43',
      2,
    );

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'RateLimit-Remaining': '59',
      }),
      json: async () => ({
        object: 'collection',
        pages: { next_url: null },
        data: [
          {
            object: 'assignment',
            data: {
              id: 1,
              subject_id: 42,
              srs_stage: 2,
              srs_stage_name: 'apprentice',
              burned_at: null,
            },
          },
          {
            object: 'assignment',
            data: {
              id: 2,
              subject_id: 43,
              srs_stage: 9,
              srs_stage_name: 'burned',
              burned_at: '2026-01-01T00:00:00.000Z',
            },
          },
          {
            object: 'assignment',
            data: {
              id: 3,
              subject_id: 999,
              srs_stage: 4,
              srs_stage_name: 'apprentice',
              burned_at: null,
            },
          },
        ],
      }),
    });

    const result = await runWaniKaniImport(userDb, curriculumDb, { fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mappedCount).toBe(2);
      expect(result.value.unmatchedCount).toBe(1);
      expect(result.value.burnedCount).toBe(1);
      expect(result.value.apprenticeCount).toBe(1);
    }

    expect(countSrsStates(userDb)).toBe(2);
    expect(countImportMetadataRows(userDb)).toBe(1);

    const credentialResult = await getImportCredential('wanikani');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBeNull();
    }
  });

  it('runs Bunpro import end-to-end and discards the credential', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('bunpro', bunproToken);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'bunpro',
      '42',
      1,
    );
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'bunpro',
      '43',
      2,
    );

    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 42, srs_stage: 2, srs_stage_name: 'apprentice' }],
            meta: { next_page: null },
          }),
        });
      }
      if (url.includes('burned')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 43, srs_stage: 9, srs_stage_name: 'burned' }],
            meta: { next_page: null },
          }),
        });
      }
      if (url.includes('apprentice_2')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 999, srs_stage: 4, srs_stage_name: 'apprentice' }],
            meta: { next_page: null },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { next_page: null } }),
      });
    });

    const result = await runBunproImport(userDb, curriculumDb, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe('bunpro');
      expect(result.value.mappedCount).toBe(2);
      expect(result.value.unmatchedCount).toBe(1);
      expect(result.value.burnedCount).toBe(1);
      expect(result.value.apprenticeCount).toBe(1);
    }

    expect(countSrsStates(userDb)).toBe(2);
    expect(countImportMetadataRows(userDb)).toBe(1);

    const credentialResult = await getImportCredential('bunpro');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBeNull();
    }
  });

  it('does not persist or discard credential when Bunpro fetch fails', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('bunpro', bunproToken);

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const result = await runBunproImport(userDb, curriculumDb, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);

    const credentialResult = await getImportCredential('bunpro');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBe(bunproToken);
    }
  });

  it('does not persist or discard credential when Bunpro returns no grammar data', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('bunpro', bunproToken);

    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { next_page: null } }),
    });

    const result = await runBunproImport(userDb, curriculumDb, { fetchImpl, sleep });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('bunpro_no_grammar_data');
    }
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);

    const credentialResult = await getImportCredential('bunpro');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBe(bunproToken);
    }
  });

  it('includes a warning when Bunpro import is partial', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('bunpro', bunproToken);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'bunpro',
      '42',
      1,
    );

    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 42, srs_stage: 2, srs_stage_name: 'apprentice' }],
            meta: { next_page: null },
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
    });

    const result = await runBunproImport(userDb, curriculumDb, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mappedCount).toBe(1);
      expect(result.value.warningMessage).toContain('partial Bunpro progress');
    }
  });

  it('does not persist or discard credential when Bunpro import persistence fails', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('bunpro', bunproToken);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'bunpro',
      '42',
      0,
    );

    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 42, srs_stage: 2, srs_stage_name: 'apprentice' }],
            meta: { next_page: null },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { next_page: null } }),
      });
    });

    const result = await runBunproImport(userDb, curriculumDb, { fetchImpl, sleep });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('import_persist_failed');
    }
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);

    const credentialResult = await getImportCredential('bunpro');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBe(bunproToken);
    }
  });

  it('runs Anki import end-to-end from a parsed deck file', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'anki',
      '水',
      1,
    );
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'anki',
      '火',
      2,
    );

    const deletedPaths: string[] = [];
    const result = await runAnkiImport(userDb, curriculumDb, 'file:///mock/deck.apkg', {
      readFileBase64: async () => 'ZmFrZQ==',
      makeTempDir: () => 'file:///mock/anki-temp/',
      unzipArchive: async () => ({ ok: true, value: ['collection.anki21'] }),
      queryCollectionDatabase: async () => ({
        ok: true,
        value: {
          notes: [
            {
              id: 1,
              guid: 'n1',
              mid: 1,
              flds: '水',
              sfld: '水',
              tags: '',
            },
            {
              id: 2,
              guid: 'n2',
              mid: 1,
              flds: '火',
              sfld: '火',
              tags: '',
            },
            {
              id: 3,
              guid: 'n3',
              mid: 1,
              flds: '木',
              sfld: '木',
              tags: '',
            },
          ],
          cards: [
            {
              id: 10,
              nid: 1,
              did: 1,
              ivl: 7,
              factor: 2500,
              reps: 4,
              lapses: 0,
              queue: 2,
              type: 2,
            },
            {
              id: 11,
              nid: 2,
              did: 1,
              ivl: 30,
              factor: 2500,
              reps: 6,
              lapses: 0,
              queue: 2,
              type: 2,
            },
            {
              id: 12,
              nid: 3,
              did: 1,
              ivl: 3,
              factor: 2500,
              reps: 2,
              lapses: 0,
              queue: 2,
              type: 2,
            },
          ],
          decksJson: JSON.stringify({ '1': { name: 'Core' } }),
        },
      }),
      deletePath: async (uri) => {
        deletedPaths.push(uri);
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe('anki');
      expect(result.value.mappedCount).toBe(2);
      expect(result.value.unmatchedCount).toBe(1);
    }

    expect(countSrsStates(userDb)).toBe(2);
    expect(countImportMetadataRows(userDb)).toBe(1);
    expect(deletedPaths).toContain('file:///mock/deck.apkg');
  });

  it('does not persist Anki import state when parsing fails', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    const result = await runAnkiImport(userDb, curriculumDb, 'file:///mock/bad.apkg', {
      readFileBase64: async () => 'bad',
      makeTempDir: () => 'file:///mock/anki-temp/',
      unzipArchive: async () => ({
        ok: false,
        error: {
          code: 'anki_invalid_file',
          message: 'Failed to extract Anki archive',
          userMessage:
            "This file doesn't appear to be a valid Anki deck. Make sure you're selecting an .apkg file exported from Anki.",
        },
      }),
      deletePath: async () => undefined,
    });

    expect(result.ok).toBe(false);
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);
  });

  it('rolls back Anki import when persistence fails', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'anki',
      '水',
      0,
    );

    const result = await runAnkiImport(userDb, curriculumDb, 'file:///mock/deck.apkg', {
      readFileBase64: async () => 'ZmFrZQ==',
      makeTempDir: () => 'file:///mock/anki-temp/',
      unzipArchive: async () => ({ ok: true, value: ['collection.anki21'] }),
      queryCollectionDatabase: async () => ({
        ok: true,
        value: {
          notes: [
            {
              id: 1,
              guid: 'n1',
              mid: 1,
              flds: '水',
              sfld: '水',
              tags: '',
            },
          ],
          cards: [
            {
              id: 10,
              nid: 1,
              did: 1,
              ivl: 7,
              factor: 2500,
              reps: 4,
              lapses: 0,
              queue: 2,
              type: 2,
            },
          ],
          decksJson: null,
        },
      }),
      deletePath: async () => undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('import_persist_failed');
    }
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);
  });

  it('previewWaniKaniImport returns mapped data without writing to user.db', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('wanikani', apiKey);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'wanikani',
      '42',
      1,
    );

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'RateLimit-Remaining': '59' }),
      json: async () => ({
        object: 'collection',
        pages: { next_url: null },
        data: [
          {
            object: 'assignment',
            data: {
              id: 1,
              subject_id: 42,
              srs_stage: 2,
              srs_stage_name: 'apprentice',
              burned_at: null,
            },
          },
          {
            object: 'assignment',
            data: {
              id: 2,
              subject_id: 999,
              srs_stage: 4,
              srs_stage_name: 'apprentice',
              burned_at: null,
            },
          },
        ],
      }),
    });

    const result = await previewWaniKaniImport(curriculumDb, { fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe('wanikani');
      expect(result.value.mapped).toHaveLength(1);
      expect(result.value.unmatched).toHaveLength(1);
      expect(result.value.summary.mappedCount).toBe(1);
    }

    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);

    const credentialResult = await getImportCredential('wanikani');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBe(apiKey);
    }
  });

  it('confirmImport persists preview data and confirmCredentialedImport discards credential', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('wanikani', apiKey);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'wanikani',
      '42',
      1,
    );

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'RateLimit-Remaining': '59' }),
      json: async () => ({
        object: 'collection',
        pages: { next_url: null },
        data: [
          {
            object: 'assignment',
            data: {
              id: 1,
              subject_id: 42,
              srs_stage: 2,
              srs_stage_name: 'apprentice',
              burned_at: null,
            },
          },
        ],
      }),
    });

    const previewResult = await previewWaniKaniImport(curriculumDb, { fetchImpl });
    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) {
      return;
    }

    expect(countSrsStates(userDb)).toBe(0);

    const confirmResult = await confirmCredentialedImport(userDb, previewResult.value);
    expect(confirmResult.ok).toBe(true);
    expect(countSrsStates(userDb)).toBe(1);
    expect(countImportMetadataRows(userDb)).toBe(1);

    const credentialResult = await getImportCredential('wanikani');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBeNull();
    }
  });

  it('previewBunproImport does not write to user.db or discard credential', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    await saveImportCredential('bunpro', bunproToken);
    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'bunpro',
      '42',
      1,
    );

    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 42, srs_stage: 2, srs_stage_name: 'apprentice' }],
            meta: { next_page: null },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { next_page: null } }),
      });
    });

    const result = await previewBunproImport(curriculumDb, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);

    const credentialResult = await getImportCredential('bunpro');
    expect(credentialResult.ok).toBe(true);
    if (credentialResult.ok) {
      expect(credentialResult.value).toBe(bunproToken);
    }
  });

  it('previewAnkiImport returns mapped data without persisting', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    curriculumDb.runSync(
      'INSERT INTO external_id_mappings (source, external_id, item_id) VALUES (?, ?, ?)',
      'anki',
      '水',
      1,
    );

    const result = await previewAnkiImport(curriculumDb, 'file:///mock/deck.apkg', {
      readFileBase64: async () => 'ZmFrZQ==',
      makeTempDir: () => 'file:///mock/anki-temp/',
      unzipArchive: async () => ({ ok: true, value: ['collection.anki21'] }),
      queryCollectionDatabase: async () => ({
        ok: true,
        value: {
          notes: [
            {
              id: 1,
              guid: 'n1',
              mid: 1,
              flds: '水',
              sfld: '水',
              tags: '',
            },
          ],
          cards: [
            {
              id: 10,
              nid: 1,
              did: 1,
              ivl: 7,
              factor: 2500,
              reps: 4,
              lapses: 0,
              queue: 2,
              type: 2,
            },
          ],
          decksJson: JSON.stringify({ '1': { name: 'Core' } }),
        },
      }),
      deletePath: async () => undefined,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.mappedCount).toBe(1);
    }

    expect(countSrsStates(userDb)).toBe(0);
    expect(countImportMetadataRows(userDb)).toBe(0);
  });

  it('confirmImport persists Anki preview without discarding credentials', async () => {
    const { userDb } = await createDatabases();
    const mapped = [buildMappedItem('1')];

    const preview = {
      source: 'anki' as const,
      mapped,
      unmatched: [],
      summary: {
        source: 'anki' as const,
        mappedCount: 1,
        unmatchedCount: 0,
        burnedCount: 0,
        apprenticeCount: 1,
      },
    };

    const result = confirmImport(userDb, preview);
    expect(result.ok).toBe(true);
    expect(countSrsStates(userDb)).toBe(1);
    expect(countImportMetadataRows(userDb)).toBe(1);
  });
});
