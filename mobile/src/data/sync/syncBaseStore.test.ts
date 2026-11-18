import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';
import {
  clearSyncBase,
  markPendingReplace,
  readSyncBase,
  readSyncStatus,
  writeSyncBase,
  writeSyncError,
} from '@/data/sync/syncBaseStore';
import { openTestUserDb } from '@/test-support/sqliteTestDb';

const SYNCED_AT = '2026-11-16T10:00:00.000Z';

describe('sync base store', () => {
  it('write then read round-trips', async () => {
    const db = await openTestUserDb();

    await writeSyncBase(db, { revision: 4, data: fullSampleData(), carried: {} }, SYNCED_AT);

    expect(await readSyncBase(db)).toEqual({
      ok: true,
      value: { revision: 4, data: fullSampleData(), pendingReplace: false, carried: {} },
    });
    expect(await readSyncStatus(db)).toEqual({
      ok: true,
      value: { lastSyncedAt: SYNCED_AT, lastErrorCode: null },
    });
  });

  it('carried keys round-trip', async () => {
    const db = await openTestUserDb();
    const carried = { srsStates: ['vocabulary:inu', 'vocabulary:neko'], cardSeen: ['welcome'] };

    await writeSyncBase(db, { revision: 2, data: fullSampleData(), carried }, SYNCED_AT);
    const written = await readSyncBase(db);
    expect(written.ok && written.value?.carried).toEqual(carried);

    expect((await markPendingReplace(db, emptySyncData(), { cardSeen: ['other'] })).ok).toBe(true);
    const marked = await readSyncBase(db);
    expect(marked.ok && marked.value?.carried).toEqual({ cardSeen: ['other'] });
  });

  it('markPendingReplace keeps the revision and sets the flag', async () => {
    const db = await openTestUserDb();
    await writeSyncBase(db, { revision: 7, data: emptySyncData(), carried: {} }, SYNCED_AT);

    expect(await markPendingReplace(db, fullSampleData(), {})).toEqual({ ok: true, value: undefined });

    expect(await readSyncBase(db)).toEqual({
      ok: true,
      value: { revision: 7, data: fullSampleData(), pendingReplace: true, carried: {} },
    });
  });

  it('markPendingReplace with no row starts at revision 0', async () => {
    const db = await openTestUserDb();

    expect((await markPendingReplace(db, fullSampleData(), {})).ok).toBe(true);

    expect(await readSyncBase(db)).toEqual({
      ok: true,
      value: { revision: 0, data: fullSampleData(), pendingReplace: true, carried: {} },
    });
  });

  it('writeSyncBase clears the flag and the error', async () => {
    const db = await openTestUserDb();
    await writeSyncBase(db, { revision: 1, data: emptySyncData(), carried: {} }, SYNCED_AT);
    await markPendingReplace(db, fullSampleData(), {});
    expect((await writeSyncError(db, 'sync_bad_file')).ok).toBe(true);
    expect(await readSyncStatus(db)).toEqual({
      ok: true,
      value: { lastSyncedAt: SYNCED_AT, lastErrorCode: 'sync_bad_file' },
    });

    await writeSyncBase(db, { revision: 2, data: fullSampleData(), carried: {} }, null);

    expect(await readSyncBase(db)).toEqual({
      ok: true,
      value: { revision: 2, data: fullSampleData(), pendingReplace: false, carried: {} },
    });
    // `syncedAt === null` keeps the last sync time.
    expect(await readSyncStatus(db)).toEqual({
      ok: true,
      value: { lastSyncedAt: SYNCED_AT, lastErrorCode: null },
    });
  });

  it('writeSyncError with no row records the error and no base', async () => {
    const db = await openTestUserDb();

    expect((await writeSyncError(db, 'sync_busy')).ok).toBe(true);

    expect(await readSyncStatus(db)).toEqual({
      ok: true,
      value: { lastSyncedAt: null, lastErrorCode: 'sync_busy' },
    });
    expect(await readSyncBase(db)).toEqual({ ok: true, value: null });
  });

  it('clearSyncBase removes the row', async () => {
    const db = await openTestUserDb();
    await writeSyncBase(db, { revision: 3, data: fullSampleData(), carried: {} }, SYNCED_AT);

    expect(await clearSyncBase(db)).toEqual({ ok: true, value: undefined });

    expect(await db.getAllAsync('SELECT * FROM sync_base')).toEqual([]);
    expect(await readSyncBase(db)).toEqual({ ok: true, value: null });
    expect(await readSyncStatus(db)).toEqual({
      ok: true,
      value: { lastSyncedAt: null, lastErrorCode: null },
    });
  });

  it('readSyncBase with data_json NULL → null', async () => {
    const db = await openTestUserDb();
    await db.runAsync('INSERT INTO sync_base (id, revision, data_json) VALUES (1, 5, NULL)');

    expect(await readSyncBase(db)).toEqual({ ok: true, value: null });
  });

  it('returns sync_local_failed when the database fails', async () => {
    const db = await openTestUserDb();
    jest.spyOn(db, 'getFirstAsync').mockRejectedValue(new Error('disk I/O error'));

    const result = await readSyncBase(db);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_local_failed');
  });
});
