import type { SQLiteDatabase } from 'expo-sqlite';

import {
  clearAllFuriganaOverrides,
  clearFuriganaOverride,
  getAllFuriganaOverrides,
  getFuriganaOverride,
  listFuriganaOverrides,
  setFuriganaOverride,
} from '@/data/user/furiganaOverrideRepository';

// Same constraint as masteryRepository.test.ts: the shared expo-sqlite mock has
// no `ATTACH DATABASE` / cross-schema table support, so `listFuriganaOverrides`
// (which joins `curriculum.items`) can't run against it. A minimal fake handle
// verifies the SQL shape and the row -> model mapping.
function fakeUserDb(rows: unknown[] = []): SQLiteDatabase {
  return {
    getAllSync: jest.fn().mockReturnValue(rows),
    getFirstSync: jest.fn().mockReturnValue(rows[0] ?? null),
    runSync: jest.fn().mockReturnValue({ changes: 1, lastInsertRowId: 1 }),
  } as unknown as SQLiteDatabase;
}

describe('getFuriganaOverride', () => {
  it('returns null when the word has no override row', () => {
    const db = fakeUserDb([]);
    expect(getFuriganaOverride(db, 'vocab-1')).toBeNull();
  });

  it('returns the stored display mode', () => {
    const db = fakeUserDb([{ display_mode: 'hidden' }]);
    expect(getFuriganaOverride(db, 'vocab-1')).toBe('hidden');
  });

  it('queries furigana_overrides by item id', () => {
    const db = fakeUserDb([]);
    getFuriganaOverride(db, 'vocab-1');
    const [sql, ...params] = (db.getFirstSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('furigana_overrides');
    expect(params).toEqual(['vocab-1']);
  });
});

describe('setFuriganaOverride', () => {
  it('upserts the override with the item id and mode', () => {
    const db = fakeUserDb();
    setFuriganaOverride(db, 'vocab-1', 'shown');
    const [sql, ...params] = (db.runSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('INSERT INTO furigana_overrides');
    expect(sql).toContain('ON CONFLICT');
    expect(params[0]).toBe('vocab-1');
    expect(params[1]).toBe('shown');
  });

  it('rejects a mode that is not a definite choice', () => {
    const db = fakeUserDb();
    // 'auto' is the absence of an override, never a stored value.
    expect(() => setFuriganaOverride(db, 'vocab-1', 'auto' as 'shown')).toThrow();
    expect(db.runSync as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('clearFuriganaOverride', () => {
  it('deletes only the given item id', () => {
    const db = fakeUserDb();
    clearFuriganaOverride(db, 'vocab-1');
    const [sql, ...params] = (db.runSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('DELETE FROM furigana_overrides');
    expect(sql).toContain('WHERE item_id = ?');
    expect(params).toEqual(['vocab-1']);
  });
});

describe('clearAllFuriganaOverrides', () => {
  it('deletes every override row', () => {
    const db = fakeUserDb();
    clearAllFuriganaOverrides(db);
    const [sql, ...params] = (db.runSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('DELETE FROM furigana_overrides');
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([]);
  });
});

describe('listFuriganaOverrides', () => {
  it('maps rows to item id, primary form and mode', () => {
    const db = fakeUserDb([
      { item_id: 'vocab-1', primary_form: '食べる', display_mode: 'hidden' },
      { item_id: 'vocab-2', primary_form: '学校', display_mode: 'shown' },
    ]);

    expect(listFuriganaOverrides(db)).toEqual([
      { itemId: 'vocab-1', primaryForm: '食べる', mode: 'hidden' },
      { itemId: 'vocab-2', primaryForm: '学校', mode: 'shown' },
    ]);
  });

  it('left-joins curriculum items so orphan overrides still list', () => {
    const db = fakeUserDb([]);
    listFuriganaOverrides(db);
    const [sql] = (db.getAllSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('curriculum.items');
    expect(sql).toContain('LEFT JOIN');
  });

  it('labels orphans when curriculum no longer has the item', () => {
    const db = fakeUserDb([
      { item_id: 'gone-1', primary_form: null, display_mode: 'shown' },
    ]);

    expect(listFuriganaOverrides(db)).toEqual([
      { itemId: 'gone-1', primaryForm: '(removed)', mode: 'shown' },
    ]);
  });

  it('returns an empty list when nothing is overridden', () => {
    expect(listFuriganaOverrides(fakeUserDb([]))).toEqual([]);
  });
});

describe('getAllFuriganaOverrides', () => {
  it('returns a lookup map keyed by item id', () => {
    const db = fakeUserDb([
      { item_id: 'vocab-1', display_mode: 'hidden' },
      { item_id: 'vocab-2', display_mode: 'shown' },
    ]);

    expect(getAllFuriganaOverrides(db)).toEqual(
      new Map([
        ['vocab-1', 'hidden'],
        ['vocab-2', 'shown'],
      ]),
    );
  });

  it('does not join curriculum — it is read on every furigana surface', () => {
    const db = fakeUserDb([]);
    getAllFuriganaOverrides(db);
    const [sql] = (db.getAllSync as jest.Mock).mock.calls[0];
    expect(sql).not.toContain('curriculum.items');
  });
});
