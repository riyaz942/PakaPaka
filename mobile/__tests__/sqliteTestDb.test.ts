import { migrations } from '@/data/migrations';
import { openTestUserDb } from '@/test-support/sqliteTestDb';

describe('sqliteTestDb', () => {
  it('sqliteTestDb applies all migrations and rolls back a failed transaction', async () => {
    const db = await openTestUserDb();

    const applied = await db.getFirstAsync<{ maxVersion: number }>(
      'SELECT MAX(version) AS maxVersion FROM schema_migrations',
    );
    expect(applied?.maxVersion).toBe(migrations.length);

    await expect(
      db.withTransactionAsync(async () => {
        await db.runAsync(
          'INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)',
          'session_intensity',
          'standard',
          'now',
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await db.getAllAsync('SELECT * FROM user_preferences')).toEqual([]);
  });
});
