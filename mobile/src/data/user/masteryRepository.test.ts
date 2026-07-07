import type { SQLiteDatabase } from 'expo-sqlite';

import { getKnownKanjiCharacters } from '@/data/user/masteryRepository';

// The shared hand-rolled expo-sqlite mock (mobile/__mocks__/expo-sqlite.ts)
// keeps one table set per database name and has no concept of `ATTACH
// DATABASE` / cross-schema-qualified table names, so it can't simulate the
// `curriculum.items` join this repository issues. A minimal fake db handle
// is enough to verify the row -> Set<string> mapping.
function fakeUserDb(rows: { primary_form: string }[]): SQLiteDatabase {
  return {
    getAllSync: jest.fn().mockReturnValue(rows),
  } as unknown as SQLiteDatabase;
}

describe('getKnownKanjiCharacters', () => {
  it('returns an empty set when nothing is known', () => {
    const db = fakeUserDb([]);
    expect(getKnownKanjiCharacters(db)).toEqual(new Set());
  });

  it('returns the primary_form of every returned kanji row', () => {
    const db = fakeUserDb([{ primary_form: '食' }, { primary_form: '学' }]);
    expect(getKnownKanjiCharacters(db)).toEqual(new Set(['食', '学']));
  });

  it('queries item_study_status and the guru+ srs stages', () => {
    const db = fakeUserDb([]);
    getKnownKanjiCharacters(db);
    const call = (db.getAllSync as jest.Mock).mock.calls[0];
    const [sql, ...params] = call;
    expect(sql).toContain("item_type = 'kanji'");
    expect(sql).toContain('item_study_status');
    expect(sql).toContain('srs_states');
    expect(params).toEqual(['guru', 'master', 'enlightened', 'burned']);
  });
});
