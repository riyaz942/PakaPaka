import type { SQLiteDatabase } from 'expo-sqlite';

import {
  countReadingLockedVocabulary,
  getKnownVocabularyCharacters,
  getUnlearnedKanjiForItems,
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

  it('selects vocabulary items, and reads kanji only as their reading gate', () => {
    const db = fakeUserDb([]);
    getKnownVocabularyCharacters(db);
    const [sql, ...params] = (db.getAllSync as jest.Mock).mock.calls[0];
    expect(sql).toContain("i.item_type = 'vocabulary'");
    // Kanji appear only inside the reading-live subquery — never as the
    // selected row, which is still the word (FR78 / BUG6).
    expect(sql).toContain("p.item_type = 'kanji'");
    expect(sql).toContain('item_study_status');
    expect(sql).toContain('srs_states');
    // Word mastery is master+ (v2 rule 4); the kanji gate stays at guru+.
    expect(params).toEqual([
      'master',
      'enlightened',
      'burned',
      'requires',
      'builds_on',
      'guru',
      'master',
      'enlightened',
      'burned',
    ]);
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

  it('checks the item itself against the same master+/known predicate', () => {
    const db = { getFirstSync: jest.fn().mockReturnValue(null) } as unknown as SQLiteDatabase;
    isVocabularyItemKnown(db, 'vocab-1');
    const [sql, ...params] = (db.getFirstSync as jest.Mock).mock.calls[0];
    expect(sql).toContain('item_study_status');
    expect(sql).toContain('srs_states');
    expect(params).toEqual([
      'vocab-1',
      'vocab-1',
      'master',
      'enlightened',
      'burned',
      'vocab-1',
      'requires',
      'builds_on',
      'guru',
      'master',
      'enlightened',
      'burned',
    ]);
  });

  it('is false for a missing item id', () => {
    const db = { getFirstSync: jest.fn() } as unknown as SQLiteDatabase;
    expect(isVocabularyItemKnown(db, null)).toBe(false);
    expect(db.getFirstSync as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('getUnlearnedKanjiForItems', () => {
  function fakeDb(rows: { child_item_id: number; primary_form: string }[]): SQLiteDatabase {
    return { getAllSync: jest.fn().mockReturnValue(rows) } as unknown as SQLiteDatabase;
  }

  it('queries nothing for an empty id list', () => {
    const db = fakeDb([]);
    expect(getUnlearnedKanjiForItems(db, [])).toEqual(new Map());
    expect(db.getAllSync as jest.Mock).not.toHaveBeenCalled();
  });

  it('groups the unlearned kanji under the word that needs them', () => {
    const db = fakeDb([
      { child_item_id: 10, primary_form: '写' },
      { child_item_id: 10, primary_form: '真' },
      { child_item_id: 11, primary_form: '番' },
    ]);

    expect(getUnlearnedKanjiForItems(db, ['10', '11', '12'])).toEqual(
      new Map([
        ['10', ['写', '真']],
        ['11', ['番']],
      ]),
    );
  });

  it('reads both edge types and treats guru+ or an explicit known mark as learned', () => {
    const db = fakeDb([]);
    getUnlearnedKanjiForItems(db, ['10']);
    const [sql, ...params] = (db.getAllSync as jest.Mock).mock.calls[0];
    expect(sql).toContain("p.item_type = 'kanji'");
    expect(sql).toContain("status = 'known'");
    expect(params).toEqual([10, 'requires', 'builds_on', 'guru', 'master', 'enlightened', 'burned']);
  });
});

describe('countReadingLockedVocabulary', () => {
  it('counts tracked, unburned words whose reading is not live yet', () => {
    const db = {
      getFirstSync: jest.fn().mockReturnValue({ locked: 42 }),
    } as unknown as SQLiteDatabase;

    expect(countReadingLockedVocabulary(db)).toBe(42);
    const [sql] = (db.getFirstSync as jest.Mock).mock.calls[0];
    expect(sql).toContain("i.item_type = 'vocabulary'");
    expect(sql).toContain('s.is_burned = 0');
    expect(sql).toContain('NOT EXISTS');
  });

  it('is zero when the count query returns nothing', () => {
    const db = { getFirstSync: jest.fn().mockReturnValue(null) } as unknown as SQLiteDatabase;
    expect(countReadingLockedVocabulary(db)).toBe(0);
  });
});
