import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetPassageQuestions,
  __mockSetReadingPassages,
} from '../../../__mocks__/expo-sqlite';

import {
  getPassageById,
  getPassageQuestions,
  listPassagesByLevel,
} from '@/data/curriculum/passageRepository';

describe('passageRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function seedPassages() {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetReadingPassages('curriculum.db.test', [
      {
        id: 2,
        jlpt_level: 'N5',
        title: '買い物',
        body: '店で水を買います。',
        sort_order: 2,
      },
      {
        id: 1,
        jlpt_level: 'N5',
        title: '自己紹介',
        body: '私は学生です。',
        sort_order: 1,
      },
      {
        id: 3,
        jlpt_level: 'N4',
        title: '将来',
        body: '将来は日本に行きたいです。',
        sort_order: 1,
      },
    ]);

    __mockSetPassageQuestions('curriculum.db.test', [
      {
        id: 1,
        passage_id: 1,
        prompt: 'この人は何ですか？',
        accepted_answers: '["学生","がくせい"]',
        sort_order: 1,
      },
      {
        id: 2,
        passage_id: 2,
        prompt: '何を買いますか？',
        accepted_answers: '["水","みず"]',
        sort_order: 1,
      },
    ]);

    return db;
  }

  it('lists passages by JLPT level ordered by sort_order with question counts', async () => {
    const db = await seedPassages();
    const passages = listPassagesByLevel(db, 'N5');

    expect(passages).toHaveLength(2);
    expect(passages[0]).toEqual({
      id: '1',
      title: '自己紹介',
      jlptLevel: 'N5',
      sortOrder: 1,
      questionCount: 1,
    });
    expect(passages[1]).toEqual({
      id: '2',
      title: '買い物',
      jlptLevel: 'N5',
      sortOrder: 2,
      questionCount: 1,
    });
  });

  it('returns empty list for levels without passages', async () => {
    const db = await seedPassages();
    expect(listPassagesByLevel(db, 'N1')).toEqual([]);
  });

  it('returns passage detail by id', async () => {
    const db = await seedPassages();
    const passage = getPassageById(db, '1');

    expect(passage).toEqual({
      id: '1',
      title: '自己紹介',
      body: '私は学生です。',
      jlptLevel: 'N5',
      sortOrder: 1,
    });
  });

  it('returns null for unknown passage id', async () => {
    const db = await seedPassages();
    expect(getPassageById(db, '999')).toBeNull();
  });

  it('returns questions ordered by sort_order with parsed accepted answers', async () => {
    const db = await seedPassages();
    const questions = getPassageQuestions(db, '1');

    expect(questions).toHaveLength(1);
    expect(questions[0]).toEqual({
      id: '1',
      passageId: '1',
      prompt: 'この人は何ですか？',
      acceptedAnswers: ['学生', 'がくせい'],
      sortOrder: 1,
    });
  });
});
