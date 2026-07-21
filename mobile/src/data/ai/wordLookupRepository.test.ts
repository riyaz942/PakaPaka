import type { SQLiteDatabase } from 'expo-sqlite';

import { lookupFlaggedWord } from '@/data/ai/wordLookupRepository';

// Same approach as masteryRepository.test.ts: the shared expo-sqlite mock has
// no concept of ATTACH DATABASE, so it can't simulate the `curriculum.items`
// join. A fake handle is enough to verify row -> lookup mapping and, crucially,
// that nothing here ever writes.
function fakeUserDb(row: Record<string, unknown> | null) {
  const getFirstSync = jest.fn().mockReturnValue(row);
  const runSync = jest.fn();
  return {
    db: { getFirstSync, runSync } as unknown as SQLiteDatabase,
    getFirstSync,
    runSync,
  };
}

describe('lookupFlaggedWord', () => {
  it('resolves a curriculum word the learner has not studied yet', () => {
    const { db } = fakeUserDb({
      id: 42,
      primary_form: '学生',
      meaning: 'student',
      studied: 0,
    });

    const result = lookupFlaggedWord(db, '学生');

    expect(result).toEqual({
      kind: 'curriculum',
      itemId: '42',
      primaryForm: '学生',
      meaning: 'student',
      studied: false,
    });
  });

  it('marks a studied curriculum word as studied', () => {
    const { db } = fakeUserDb({ id: 7, primary_form: '水', meaning: 'water', studied: 1 });

    const result = lookupFlaggedWord(db, '水');

    expect(result).toMatchObject({ kind: 'curriculum', itemId: '7', studied: true });
  });

  it('treats an unmatched word as off-curriculum rather than an error', () => {
    const { db } = fakeUserDb(null);

    expect(lookupFlaggedWord(db, 'ラーメン')).toEqual({
      kind: 'off_curriculum',
      text: 'ラーメン',
    });
  });

  it('never writes — flagging a word must not create SRS or study-status rows', () => {
    const matched = fakeUserDb({ id: 1, primary_form: '本', meaning: 'book', studied: 0 });
    lookupFlaggedWord(matched.db, '本');
    expect(matched.runSync).not.toHaveBeenCalled();

    const unmatched = fakeUserDb(null);
    lookupFlaggedWord(unmatched.db, 'ラーメン');
    expect(unmatched.runSync).not.toHaveBeenCalled();
  });

  it('trims the surface form before matching', () => {
    const { db, getFirstSync } = fakeUserDb({
      id: 3,
      primary_form: '猫',
      meaning: 'cat',
      studied: 0,
    });

    lookupFlaggedWord(db, '  猫  ');

    const boundParams = getFirstSync.mock.calls[0].slice(1);
    expect(boundParams[boundParams.length - 1]).toBe('猫');
  });

  it('prefers vocabulary when primary_form collides across item types', () => {
    const { db, getFirstSync } = fakeUserDb({
      id: 5,
      primary_form: '上',
      meaning: 'up / above',
      studied: 0,
    });

    lookupFlaggedWord(db, '上');

    const sql = getFirstSync.mock.calls[0][0] as string;
    expect(sql).toMatch(/ORDER BY CASE i\.item_type/);
    expect(sql).toMatch(/WHEN 'vocabulary' THEN 0/);
  });

  it('short-circuits an empty selection without querying', () => {
    const { db, getFirstSync } = fakeUserDb(null);

    expect(lookupFlaggedWord(db, '   ')).toEqual({ kind: 'off_curriculum', text: '   ' });
    expect(getFirstSync).not.toHaveBeenCalled();
  });

  it('tolerates a curriculum row with a null meaning', () => {
    const { db } = fakeUserDb({ id: 9, primary_form: '桜', meaning: null, studied: 0 });

    expect(lookupFlaggedWord(db, '桜')).toMatchObject({ meaning: '' });
  });
});
