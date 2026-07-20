import { render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import {
  __mockResetSqlite,
  __mockSetItemRelationships,
  __mockSetItems,
  __mockSetKanjiReadings,
} from '../../../__mocks__/expo-sqlite';

import { LessonItemView } from '@/components/lesson/LessonItemView';
import { __resetKanjiReadingPrimerSessionForTests } from '@/data/hooks/useKanjiReadingPrimer';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { setOnboardingPath } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      const cleanup = callback();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [callback]);
  },
}));

async function createDatabases() {
  const curriculumDb = await openDatabaseAsync('curriculum.db.test');
  const userDb = await openDatabaseAsync('user.db');
  const result = runMigrations(userDb, [migration001Initial, migration002ItemStudyStatus]);
  expect(result.ok).toBe(true);

  __mockSetItems('curriculum.db.test', [
    {
      id: 1,
      item_type: 'radical',
      jlpt_level: 'N5',
      slug: 'sun',
      primary_form: '一',
      meaning: 'one',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 1,
    },
    {
      id: 2,
      item_type: 'kanji',
      jlpt_level: 'N5',
      slug: 'day',
      primary_form: '日',
      meaning: 'day',
      mnemonic_text: 'The sun rises each day.',
      visual_mnemonic_url: null,
      sort_order: 1,
    },
    {
      id: 3,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'mainichi',
      primary_form: '毎日',
      meaning: 'every day',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 1,
    },
  ]);

  __mockSetKanjiReadings('curriculum.db.test', [
    { id: 1, item_id: 2, reading_type: 'onyomi', reading: 'ニチ', sort_order: 1 },
    { id: 2, item_id: 2, reading_type: 'kunyomi', reading: 'ひ', sort_order: 2 },
  ]);

  __mockSetItemRelationships('curriculum.db.test', [
    { parent_item_id: 1, child_item_id: 2, relationship_type: 'builds_on' },
    { parent_item_id: 2, child_item_id: 3, relationship_type: 'requires' },
  ]);

  return { curriculumDb, userDb };
}

function mount(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  sectionIndex: number,
) {
  const contextValue = {
    curriculumDb,
    userDb,
    isReady: true,
    error: null,
  } as unknown as DatabaseContextValue;

  return render(
    <DatabaseContext.Provider value={contextValue}>
      <LessonItemView itemId="2" sectionIndex={sectionIndex} />
    </DatabaseContext.Provider>,
  );
}

describe('LessonItemView sections', () => {
  beforeEach(() => {
    __mockResetSqlite();
    __resetKanjiReadingPrimerSessionForTests();
  });

  it('section 1 introduces the item without examples or links', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 0);

    expect(screen.getByTestId('lesson-section-intro')).toBeTruthy();
    expect(screen.getByText('日')).toBeTruthy();
    expect(screen.getByText('day')).toBeTruthy();
    expect(screen.getByText('ニチ')).toBeTruthy();
    expect(screen.queryByTestId('lesson-section-examples')).toBeNull();
    expect(screen.queryByTestId('item-cross-references')).toBeNull();
  });

  it('section 2 carries the mnemonics', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 1);

    expect(screen.getByTestId('lesson-section-mnemonic')).toBeTruthy();
    expect(screen.getByText('The sun rises each day.')).toBeTruthy();
    expect(screen.getByTestId('personal-mnemonic-editor')).toBeTruthy();
    // Paging replaced the collapsed mnemonic — nothing hides behind a tap.
    expect(screen.queryByTestId('mnemonic-disclosure')).toBeNull();
  });

  it('section 3 carries examples and cross-references', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 2);

    expect(screen.getByTestId('lesson-section-examples')).toBeTruthy();
    expect(screen.getByText('Built from')).toBeTruthy();
    expect(screen.getByTestId('cross-ref-components-1')).toBeTruthy();
    expect(screen.getByText('Vocabulary using this kanji')).toBeTruthy();
    expect(screen.getByTestId('cross-ref-related-3')).toBeTruthy();
  });

  it('shows the reading primer inline as section-1 content for a beginner', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setOnboardingPath(userDb, 'beginner');
    mount(curriculumDb, userDb, 0);

    const primer = screen.getByTestId('kanji-reading-primer');
    expect(primer).toBeTruthy();
    // Inline in the intro, not a wall in front of the lesson.
    expect(screen.getByTestId('lesson-section-intro')).toBeTruthy();
    expect(screen.getByText('日')).toBeTruthy();
  });

  it('does not show the primer unprompted on the manual path', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setOnboardingPath(userDb, 'manual');
    mount(curriculumDb, userDb, 0);

    expect(screen.queryByTestId('kanji-reading-primer')).toBeNull();
    // The same explainer is still reachable from the readings heading.
    expect(screen.getByTestId("section-heading-info-on'yomi")).toBeTruthy();
  });
});
