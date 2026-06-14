import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSecureStore } from '../../../__mocks__/expo-secure-store';
import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { saveImportCredential, getImportCredential } from '@/data/user/credentialStore';
import {
  countImportMetadataRows,
  countSrsStates,
  persistMappedImportItems,
  runWaniKaniImport,
} from '@/data/user/importRepository';
import type { MappedImportItem } from '@/core/import/import.types';

describe('importRepository', () => {
  const apiKey = 'wk-test-api-key-12345';

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
});
