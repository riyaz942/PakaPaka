import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getKnownVocabularyCharacters,
  isVocabularyItemKnown,
} from '@/data/user/masteryRepository';

// The shared hand-rolled expo-sqlite mock (mobile/__mocks__/expo-sqlite.ts)
// keeps one table set per database name and has no concept of `ATTACH
// DATABASE` / cross-schema-qualified table names, so it can't simulate the
// `curriculum.items` join this repository issues. A minimal fake db handle
// is enough to verify the row -> Set<string> mapping.
function fakeUserDb(rows: { primary_form: string }[]): SQLiteDatabase {
  return {
    getAllSync: jest.fn().mockReturnValue(rows),
    getFirstSync: jest.fn().mockReturnValue(rows[0] ?? null),
  } as unknown as SQLiteDatabase;
}

describe('getKnownVocabularyCharacters', () => {
  it('returns an empty set when nothing is known', () => {
    const db = fakeUserDb([]);
    expect(getKnownVocabularyCharacters(db)).toEqual(new Set());
  });

  it('expands each known word into its individual characters', () => {
    // A word's characters only count as known because the *word* is mastered
    // (BUG6) — a standalone kanji item being mastered no longer qualifies.
    const db = fakeUserDb([{ primary_form: '食べる' }, { primary_form: '学校' }]);
    expect(getKnownVocabularyCharacters(db)).toEqual(
      new Set(['食', 'べ', 'る', '学', '校']),
    );
  });

  it('deduplicates characters shared between known words', () => {
    const db = fakeUserDb([{ primary_form: '学校' }, { primary_form: '学生' }]);
    expect(getKnownVocabularyCharacters(db)).toEqual(new Set(['学', '校', '生']));
  });

  it('sources mastery from vocabulary items, not kanji items', () => {
    const db = fakeUserDb([]);
    getKnownVocabularyCharacters(db);
    const [sql, ...params] = (db.getAllSync as jest.Mock).mock.calls[0];
    expect(sql).toContain("item_type = 'vocabulary'");
    expect(sql).not.toContain("item_type = 'kanji'");
    expect(sql).toContain('item_study_status');
    expect(sql).toContain('srs_states');
    expect(params).toEqual(['guru', 'master', 'enlightened', 'burned']);
  });
});

describe('isVocabularyItemKnown', () => {
  it('is false when the item has no mastery row', () => {
    const db = fakeUserDb([]);
    expect(isVocabularyItemKnown(db, 'vocab-1')).toBe(false);
  });

  it('is true when a mastery row comes back', () => {
    const db = { getFirstSync: jest.fn().mockReturnValue({ known: 1 }) } as unknown as SQLiteDatabase;
    expect(isVocabularyItemKnown(db, 'vocab-1')).toBe(true);
  });

  it('checks the item itself against the same guru+/known predicate', () => {
    const db = { getFirstSync: jest.fn().mockReturnValue(null) } as unknown as SQLiteDatabase;
    isVocabularyItemKnown(db, 'vocab-1');
    const [sql, ...params] = (db.getFirstSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('item_study_status');
    expect(sql).toContain('srs_states');
    expect(params).toEqual(['vocab-1', 'vocab-1', 'guru', 'master', 'enlightened', 'burned']);
  });

  it('is false for a missing item id', () => {
    const db = { getFirstSync: jest.fn() } as unknown as SQLiteDatabase;
    expect(isVocabularyItemKnown(db, null)).toBe(false);
    expect(db.getFirstSync as jest.Mock).not.toHaveBeenCalled();
  });
});
