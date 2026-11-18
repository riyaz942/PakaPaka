import { migrations } from '@/data/migrations';
import { migration022SyncBase } from '@/data/migrations/022_sync_base';
import { openTestUserDb } from '@/test-support/sqliteTestDb';

describe('022_sync_base', () => {
  it('claims version 22 and is registered in version order', () => {
    expect(migration022SyncBase.version).toBe(22);
    expect(migration022SyncBase.name).toBe('022_sync_base');
    expect(migrations[21]).toBe(migration022SyncBase);
  });

  it('022 creates sync_base with one allowed row', async () => {
    const db = await openTestUserDb();

    await db.runAsync('INSERT INTO sync_base (id) VALUES (1)');
    await expect(db.runAsync('INSERT INTO sync_base (id) VALUES (2)')).rejects.toThrow(
      /CHECK constraint failed/,
    );

    expect(await db.getAllAsync('SELECT * FROM sync_base')).toEqual([
      {
        id: 1,
        revision: 0,
        data_json: null,
        carried_keys_json: null,
        pending_replace: 0,
        last_synced_at: null,
        last_error_code: null,
      },
    ]);
  });
});
