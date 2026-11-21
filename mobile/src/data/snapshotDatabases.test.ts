import * as sqlite from 'expo-sqlite';

import { openSnapshotDatabases, serializeDatabases } from '@/data/snapshotDatabases';

const mockSqlite = sqlite as unknown as {
  openDatabaseAsync: (name: string) => Promise<sqlite.SQLiteDatabase>;
  deserializeDatabaseAsync: (data: Uint8Array) => Promise<sqlite.SQLiteDatabase>;
};

describe('snapshotDatabases', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializeDatabases returns both byte arrays', async () => {
    const curriculumDb = await mockSqlite.openDatabaseAsync('curriculum.db');
    const userDb = await mockSqlite.openDatabaseAsync('user.db');
    const curriculumBytes = await curriculumDb.serializeAsync('main');
    const userBytes = await userDb.serializeAsync('main');

    const result = await serializeDatabases({ curriculumDb, userDb });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.curriculum).toEqual(curriculumBytes);
    expect(result.value.user).toEqual(userBytes);
  });

  it('serializeDatabases returns DB_SNAPSHOT_SERIALIZE_ERROR when serialize fails', async () => {
    const curriculumDb = await mockSqlite.openDatabaseAsync('curriculum.db');
    const userDb = await mockSqlite.openDatabaseAsync('user.db');
    jest.spyOn(userDb, 'serializeAsync').mockRejectedValue(new Error('boom'));

    const result = await serializeDatabases({ curriculumDb, userDb });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_SNAPSHOT_SERIALIZE_ERROR');
  });

  it('openSnapshotDatabases attaches the curriculum copy to the user copy', async () => {
    const snapshot = { curriculum: new Uint8Array([1, 2]), user: new Uint8Array([3, 4]) };
    const opened: sqlite.SQLiteDatabase[] = [];
    const realDeserialize = mockSqlite.deserializeDatabaseAsync;
    const deserializeSpy = jest
      .spyOn(mockSqlite, 'deserializeDatabaseAsync')
      .mockImplementation(async (data) => {
        const db = await realDeserialize(data);
        jest.spyOn(db, 'execSync');
        jest.spyOn(db.nativeDatabase as any, 'deserializeIntoAsync');
        opened.push(db);
        return db;
      });

    const result = await openSnapshotDatabases(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deserializeSpy).toHaveBeenCalledWith(snapshot.curriculum);
    expect(deserializeSpy).toHaveBeenCalledWith(snapshot.user);
    const { userDb } = result.value;
    expect(userDb.execSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    expect(userDb.execSync).toHaveBeenCalledWith("ATTACH ':memory:' AS curriculum");
    expect((userDb.nativeDatabase as any).deserializeIntoAsync).toHaveBeenCalledWith(
      'curriculum',
      snapshot.curriculum,
    );
    expect(opened).toHaveLength(2);
  });

  it('openSnapshotDatabases closes both copies and returns DB_SNAPSHOT_OPEN_ERROR when attach fails', async () => {
    const opened: sqlite.SQLiteDatabase[] = [];
    const realDeserialize = mockSqlite.deserializeDatabaseAsync;
    jest.spyOn(mockSqlite, 'deserializeDatabaseAsync').mockImplementation(async (data) => {
      const db = await realDeserialize(data);
      jest.spyOn(db, 'closeAsync');
      jest
        .spyOn(db.nativeDatabase as any, 'deserializeIntoAsync')
        .mockRejectedValue(new Error('attach failed'));
      opened.push(db);
      return db;
    });

    const result = await openSnapshotDatabases({
      curriculum: new Uint8Array([1]),
      user: new Uint8Array([2]),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_SNAPSHOT_OPEN_ERROR');
    expect(opened).toHaveLength(2);
    for (const db of opened) {
      expect(db.closeAsync).toHaveBeenCalled();
    }
  });

  it('openSnapshotDatabases never opens a database by file name', async () => {
    const openSpy = jest.spyOn(mockSqlite, 'openDatabaseAsync');

    const result = await openSnapshotDatabases({
      curriculum: new Uint8Array([1]),
      user: new Uint8Array([2]),
    });

    expect(result.ok).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
