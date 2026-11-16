import { Platform } from 'react-native';

import { withSyncTransaction } from '@/data/sync/syncTransaction';
import { openTestUserDb } from '@/test-support/sqliteTestDb';

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('withSyncTransaction', () => {
  afterEach(() => setPlatform('ios'));

  it('withSyncTransaction uses withTransactionAsync on web and the exclusive form on native', async () => {
    for (const os of ['web', 'ios', 'android'] as const) {
      setPlatform(os);
      const db = await openTestUserDb();
      const plain = jest.spyOn(db, 'withTransactionAsync');
      const exclusive = jest.spyOn(db, 'withExclusiveTransactionAsync');

      await withSyncTransaction(db, async (tx) => {
        await tx.runAsync('INSERT INTO card_seen (card_id, seen_at) VALUES (?, ?)', os, 'now');
      });

      expect(plain).toHaveBeenCalledTimes(os === 'web' ? 1 : 0);
      expect(exclusive).toHaveBeenCalledTimes(os === 'web' ? 0 : 1);
      expect(await db.getAllAsync('SELECT card_id FROM card_seen')).toEqual([{ card_id: os }]);
    }
  });
});
